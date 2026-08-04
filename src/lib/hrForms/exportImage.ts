// PNG export: same print-node rasterization the PDF path uses, minus the PDF
// wrapping — so the image always matches the PDF pixel for pixel.

import { toBlob } from "html-to-image";
import { triggerDownload } from "./exportDocx";

export async function imageBlobFromNode(node: HTMLElement): Promise<Blob> {
  const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: "#ffffff", skipFonts: true });
  if (!blob) throw new Error("Image capture failed");
  return blob;
}

export async function exportNodeToImage(node: HTMLElement, fileName: string): Promise<void> {
  triggerDownload(await imageBlobFromNode(node), fileName);
}
