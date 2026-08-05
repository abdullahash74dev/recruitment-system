// Word export via the `docx` package: rebuilds the form as a clean,
// table-based bilingual document from the same resolved object the other
// exporters consume, so content always matches PDF/Excel (layout is a tidy
// Word-native approximation, not a pixel clone of the rasterized PDF).

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ResolvedForm } from "./templateEngine";
import { formatFieldValue } from "./templateEngine";
import type { HrField, HrTableRow } from "./types";

const label = (f: { label_en: string; label_ar?: string }, lang: "en" | "ar") =>
  (lang === "ar" && f.label_ar) || f.label_en;

const cellText = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
  new Paragraph({
    children: [new TextRun({ text: text || " ", bold: opts.bold, size: opts.size ?? 20 })],
  });

const labelValueRow = (l: string, v: string) =>
  new TableRow({
    children: [
      new TableCell({
        width: { size: 40, type: WidthType.PERCENTAGE },
        shading: { fill: "F3F4F6" },
        children: [cellText(l, { bold: true })],
      }),
      new TableCell({
        width: { size: 60, type: WidthType.PERCENTAGE },
        children: [cellText(v)],
      }),
    ],
  });

const fullWidthTable = (rows: TableRow[]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "9CA3AF" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "9CA3AF" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "9CA3AF" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "9CA3AF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" },
    },
    rows,
  });

export async function docxBlob(resolved: ResolvedForm, lang: "en" | "ar"): Promise<Blob> {
  const { template, values, branding } = resolved;
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: branding.companyNameEn, bold: true, size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: branding.companyNameAr, size: 24, color: "555555" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({ text: (lang === "ar" && template.title_ar) || template.title_en, bold: true, size: 28 }),
      ],
    }),
    fullWidthTable([
      new TableRow({
        children: [
          `${lang === "ar" ? "رقم النموذج" : "Doc No."}: ${template.doc_no ?? "—"}`,
          `${lang === "ar" ? "المراجعة" : "Rev."}: ${template.revision_no ?? template.version}`,
          `${lang === "ar" ? "تاريخ المراجعة" : "Rev. Date"}: ${template.revision_date ?? "—"}`,
          `${lang === "ar" ? "الإدارة" : "Department"}: ${template.department_owner ?? "—"}`,
        ].map((t) => new TableCell({ children: [cellText(t, { size: 16 })] })),
      }),
    ]),
    new Paragraph({ text: "" }),
  );

  for (const section of template.schema.sections ?? []) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: (lang === "ar" && section.title_ar) || section.title_en,
            bold: true,
            size: 24,
          }),
        ],
        spacing: { before: 200, after: 80 },
      }),
    );
    const note = lang === "ar" ? section.note_ar || section.note_en : section.note_en;
    if (note) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: note, italics: true, size: 18, color: "555555" })],
          spacing: { after: 80 },
        }),
      );
    }

    const simpleFields = (section.fields ?? []).filter((f) => f.type !== "table");
    if (simpleFields.length > 0) {
      children.push(
        fullWidthTable(simpleFields.map((f) => labelValueRow(fieldLabelBilingual(f, lang), formatFieldValue(f, values[f.key] ?? null, lang)))),
      );
    }

    for (const field of (section.fields ?? []).filter((f) => f.type === "table")) {
      const rows = (Array.isArray(values[field.key]) ? values[field.key] : []) as HrTableRow[];
      const columns = field.columns ?? [];
      children.push(
        new Paragraph({
          children: [new TextRun({ text: label(field, lang), bold: true, size: 20 })],
          spacing: { before: 120, after: 60 },
        }),
        fullWidthTable([
          new TableRow({
            children: columns.map((c) => new TableCell({ shading: { fill: "F3F4F6" }, children: [cellText(label(c, lang), { bold: true })] })),
          }),
          ...(rows.length > 0 ? rows : [{}]).map(
            (row) =>
              new TableRow({
                children: columns.map((c) =>
                  new TableCell({ children: [cellText(row?.[c.key] === null || row?.[c.key] === undefined ? "" : String(row[c.key]))] }),
                ),
              }),
          ),
        ]),
      );
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
    creator: branding.companyNameEn,
    title: template.title_en,
  });
  return Packer.toBlob(doc);
}

function fieldLabelBilingual(field: HrField, lang: "en" | "ar"): string {
  if (lang === "ar") return field.label_ar || field.label_en;
  return field.label_ar ? `${field.label_en} — ${field.label_ar}` : field.label_en;
}

export async function exportFormToDocx(resolved: ResolvedForm, lang: "en" | "ar", fileName: string): Promise<void> {
  const blob = await docxBlob(resolved, lang);
  triggerDownload(blob, fileName);
}

export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
