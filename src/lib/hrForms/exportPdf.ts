// PDF export: rasterize the print-styled DOM node (the same FormRenderer the
// user sees on screen, so PDF output is WYSIWYG for bilingual/RTL layouts
// jspdf-autotable can't represent) and paginate it into an A4 jsPDF document.

import { toCanvas } from "html-to-image";
import jsPDF from "jspdf";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 8;

async function buildPdf(node: HTMLElement): Promise<jsPDF> {
  const canvas = await toCanvas(node, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    // Skip cross-origin stylesheets (e.g. Google Fonts) html-to-image can't
    // read; inline Tailwind styles are what actually matter for layout.
    skipFonts: true,
  });

  const contentWidthMm = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
  const contentHeightMm = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2;
  const pxPerMm = canvas.width / contentWidthMm;
  const pageHeightPx = Math.floor(contentHeightMm * pxPerMm);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageCount = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

  for (let page = 0; page < pageCount; page++) {
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - page * pageHeightPx);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceHeightPx;
    const ctx = slice.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, page * pageHeightPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

    if (page > 0) pdf.addPage();
    pdf.addImage(
      slice.toDataURL("image/png"),
      "PNG",
      PAGE_MARGIN_MM,
      PAGE_MARGIN_MM,
      contentWidthMm,
      sliceHeightPx / pxPerMm,
    );
  }

  return pdf;
}

export async function exportNodeToPdf(node: HTMLElement, fileName: string): Promise<void> {
  (await buildPdf(node)).save(fileName);
}

export async function pdfBlobFromNode(node: HTMLElement): Promise<Blob> {
  return (await buildPdf(node)).output("blob");
}
