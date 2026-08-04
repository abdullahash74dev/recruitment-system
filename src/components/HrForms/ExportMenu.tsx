// Download menu for a filled form: PDF (rasterized print view) and Excel
// (two-sheet data-entry + formula-linked workbook). Word/Image arrive in a
// later phase. Every export is recorded in the audit log.

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { exportNodeToPdf } from "@/lib/hrForms/exportPdf";
import { exportFormToExcel } from "@/lib/hrForms/exportExcel";
import type { ResolvedForm } from "@/lib/hrForms/templateEngine";
import { logAudit } from "@/lib/audit";

interface Props {
  resolved: ResolvedForm;
  /** Returns the print-styled DOM node to rasterize for PDF export. */
  getPrintNode: () => HTMLElement | null;
  lang: "en" | "ar";
}

const ExportMenu = ({ resolved, getPrintNode, lang }: Props) => {
  const [busy, setBusy] = useState(false);
  const baseName = `${resolved.template.doc_no || resolved.template.slug}${
    resolved.employee?.employee_no ? `-${resolved.employee.employee_no}` : ""
  }`;

  const logExport = (format: string) =>
    logAudit({
      action: "EXPORT",
      summary: `HR form exported as ${format}: ${resolved.template.title_en}`,
      table_name: "hr_form_templates",
      record_id: resolved.template.id,
    });

  const downloadPdf = async () => {
    const node = getPrintNode();
    if (!node) {
      toast.error(lang === "ar" ? "تعذر تجهيز النموذج للطباعة" : "Print view is not ready");
      return;
    }
    setBusy(true);
    try {
      await exportNodeToPdf(node, `${baseName}.pdf`);
      logExport("PDF");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadExcel = () => {
    try {
      exportFormToExcel(resolved, lang, `${baseName}.xlsx`);
      logExport("Excel");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Excel export failed");
    }
  };

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
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportMenu;
