import { describe, it, expect } from "vitest";
import { dupKeys, richness, groupDuplicates } from "@/lib/applicantDuplicates";

const applicant = (overrides: Record<string, unknown>) => ({
  id: "id",
  full_name: "Ahmed Ali",
  phone: "0500000000",
  email: "ahmed@example.com",
  desired_position: "Engineer",
  created_at: "2026-01-01T00:00:00Z",
  is_archived: false,
  ...overrides,
});

describe("dupKeys", () => {
  it("normalizes name/phone/email before matching", () => {
    const a = dupKeys(applicant({ full_name: "  Ahmed   Ali ", phone: "+966 50-000-0000" }));
    const b = dupKeys(applicant({ full_name: "ahmed ali", phone: "0500000000" }));
    expect(a.some(k => b.includes(k))).toBe(true);
  });

  it("returns no keys when name is missing", () => {
    expect(dupKeys(applicant({ full_name: "" }))).toEqual([]);
  });
});

describe("richness", () => {
  it("counts non-empty fields", () => {
    expect(richness({ a: "x", b: null, c: "", d: undefined, e: "y" })).toBe(2);
  });
});

describe("groupDuplicates", () => {
  it("groups records that share a key, ignores singletons", () => {
    const records = [
      applicant({ id: "1" }),
      applicant({ id: "2" }),
      applicant({ id: "3", full_name: "Someone Else", phone: "0511111111", email: "se@example.com" }),
    ];
    const groups = groupDuplicates(records);
    expect(groups).toHaveLength(1);
    expect(groups[0].map(r => r.id).sort()).toEqual(["1", "2"]);
  });

  it("merges transitively when records share different keys with a common member", () => {
    // A matches B on name+phone, B matches C on name+email, A and C share no key directly.
    const a = applicant({ id: "A", phone: "0500000001", email: "a@example.com" });
    const b = applicant({ id: "B", phone: "0500000001", email: "b@example.com" });
    const c = applicant({ id: "C", phone: "0500000003", email: "b@example.com" });
    const groups = groupDuplicates([a, b, c]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map(r => r.id).sort()).toEqual(["A", "B", "C"]);
  });

  it("returns no groups when nothing matches", () => {
    const records = [
      applicant({ id: "1", full_name: "Person One", phone: "0500000001", email: "one@example.com" }),
      applicant({ id: "2", full_name: "Person Two", phone: "0500000002", email: "two@example.com" }),
    ];
    expect(groupDuplicates(records)).toHaveLength(0);
  });
});
