// Excel export: one workbook per form with two linked sheets.
//   "Data Entry" — flat field/value rows where raw data is typed or pasted.
//   "Form"      — the printable, document-controlled layout whose value cells
//                 are formulas referencing Data Entry, so edits there re-flow
//                 into the styled sheet automatically.

import * as XLSX from "xlsx";
import type { ResolvedForm } from "./templateEngine";
import { formatFieldValue } from "./templateEngine";
import type { HrField, HrTableRow } from "./types";

type Cell = string | number | boolean | null | { f: string };
const DATA_SHEET = "Data Entry";
const FORM_SHEET = "Form";
const VALUE_COL = "D";

interface DataEntryRef {
  /** 1-based row in the Data Entry sheet holding this field's value. */
  row: number;
}

export function exportFormToExcel(resolved: ResolvedForm, lang: "en" | "ar", fileName: string): void {
  const { template, values, branding } = resolved;

  // ---- Sheet 1: Data Entry -------------------------------------------------
  const dataRows: Cell[][] = [["Field Key", "Label (EN)", "Label (AR)", "Value"]];
  const refs = new Map<string, DataEntryRef>();
  const tableRefs = new Map<string, { startRow: number; rowCount: number; colOrder: string[] }>();

  for (const section of template.schema.sections ?? []) {
    for (const field of section.fields ?? []) {
      const value = values[field.key];
      if (field.type === "table") {
        const rows = (Array.isArray(value) ? value : []) as HrTableRow[];
        const colOrder = (field.columns ?? []).map((c) => c.key);
        const startRow = dataRows.length + 1;
        rows.forEach((row, i) => {
          for (const col of field.columns ?? []) {
            dataRows.push([
              `${field.key}[${i}].${col.key}`,
              `${field.label_en} #${i + 1} — ${col.label_en}`,
              col.label_ar ? `${field.label_ar ?? ""} — ${col.label_ar}` : "",
              (row?.[col.key] ?? "") as Cell,
            ]);
          }
        });
        tableRefs.set(field.key, { startRow, rowCount: rows.length, colOrder });
      } else {
        dataRows.push([
          field.key,
          field.label_en,
          field.label_ar ?? "",
          toDataEntryValue(field, value, lang),
        ]);
        refs.set(field.key, { row: dataRows.length });
      }
    }
  }

  const dataSheet = XLSX.utils.aoa_to_sheet(dataRows);
  dataSheet["!cols"] = [{ wch: 28 }, { wch: 44 }, { wch: 36 }, { wch: 30 }];

  // ---- Sheet 2: Form (printable, formula-linked) ---------------------------
  const formRows: Cell[][] = [];
  const merges: XLSX.Range[] = [];
  const mergeRow = (rowIdx: number, from = 0, to = 3) => {
    merges.push({ s: { r: rowIdx, c: from }, e: { r: rowIdx, c: to } });
  };

  const companyName = lang === "ar" ? branding.companyNameAr : branding.companyNameEn;
  formRows.push([companyName, null, null, null]);
  mergeRow(0);
  formRows.push([
    (lang === "ar" && template.title_ar) || template.title_en,
    null,
    `${lang === "ar" ? "رقم النموذج" : "Doc No."}: ${template.doc_no ?? "—"}`,
    `${lang === "ar" ? "مراجعة" : "Rev."}: ${template.revision_no ?? template.version}`,
  ]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 1 } });
  formRows.push([]);

  const ref = (key: string) => `'${DATA_SHEET}'!${VALUE_COL}${refs.get(key)?.row ?? 0}`;

  for (const section of template.schema.sections ?? []) {
    const rowIdx = formRows.length;
    formRows.push([(lang === "ar" && section.title_ar) || section.title_en, null, null, null]);
    mergeRow(rowIdx);
    const note = lang === "ar" ? section.note_ar || section.note_en : section.note_en;
    if (note) {
      const noteIdx = formRows.length;
      formRows.push([note, null, null, null]);
      mergeRow(noteIdx);
    }

    // Non-table fields flow two per row: Label | Value | Label | Value.
    const pairFields = (section.fields ?? []).filter((f) => f.type !== "table");
    for (let i = 0; i < pairFields.length; i += 2) {
      const left = pairFields[i];
      const right = pairFields[i + 1];
      formRows.push([
        fieldLabel(left, lang),
        refs.has(left.key) ? { f: ref(left.key) } : null,
        right ? fieldLabel(right, lang) : null,
        right && refs.has(right.key) ? { f: ref(right.key) } : null,
      ]);
    }

    for (const field of (section.fields ?? []).filter((f) => f.type === "table")) {
      const info = tableRefs.get(field.key);
      if (!info) continue;
      const headerIdx = formRows.length;
      formRows.push([fieldLabel(field, lang), null, null, null]);
      mergeRow(headerIdx);
      formRows.push((field.columns ?? []).map((c) => ((lang === "ar" && c.label_ar) || c.label_en) as Cell));
      for (let r = 0; r < info.rowCount; r++) {
        formRows.push(
          info.colOrder.map((_, cIdx) => ({
            f: `'${DATA_SHEET}'!${VALUE_COL}${info.startRow + r * info.colOrder.length + cIdx}`,
          })),
        );
      }
    }
    formRows.push([]);
  }

  const formSheet = XLSX.utils.aoa_to_sheet(formRows);
  formSheet["!cols"] = [{ wch: 34 }, { wch: 26 }, { wch: 34 }, { wch: 26 }];
  formSheet["!merges"] = merges;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, formSheet, FORM_SHEET);
  XLSX.utils.book_append_sheet(wb, dataSheet, DATA_SHEET);
  XLSX.writeFile(wb, fileName);
}

function fieldLabel(field: HrField, lang: "en" | "ar"): string {
  return (lang === "ar" && field.label_ar) || field.label_en;
}

/**
 * Data Entry stores human-editable values: option labels instead of raw
 * values, formatted signatures, numbers as numbers.
 */
function toDataEntryValue(field: HrField, value: ResolvedForm["values"][string], lang: "en" | "ar"): Cell {
  if (value === null || value === undefined) return "";
  if (field.type === "number" || field.type === "currency" || (field.type === "computed" && typeof value === "number")) {
    return typeof value === "number" ? value : (Number(value) || "");
  }
  return formatFieldValue(field, value, lang);
}
