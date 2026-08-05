// Excel bulk tooling:
//  - employee master import/export (upsert by employee_no)
//  - per-template bulk fill (one row per employee -> one draft submission)
//  - aggregate workbook across several templates (union of their fillable
//    fields, one column each) to hand to another department and re-import.

import * as XLSX from "xlsx";
import { allFields } from "./templateEngine";
import type { HrField, HrFieldValue, HrFormTemplate } from "./types";

// ---------------------------------------------------------------------------
// Employee master
// ---------------------------------------------------------------------------

/** Columns accepted by the employee import (header row uses these exact keys). */
export const EMPLOYEE_IMPORT_COLUMNS = [
  "employee_no", "full_name_en", "full_name_ar", "national_id", "passport_no",
  "nationality", "gender", "birth_date", "marital_status", "phone",
  "personal_email", "work_email", "department", "job_title", "employment_type",
  "hire_date", "base_salary", "housing_allowance", "transport_allowance",
  "bank_name", "bank_account_no", "bank_iban", "status",
] as const;

const NUMERIC_EMPLOYEE_COLUMNS = new Set(["base_salary", "housing_allowance", "transport_allowance"]);
const DATE_EMPLOYEE_COLUMNS = new Set(["birth_date", "hire_date"]);

export function downloadEmployeeTemplate(): void {
  const sheet = XLSX.utils.aoa_to_sheet([
    [...EMPLOYEE_IMPORT_COLUMNS],
    ["E-001", "Ahmed Ali", "أحمد علي", "1234567890", "", "Saudi", "male", "1990-01-15", "married",
     "0500000000", "", "ahmed@company.com", "IT", "Engineer", "permanent", "2022-03-01",
     10000, 2000, 500, "Al Rajhi", "", "SA0000000000000000000000", "active"],
  ]);
  sheet["!cols"] = EMPLOYEE_IMPORT_COLUMNS.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Employees");
  XLSX.writeFile(wb, "employees-import-template.xlsx");
}

function excelDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    // Excel serial date -> ISO
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export interface ParsedEmployeeRow {
  [key: string]: string | number | null;
}

export async function parseEmployeesFile(file: File): Promise<ParsedEmployeeRow[]> {
  const wb = XLSX.read(await file.arrayBuffer());
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  return raw
    .map((row) => {
      const out: ParsedEmployeeRow = {};
      for (const col of EMPLOYEE_IMPORT_COLUMNS) {
        const v = row[col];
        if (v === null || v === undefined || v === "") { out[col] = null; continue; }
        if (NUMERIC_EMPLOYEE_COLUMNS.has(col)) out[col] = Number(v) || null;
        else if (DATE_EMPLOYEE_COLUMNS.has(col)) out[col] = excelDate(v);
        else out[col] = String(v).trim();
      }
      return out;
    })
    .filter((r) => r.full_name_en);
}

// ---------------------------------------------------------------------------
// Per-template bulk fill
// ---------------------------------------------------------------------------

/** Fields a bulk-fill sheet needs a column for (everything typed per submission). */
export function bulkFillFields(template: HrFormTemplate): HrField[] {
  return allFields(template.schema).filter(
    (f) => f.source === "submission" && f.type !== "table" && f.type !== "signature",
  );
}

function guideSheet(fields: HrField[]): XLSX.WorkSheet {
  const rows: (string | null)[][] = [["Column", "Label (EN)", "Label (AR)", "Type", "Allowed values"]];
  for (const f of fields) {
    rows.push([
      f.key, f.label_en, f.label_ar ?? "", f.type,
      f.options ? f.options.map((o) => o.value).join(" | ") : (f.type === "date" ? "YYYY-MM-DD" : ""),
    ]);
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 24 }, { wch: 40 }, { wch: 32 }, { wch: 10 }, { wch: 40 }];
  return sheet;
}

export function downloadBulkFillTemplate(template: HrFormTemplate): void {
  const fields = bulkFillFields(template);
  const dataSheet = XLSX.utils.aoa_to_sheet([["employee_no", ...fields.map((f) => f.key)]]);
  dataSheet["!cols"] = [{ wch: 14 }, ...fields.map(() => ({ wch: 20 }))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataSheet, "Fill");
  XLSX.utils.book_append_sheet(wb, guideSheet(fields), "Guide");
  XLSX.writeFile(wb, `${template.doc_no || template.slug}-bulk-fill.xlsx`);
}

export interface BulkFillRow {
  employee_no: string | null;
  data: Record<string, HrFieldValue>;
}

export async function parseBulkFillFile(file: File, fields: HrField[]): Promise<BulkFillRow[]> {
  const wb = XLSX.read(await file.arrayBuffer());
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const byKey = new Map(fields.map((f) => [f.key, f]));
  return raw
    .map((row) => {
      const data: Record<string, HrFieldValue> = {};
      for (const [key, value] of Object.entries(row)) {
        if (key === "employee_no" || value === null || value === "") continue;
        const field = byKey.get(key);
        if (!field) continue;
        if (field.type === "number" || field.type === "currency") data[key] = Number(value) || null;
        else if (field.type === "date") data[key] = excelDate(value);
        else if (field.type === "checkbox") data[key] = ["yes", "true", "1", "نعم"].includes(String(value).toLowerCase());
        else data[key] = String(value).trim();
      }
      return {
        employee_no: row.employee_no ? String(row.employee_no).trim() : null,
        data,
      };
    })
    .filter((r) => r.employee_no || Object.keys(r.data).length > 0);
}

// ---------------------------------------------------------------------------
// Aggregate workbook across several templates
// ---------------------------------------------------------------------------

export interface AggregateField extends HrField {
  templates: string[]; // titles of templates needing this key
}

/** Union of fillable field keys across the chosen templates (deduped by key). */
export function aggregateFields(templates: HrFormTemplate[]): AggregateField[] {
  const merged = new Map<string, AggregateField>();
  for (const t of templates) {
    for (const f of bulkFillFields(t)) {
      const existing = merged.get(f.key);
      if (existing) existing.templates.push(t.title_en);
      else merged.set(f.key, { ...f, templates: [t.title_en] });
    }
  }
  return [...merged.values()];
}

export function downloadAggregateTemplate(templates: HrFormTemplate[]): void {
  const fields = aggregateFields(templates);
  const dataSheet = XLSX.utils.aoa_to_sheet([["employee_no", ...fields.map((f) => f.key)]]);
  dataSheet["!cols"] = [{ wch: 14 }, ...fields.map(() => ({ wch: 20 }))];

  const guideRows: (string | null)[][] = [["Column", "Label (EN)", "Needed by form(s)", "Type", "Allowed values"]];
  for (const f of fields) {
    guideRows.push([
      f.key, f.label_en, f.templates.join(", "), f.type,
      f.options ? f.options.map((o) => o.value).join(" | ") : (f.type === "date" ? "YYYY-MM-DD" : ""),
    ]);
  }
  const guide = XLSX.utils.aoa_to_sheet(guideRows);
  guide["!cols"] = [{ wch: 24 }, { wch: 40 }, { wch: 46 }, { wch: 10 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataSheet, "Data Collection");
  XLSX.utils.book_append_sheet(wb, guide, "Guide");
  XLSX.writeFile(wb, "hr-forms-data-collection.xlsx");
}
