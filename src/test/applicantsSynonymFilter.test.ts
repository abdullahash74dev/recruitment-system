import { describe, it, expect, vi, beforeAll } from "vitest";

// Canned value_synonyms rows: two distinct job-title groups, mirroring the
// real-world case of "HR Specialist" vs "HR Manager" needing separate sets.
const SYNONYM_ROWS = [
  {
    id: "1",
    field_name: "desired_position",
    canonical_ar: "اخصائي موارد بشرية",
    canonical_en: "HR Specialist",
    synonyms: ["HR Specialist", "HR Spec", "اخصائي شؤون الموظفين", "أخصائي موارد بشرية"],
  },
  {
    id: "2",
    field_name: "desired_position",
    canonical_ar: "مدير موارد بشرية",
    canonical_en: "HR Manager",
    synonyms: ["HR Manager", "مدير الموارد البشرية"],
  },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => Promise.resolve({ data: SYNONYM_ROWS, error: null }),
    }),
  },
}));

describe("synonym-group-aware applicant filtering", () => {
  beforeAll(async () => {
    const { ensureSynonymsLoaded } = await import("@/hooks/useValueSynonyms");
    await ensureSynonymsLoaded();
  });

  it("lookupSynonym resolves spelling/bilingual variants to the right canonical group", async () => {
    const { lookupSynonym } = await import("@/hooks/useValueSynonyms");
    expect(lookupSynonym("desired_position", "HR Specialist", "ar")).toBe("اخصائي موارد بشرية");
    expect(lookupSynonym("desired_position", "اخصائي شؤون الموظفين", "ar")).toBe("اخصائي موارد بشرية");
    expect(lookupSynonym("desired_position", "مدير الموارد البشرية", "ar")).toBe("مدير موارد بشرية");
    // Unrelated value must not be pulled into either group
    expect(lookupSynonym("desired_position", "محاسب", "ar")).toBeNull();
  });

  it("applyAdvancedFilters with a canonical-group filter matches every variant of that group only", async () => {
    const { applyAdvancedFilters } = await import("@/components/Dashboard/ApplicantsAdvancedFilters");
    const applicants = [
      { id: "1", desired_position: "HR Specialist" },
      { id: "2", desired_position: "اخصائي شؤون الموظفين" },
      { id: "3", desired_position: "أخصائي موارد بشرية" },
      { id: "4", desired_position: "HR Manager" },
      { id: "5", desired_position: "مدير الموارد البشرية" },
      { id: "6", desired_position: "محاسب" },
    ];

    const specialists = applyAdvancedFilters(
      applicants,
      [{ field: "desired_position", value: "__canon__:اخصائي موارد بشرية" }],
      null,
    );
    expect(specialists.map((a) => a.id).sort()).toEqual(["1", "2", "3"]);

    const managers = applyAdvancedFilters(
      applicants,
      [{ field: "desired_position", value: "__canon__:مدير موارد بشرية" }],
      null,
    );
    expect(managers.map((a) => a.id).sort()).toEqual(["4", "5"]);
  });

  it("literal (non-canon) filters still do plain substring matching as before", async () => {
    const { applyAdvancedFilters } = await import("@/components/Dashboard/ApplicantsAdvancedFilters");
    const applicants = [
      { id: "1", nationality: "Saudi" },
      { id: "2", nationality: "Egyptian" },
    ];
    const result = applyAdvancedFilters(applicants, [{ field: "nationality", value: "saudi" }], null);
    expect(result.map((a) => a.id)).toEqual(["1"]);
  });

  it("narrows progressively when multiple fields are filtered (AND across fields)", async () => {
    const { applyAdvancedFilters } = await import("@/components/Dashboard/ApplicantsAdvancedFilters");
    const applicants = [
      { id: "1", nationality: "Saudi", desired_position: "HR Specialist" },
      { id: "2", nationality: "Saudi", desired_position: "HR Manager" },
      { id: "3", nationality: "Egyptian", desired_position: "HR Specialist" },
    ];
    const result = applyAdvancedFilters(
      applicants,
      [
        { field: "nationality", value: "saudi" },
        { field: "desired_position", value: "__canon__:اخصائي موارد بشرية" },
      ],
      null,
    );
    expect(result.map((a) => a.id)).toEqual(["1"]);
  });

  it("stays fast on a 62k-row dataset (regression: this used to freeze the main thread)", async () => {
    const { applyAdvancedFilters } = await import("@/components/Dashboard/ApplicantsAdvancedFilters");
    // Indices 0-2 belong to the "HR Specialist" canonical group; 3-6 don't.
    const variants = ["HR Specialist", "اخصائي شؤون الموظفين", "أخصائي موارد بشرية", "HR Manager", "مدير الموارد البشرية", "محاسب", "مطور برمجيات"];
    const applicants = Array.from({ length: 62000 }, (_, i) => ({
      id: String(i),
      desired_position: variants[i % variants.length],
    }));
    const expectedMatches = applicants.filter((a) => variants.indexOf(a.desired_position) <= 2).length;

    const start = performance.now();
    const result = applyAdvancedFilters(
      applicants,
      [{ field: "desired_position", value: "__canon__:اخصائي موارد بشرية" }],
      null,
    );
    const elapsedMs = performance.now() - start;

    expect(result.length).toBe(expectedMatches);
    // Generous bound for CI noise — the unoptimized per-applicant lookupSynonym
    // version of this took multiple seconds and froze a real browser tab.
    expect(elapsedMs).toBeLessThan(1500);
  });
});
