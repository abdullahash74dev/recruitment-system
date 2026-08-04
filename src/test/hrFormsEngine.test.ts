import { describe, it, expect } from "vitest";
import { evaluateFormula } from "@/lib/hrForms/formulas";
import { resolveFormData, formatFieldValue, missingRequiredFields } from "@/lib/hrForms/templateEngine";
import type { Employee, HrField, HrFormTemplate } from "@/lib/hrForms/types";

const employee = (overrides: Partial<Employee> = {}): Employee => ({
  id: "emp-1",
  employee_no: "E-100",
  full_name_en: "Ahmed Ali",
  full_name_ar: "أحمد علي",
  national_id: null, passport_no: null, nationality: "Saudi", gender: null,
  birth_date: null, marital_status: null, phone: null, personal_email: null,
  work_email: null, department: "IT", job_title: "Engineer",
  manager_employee_id: null, employment_type: "permanent",
  hire_date: "2020-01-01", end_of_service_date: null,
  base_salary: 10000, housing_allowance: 2000, transport_allowance: 500,
  salary_currency: "SAR", bank_name: null, bank_account_no: null, bank_iban: null,
  status: "active", source_applicant_id: null, photo_url: null,
  extra: { custom_badge: "B-9" },
  created_by: null, created_at: "", updated_at: "",
  ...overrides,
});

const template = (fields: HrField[]): HrFormTemplate => ({
  id: "t-1", slug: "test", title_en: "Test", title_ar: null, category: null,
  doc_no: "HR-FRM-999", department_owner: "HR", version: 1, revision_no: null,
  revision_date: null, schema: { sections: [{ key: "s1", title_en: "S1", fields }] },
  status: "published", is_system_seed: false, requires_approval: true,
  created_by: null, created_at: "", updated_at: "",
});

describe("evaluateFormula", () => {
  it("computes inclusive day ranges", () => {
    expect(evaluateFormula("date_diff_days(a, b)", { a: "2026-01-01", b: "2026-01-10" })).toBe(10);
  });

  it("sums fields, treating blanks as zero", () => {
    expect(evaluateFormula("sum_fields(x, y, z)", { x: 5, y: null, z: "2.5" })).toBe(7.5);
  });

  it("sums table columns across rows", () => {
    const rows = [{ amount: 100, vat: 15 }, { amount: 50, vat: null }];
    expect(evaluateFormula("sum_table_columns(items, amount, vat)", { items: rows })).toBe(165);
  });

  it("applies the resignation factor to EOS awards", () => {
    // 4 years of service at 6000/month: award = 4 * 0.5 * 6000 = 12000.
    const data = { hire: "2020-01-01", end: "2024-01-01", wage: 6000, type: "termination" };
    expect(evaluateFormula("eos_gratuity(hire, end, wage, type)", data)).toBeCloseTo(12000, -1);
    // Resignation between 2 and 5 years pays one third.
    const resigned = evaluateFormula("eos_gratuity(hire, end, wage, type)", { ...data, type: "resignation" });
    expect(resigned as number).toBeCloseTo(4000, -1);
  });

  it("returns null for unknown or malformed formulas", () => {
    expect(evaluateFormula("drop_tables(x)", { x: 1 })).toBeNull();
    expect(evaluateFormula("sum_fields(", {})).toBeNull();
  });
});

describe("resolveFormData", () => {
  const fields: HrField[] = [
    { key: "name", type: "text", label_en: "Name", source: "employee", employee_field: "full_name_en" },
    { key: "badge", type: "text", label_en: "Badge", source: "employee", employee_field: "custom_badge" },
    { key: "salary", type: "currency", label_en: "Salary", source: "employee", employee_field: "base_salary" },
    { key: "housing", type: "currency", label_en: "Housing", source: "employee", employee_field: "housing_allowance" },
    { key: "note", type: "text", label_en: "Note", source: "submission" },
    { key: "total", type: "computed", label_en: "Total", source: "computed", formula: "sum_fields(salary, housing)" },
  ];

  it("auto-fills employee fields from columns and extra, keeps submission overrides", () => {
    const resolved = resolveFormData(template(fields), employee(), { note: "hi", name: "Override" });
    expect(resolved.name).toBe("Override");
    expect(resolved.badge).toBe("B-9");
    expect(resolved.salary).toBe(10000);
    expect(resolved.note).toBe("hi");
    expect(resolved.total).toBe(12000);
  });

  it("leaves employee fields empty without an employee", () => {
    const resolved = resolveFormData(template(fields), null, {});
    expect(resolved.name).toBeNull();
    expect(resolved.total).toBe(0);
  });
});

describe("formatFieldValue", () => {
  it("maps option values to labels per language", () => {
    const field: HrField = {
      key: "k", type: "radio", label_en: "L", source: "submission",
      options: [{ value: "annual", label_en: "Annual", label_ar: "سنوية" }],
    };
    expect(formatFieldValue(field, "annual", "en")).toBe("Annual");
    expect(formatFieldValue(field, "annual", "ar")).toBe("سنوية");
  });

  it("formats currency with two decimals", () => {
    const field: HrField = { key: "k", type: "currency", label_en: "L", source: "submission" };
    expect(formatFieldValue(field, 12500, "en")).toBe("12,500.00");
  });
});

describe("missingRequiredFields", () => {
  it("flags empty required fields only", () => {
    const t = template([
      { key: "a", type: "text", label_en: "A", source: "submission", required: true },
      { key: "b", type: "text", label_en: "B", source: "submission", required: true },
      { key: "c", type: "computed", label_en: "C", source: "computed", required: true, formula: "sum_fields(x)" },
    ]);
    const missing = missingRequiredFields(t, { a: "filled", b: "" });
    expect(missing.map((f) => f.key)).toEqual(["b"]);
  });
});
