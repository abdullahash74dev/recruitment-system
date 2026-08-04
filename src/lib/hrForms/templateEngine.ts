// Resolves a template + employee + submission data into the single canonical
// object every consumer (on-screen renderer, PDF export, Excel export) reads,
// so all outputs are guaranteed to show the same values and branding.

import type { SiteSettings } from "@/hooks/useSiteSettings";
import { evaluateFormula } from "./formulas";
import type {
  Employee,
  HrField,
  HrFieldValue,
  HrFormTemplate,
  HrTemplateSchema,
  SignatureValue,
} from "./types";

/** Employee columns a template field may auto-fill from (offered by the builder). */
export const EMPLOYEE_FIELD_KEYS = [
  "employee_no", "full_name_en", "full_name_ar", "national_id", "passport_no",
  "nationality", "gender", "birth_date", "marital_status", "phone",
  "personal_email", "work_email", "department", "job_title", "employment_type",
  "hire_date", "end_of_service_date", "base_salary", "housing_allowance",
  "transport_allowance", "salary_currency", "bank_name", "bank_account_no", "bank_iban",
] as const;

export function employeeFieldValue(employee: Employee | null, employeeField?: string): HrFieldValue {
  if (!employee || !employeeField) return null;
  if ((EMPLOYEE_FIELD_KEYS as readonly string[]).includes(employeeField)) {
    const value = employee[employeeField as keyof Employee];
    return (value ?? null) as HrFieldValue;
  }
  // Custom admin-defined employee fields live in employees.extra.
  return (employee.extra?.[employeeField] ?? null) as HrFieldValue;
}

export function allFields(schema: HrTemplateSchema): HrField[] {
  return (schema?.sections ?? []).flatMap((s) => s.fields ?? []);
}

/**
 * Merge stored submission data with employee auto-fill: employee-sourced
 * fields fall back to the employee record when the submission has no explicit
 * override; computed fields are always re-evaluated from the merged data.
 */
export function resolveFormData(
  template: HrFormTemplate,
  employee: Employee | null,
  submissionData: Record<string, HrFieldValue>,
): Record<string, HrFieldValue> {
  const fields = allFields(template.schema);
  const resolved: Record<string, HrFieldValue> = {};

  for (const field of fields) {
    if (field.source === "computed") continue;
    const stored = submissionData[field.key];
    if (stored !== undefined && stored !== null && stored !== "") {
      resolved[field.key] = stored;
    } else if (field.source === "employee") {
      resolved[field.key] = employeeFieldValue(employee, field.employee_field);
    } else {
      resolved[field.key] = stored ?? null;
    }
  }

  // Computed fields may reference each other (e.g. net_due depends on
  // total_income): evaluate in schema order twice so a forward reference in
  // the same template still settles without needing a dependency graph.
  for (let pass = 0; pass < 2; pass++) {
    for (const field of fields) {
      if (field.source === "computed") {
        resolved[field.key] = evaluateFormula(field.formula, resolved);
      }
    }
  }

  return resolved;
}

export interface ResolvedForm {
  template: HrFormTemplate;
  employee: Employee | null;
  values: Record<string, HrFieldValue>;
  branding: {
    companyNameEn: string;
    companyNameAr: string;
    logoUrl: string | null;
  };
}

export function resolveForm(
  template: HrFormTemplate,
  employee: Employee | null,
  submissionData: Record<string, HrFieldValue>,
  settings: SiteSettings,
): ResolvedForm {
  return {
    template,
    employee,
    values: resolveFormData(template, employee, submissionData),
    branding: {
      companyNameEn: settings.site_name_en,
      companyNameAr: settings.site_name_ar,
      logoUrl: settings.logo_url,
    },
  };
}

/** Display string for any field value, used by exports and read-only views. */
export function formatFieldValue(field: HrField, value: HrFieldValue, lang: "en" | "ar" = "en"): string {
  if (value === null || value === undefined || value === "") return "";
  if (field.type === "checkbox") return value ? (lang === "ar" ? "نعم" : "Yes") : (lang === "ar" ? "لا" : "No");
  if (field.type === "signature") {
    const sig = value as SignatureValue;
    const parts = [sig?.name, sig?.date].filter(Boolean);
    return parts.join(" — ");
  }
  if ((field.type === "select" || field.type === "radio") && field.options) {
    const opt = field.options.find((o) => o.value === value);
    if (opt) return (lang === "ar" && opt.label_ar) || opt.label_en;
  }
  if (field.type === "currency" || field.format === "currency") {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n)) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (Array.isArray(value)) return `${value.length} ${lang === "ar" ? "صف" : "row(s)"}`;
  return String(value);
}

/** Validate required fields; returns the keys of missing ones. */
export function missingRequiredFields(
  template: HrFormTemplate,
  values: Record<string, HrFieldValue>,
): HrField[] {
  return allFields(template.schema).filter((f) => {
    if (!f.required || f.source === "computed") return false;
    const v = values[f.key];
    return v === null || v === undefined || v === "";
  });
}
