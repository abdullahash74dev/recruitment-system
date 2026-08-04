// Shared types for the HR Forms module: the template schema stored in
// hr_form_templates.schema, the employee master record, and submissions.

export type HrFieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "select"
  | "radio"
  | "checkbox"
  | "signature"
  | "table"
  | "computed";

export type HrFieldSource = "employee" | "submission" | "computed";

export interface HrFieldOption {
  value: string;
  label_en: string;
  label_ar?: string;
}

export interface HrTableColumn {
  key: string;
  type: "text" | "number";
  label_en: string;
  label_ar?: string;
}

export interface HrField {
  key: string;
  type: HrFieldType;
  label_en: string;
  label_ar?: string;
  source: HrFieldSource;
  /** For source="employee": which employees column (or extra->>key) to auto-fill from. */
  employee_field?: string;
  required?: boolean;
  /** When auto-filled from the employee record, keep the value editable or lock it. */
  readonly_if_prefilled?: boolean;
  options?: HrFieldOption[];
  /** For type="computed": name + args of a registered formula, e.g. "sum_fields(a, b)". */
  formula?: string;
  format?: "currency" | "number" | "text";
  columns?: HrTableColumn[];
  min_rows?: number;
  min?: number;
  max?: number;
  placeholder_en?: string;
  placeholder_ar?: string;
}

export interface HrSection {
  key: string;
  title_en: string;
  title_ar?: string;
  /** Free-text note/clause rendered under the section title (declarations, legal text). */
  note_en?: string;
  note_ar?: string;
  fields: HrField[];
}

export interface HrTemplateSchema {
  sections: HrSection[];
}

export type HrTemplateStatus = "draft" | "published" | "archived";

export interface HrFormTemplate {
  id: string;
  slug: string;
  title_en: string;
  title_ar: string | null;
  category: string | null;
  doc_no: string | null;
  department_owner: string | null;
  version: number;
  revision_no: string | null;
  revision_date: string | null;
  schema: HrTemplateSchema;
  status: HrTemplateStatus;
  is_system_seed: boolean;
  requires_approval: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type EmployeeStatus = "active" | "on_leave" | "terminated" | "resigned";
export type EmploymentType = "permanent" | "contract" | "part_time" | "probation";

export interface Employee {
  id: string;
  employee_no: string | null;
  full_name_en: string;
  full_name_ar: string | null;
  national_id: string | null;
  passport_no: string | null;
  nationality: string | null;
  gender: string | null;
  birth_date: string | null;
  marital_status: string | null;
  phone: string | null;
  personal_email: string | null;
  work_email: string | null;
  department: string | null;
  job_title: string | null;
  manager_employee_id: string | null;
  employment_type: EmploymentType | null;
  hire_date: string | null;
  end_of_service_date: string | null;
  base_salary: number | null;
  housing_allowance: number | null;
  transport_allowance: number | null;
  salary_currency: string;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_iban: string | null;
  status: EmployeeStatus;
  source_applicant_id: string | null;
  photo_url: string | null;
  extra: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type HrSubmissionStatus = "draft" | "submitted" | "approved" | "rejected" | "issued" | "cancelled";

/** A signature field's stored value: who signed and when (e-signature capture comes later). */
export interface SignatureValue {
  name?: string;
  date?: string;
}

export type HrTableRow = Record<string, string | number | null>;
export type HrFieldValue = string | number | boolean | null | SignatureValue | HrTableRow[];

export interface HrFormSubmission {
  id: string;
  template_id: string;
  employee_id: string | null;
  data: Record<string, HrFieldValue>;
  status: HrSubmissionStatus;
  requested_by: string;
  requested_by_email: string | null;
  approver_id: string | null;
  submitted_at: string | null;
  decided_by: string | null;
  decided_by_email: string | null;
  decided_at: string | null;
  rejection_reason: string | null;
  issued_at: string | null;
  issued_by: string | null;
  issued_file_pdf_url: string | null;
  issued_file_docx_url: string | null;
  issued_file_xlsx_url: string | null;
  issued_file_png_url: string | null;
  created_at: string;
  updated_at: string;
}
