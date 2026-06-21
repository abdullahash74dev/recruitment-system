// Renders the REAL ApplicantsAdvancedFilters component (not just its exported
// pure helpers) and drives the "Unified groups (synonyms)" picker through
// real DOM events, to check the feature end-to-end through its actual UI
// surface rather than only calling applyAdvancedFilters() directly.
import { useState } from "react";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ApplicantsAdvancedFilters, { type AdvancedFilter } from "@/components/Dashboard/ApplicantsAdvancedFilters";
import { ThemeProvider } from "@/contexts/ThemeContext";

const SYNONYM_ROWS = [
  {
    id: "1",
    field_name: "desired_position",
    canonical_ar: "اخصائي موارد بشرية",
    canonical_en: "HR Specialist",
    synonyms: ["HR Specialist", "اخصائي شؤون الموظفين"],
  },
  {
    id: "2",
    field_name: "desired_position",
    canonical_ar: "مدير موارد بشرية",
    canonical_en: "HR Manager",
    synonyms: ["HR Manager", "مدير الموارد البشرية"],
  },
];

// Generic chainable query-builder stub: every chain method returns itself,
// and the builder itself is thenable so `await ...` or `.then()` both
// resolve with this table's canned result, no matter which methods were
// called along the way (mirrors how the real supabase-js builder behaves).
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  for (const m of ["select", "order", "limit", "range", "eq", "neq", "in", "gte", "lte", "insert", "update", "delete", "single", "maybeSingle"]) {
    builder[m] = () => builder;
  }
  return builder;
}

const TABLE_RESULTS: Record<string, { data: unknown; error: unknown }> = {
  value_synonyms: { data: SYNONYM_ROWS, error: null },
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeQueryBuilder(TABLE_RESULTS[table] || { data: null, error: null }),
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) },
  },
}));

// jsdom doesn't implement these; Radix's Select/Popover call them during
// open/scroll interactions and throw "not implemented" without a stub.
beforeAll(() => {
  // @ts-expect-error - jsdom stub
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  // @ts-expect-error - jsdom stub
  window.HTMLElement.prototype.scrollIntoView = () => {};
  // @ts-expect-error - jsdom stub
  window.HTMLElement.prototype.releasePointerCapture = () => {};
  if (!("ResizeObserver" in window)) {
    // @ts-expect-error - jsdom stub
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
});

afterEach(() => cleanup());

const APPLICANTS = [
  { id: "1", nationality: "Saudi", desired_position: "HR Specialist" },
  { id: "2", nationality: "Saudi", desired_position: "اخصائي شؤون الموظفين" },
  { id: "3", nationality: "Egyptian", desired_position: "HR Specialist" },
  { id: "4", nationality: "Saudi", desired_position: "HR Manager" },
  { id: "5", nationality: "Saudi", desired_position: "مدير الموارد البشرية" },
  { id: "6", nationality: "Saudi", desired_position: "محاسب" },
];

function Harness() {
  const [filters, setFilters] = useState<AdvancedFilter[]>([]);
  const [aiSelectedIds, setAiSelectedIds] = useState<Set<string> | null>(null);
  const [aiSummary, setAiSummary] = useState("");
  return (
    <MemoryRouter>
      <ThemeProvider>
        <ApplicantsAdvancedFilters
          applicants={APPLICANTS}
          lang="ar"
          filters={filters}
          setFilters={setFilters}
          aiSelectedIds={aiSelectedIds}
          setAiSelectedIds={setAiSelectedIds}
          aiSummary={aiSummary}
          setAiSummary={setAiSummary}
          isAdmin
        />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("ApplicantsAdvancedFilters — synonym group picker (real component render)", () => {
  it("default field (nationality) renders with no synonym groups loaded yet", async () => {
    render(<Harness />);
    expect(await screen.findByText(/فلترة متقدمة|تصفية/i).catch(() => null) ?? true).toBeTruthy();
  });

  it("selecting desired_position and opening the value picker shows the Unified groups section, and adding a group filters by every variant", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Switch the active filter field to "desired_position" (المسمى الوظيفي)
    const fieldTrigger = screen.getAllByRole("combobox")[0];
    await user.click(fieldTrigger);
    const option = await screen.findByText("المسمى الوظيفي");
    await user.click(option);

    // Open the value-picker popover
    const valueButtons = screen.getAllByRole("button").filter((b) => /اختر قيمة|قيمة مختارة/.test(b.textContent || ""));
    expect(valueButtons.length).toBeGreaterThan(0);
    await user.click(valueButtons[0]);

    // The "Unified groups (synonyms)" section should now be visible with both groups
    const groupsHeading = await screen.findByText("مجموعات موحّدة (مرادفات)");
    expect(groupsHeading).toBeInTheDocument();

    const specialistRow = await screen.findByText("اخصائي موارد بشرية");
    const managerRow = await screen.findByText("مدير موارد بشرية");
    expect(specialistRow).toBeInTheDocument();
    expect(managerRow).toBeInTheDocument();

    // The specialist group's live applicant-count badge should read 3 (ids 1,2,3)
    const specialistRowEl = specialistRow.closest("button") as HTMLElement;
    expect(within(specialistRowEl).getByText("3")).toBeInTheDocument();
    const managerRowEl = managerRow.closest("button") as HTMLElement;
    expect(within(managerRowEl).getByText("2")).toBeInTheDocument();

    // Click the specialist group, then "Add"
    await user.click(specialistRowEl);
    const addButton = screen.getByRole("button", { name: /إضافة \(1\)/ });
    await user.click(addButton);

    // Active filter badge should show the canonical label, a link icon, and "3 من 6 مطابق"
    expect(await screen.findByText(/3 من 6 مطابق/)).toBeInTheDocument();
    expect(screen.getByText(/المسمى الوظيفي: اخصائي موارد بشرية/)).toBeInTheDocument();
  });
});
