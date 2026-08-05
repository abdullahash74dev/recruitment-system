// Download menu for a filled form: PDF, Excel (two-sheet formula-linked
// workbook), Word, PNG image, or all four bundled in a ZIP. Every export is
// recorded in the audit log.

import { useState } from "react";
import { Download, FileArchive, FileImage, FileSpreadsheet, FileText, FileType, Loader2 } from "lucide-react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { exportNodeToPdf, pdfBlobFromNode } from "@/lib/hrForms/exportPdf";
import { excelBlob, exportFormToExcel } from "@/lib/hrForms/exportExcel";
import { docxBlob, exportFormToDocx, triggerDownload } from "@/lib/hrForms/exportDocx";
import { exportNodeToImage, imageBlobFromNode } from "@/lib/hrForms/exportImage";
import type { ResolvedForm } from "@/lib/hrForms/templateEngine";
import { logAudit } from "@/lib/audit";

interface Props {
  resolved: ResolvedForm;
  /** Returns the print-styled DOM node to rasterize for PDF/PNG export. */
  getPrintNode: () => HTMLElement | null;
  lang: "en" | "ar";
}

export function exportBaseName(resolved: ResolvedForm): string {
  return `${resolved.template.doc_no || resolved.template.slug}${
    resolved.employee?.employee_no ? `-${resolved.employee.employee_no}` : ""
  }`;
}

/** All four formats as blobs — shared by the ZIP download and the issue flow. */
export async function buildAllFormatBlobs(
  resolved: ResolvedForm,
  printNode: HTMLElement,
  lang: "en" | "ar",
): Promise<Record<string, Blob>> {
  return {
    pdf: await pdfBlobFromNode(printNode),
    xlsx: excelBlob(resolved, lang),
    docx: await docxBlob(resolved, lang),
    png: await imageBlobFromNode(printNode),
  };
}

const ExportMenu = ({ resolved, getPrintNode, lang }: Props) => {
  const [busy, setBusy] = useState(false);
  const baseName = exportBaseName(resolved);

  const logExport = (format: string) =>
    logAudit({
      action: "EXPORT",
      summary: `HR form exported as ${format}: ${resolved.template.title_en}`,
      table_name: "hr_form_templates",
      record_id: resolved.template.id,
    });

  const withNode = async (fn: (node: HTMLElement) => Promise<void>) => {
    const node = getPrintNode();
    if (!node) {
      toast.error(lang === "ar" ? "تعذر تجهيز النموذج للطباعة" : "Print view is not ready");
      return;
    }
    setBusy(true);
    try {
      await fn(node);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = () => withNode(async (node) => {
    await exportNodeToPdf(node, `${baseName}.pdf`);
    logExport("PDF");
  });

  const downloadExcel = () => {
    try {
      exportFormToExcel(resolved, lang, `${baseName}.xlsx`);
      logExport("Excel");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Excel export failed");
    }
  };

  const downloadWord = async () => {
    setBusy(true);
    try {
      await exportFormToDocx(resolved, lang, `${baseName}.docx`);
      logExport("Word");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Word export failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadImage = () => withNode(async (node) => {
    await exportNodeToImage(node, `${baseName}.png`);
    logExport("Image");
  });

  const downloadAll = () => withNode(async (node) => {
    const blobs = await buildAllFormatBlobs(resolved, node, lang);
    const zip = new JSZip();
    for (const [format, blob] of Object.entries(blobs)) {
      zip.file(`${baseName}.${format}`, blob);
    }
    triggerDownload(await zip.generateAsync({ type: "blob" }), `${baseName}.zip`);
    logExport("ZIP (all formats)");
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Download className="h-4 w-4 me-2" />}
          {lang === "ar" ? "تحميل" : "Download"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={downloadPdf}>
          <FileText className="h-4 w-4 me-2" /> PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadExcel}>
          <FileSpreadsheet className="h-4 w-4 me-2" /> Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadWord}>
          <FileType className="h-4 w-4 me-2" /> Word
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadImage}>
          <FileImage className="h-4 w-4 me-2" /> {lang === "ar" ? "صورة PNG" : "PNG Image"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={downloadAll}>
          <FileArchive className="h-4 w-4 me-2" /> {lang === "ar" ? "الكل (ZIP)" : "All formats (ZIP)"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportMenu;
