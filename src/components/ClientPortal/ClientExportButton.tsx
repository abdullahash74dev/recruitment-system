import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { fetchAllRevealedCandidates, exportRevealedToExcel } from "@/lib/clientPortalExport";
import { exportNodeToPdf } from "@/lib/hrForms/exportPdf";
import ClientRevealedPrintTable from "@/components/ClientPortal/ClientRevealedPrintTable";
import type { ClientRevealedRow } from "@/hooks/queries/useClientPortalSearch";

interface ClientExportButtonProps {
  lang: "ar" | "en";
}

/**
 * Exports the org's FULL revealed-candidates history (not just the current
 * page) to Excel or PDF. PDF rasterizes an off-screen print table rather
 * than drawing text natively -- see ClientRevealedPrintTable's comment for
 * why (jsPDF in this project never got Arabic font shaping set up).
 */
export default function ClientExportButton({ lang }: ClientExportButtonProps) {
  const ar = lang === "ar";
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);
  const [printRows, setPrintRows] = useState<ClientRevealedRow[] | null>(null);
  const printNodeRef = useRef<HTMLDivElement>(null);

  const runExcel = async () => {
    setBusy("excel");
    try {
      const rows = await fetchAllRevealedCandidates();
      if (rows.length === 0) {
        toast.error(ar ? "لا يوجد مرشحون مكشوفون للتصدير" : "No revealed candidates to export");
        return;
      }
      exportRevealedToExcel(rows, lang);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (ar ? "تعذر التصدير" : "Export failed"));
    } finally {
      setBusy(null);
    }
  };

  const runPdf = async () => {
    setBusy("pdf");
    try {
      const rows = await fetchAllRevealedCandidates();
      if (rows.length === 0) {
        toast.error(ar ? "لا يوجد مرشحون مكشوفون للتصدير" : "No revealed candidates to export");
        return;
      }
      // Mount the print table off-screen, wait a tick for layout/paint,
      // rasterize it, then unmount -- html-to-image needs a real painted
      // node, not display:none.
      setPrintRows(rows);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (printNodeRef.current) {
        const ts = new Date().toISOString().slice(0, 10);
        await exportNodeToPdf(printNodeRef.current, `revealed-candidates-${ts}.pdf`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (ar ? "تعذر التصدير" : "Export failed"));
    } finally {
      setPrintRows(null);
      setBusy(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={!!busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {ar ? "تصدير" : "Export"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={runExcel} disabled={!!busy}>
            <FileSpreadsheet className="h-3.5 w-3.5 ms-1.5" />
            {ar ? "تصدير Excel" : "Export Excel"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={runPdf} disabled={!!busy}>
            <FileText className="h-3.5 w-3.5 ms-1.5" />
            {ar ? "تصدير PDF" : "Export PDF"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {printRows &&
        createPortal(
          <div style={{ position: "fixed", top: 0, insetInlineStart: -99999, zIndex: -1 }}>
            <div ref={printNodeRef}>
              <ClientRevealedPrintTable lang={lang} rows={printRows} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
