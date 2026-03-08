/**
 * PDF Export — renders all slides as PNG then combines into a PDF presentation deck.
 * Uses jsPDF for client-side PDF generation.
 */

import type { DesignSpec } from "./types";

/** Default canvas dimensions. */
const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1350;

interface PdfExportOptions {
  /** Optional title for the PDF document. */
  title?: string;
  /** Quality 0–1 for JPEG compression (default 0.92). Using JPEG inside PDF for smaller file size. */
  quality?: number;
  /** Optional progress callback (0–1). */
  onProgress?: (progress: number) => void;
}

/**
 * Render all slides via the /api/design/render endpoint and combine into a single PDF.
 * Returns a Blob of the PDF file.
 */
export async function exportDeckToPdf(
  spec: DesignSpec,
  opts?: PdfExportOptions,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");

  const canvasW = spec.canvasSize?.width ?? DEFAULT_WIDTH;
  const canvasH = spec.canvasSize?.height ?? DEFAULT_HEIGHT;
  const isLandscape = canvasW > canvasH;

  // PDF page size in mm (A4-ish but matching aspect ratio)
  const PDF_MAX_W = 297; // mm (A4 landscape width)
  const PDF_MAX_H = 210; // mm (A4 landscape height)
  const aspect = canvasW / canvasH;

  let pageW: number;
  let pageH: number;
  if (isLandscape) {
    pageW = PDF_MAX_W;
    pageH = pageW / aspect;
    if (pageH > PDF_MAX_H) {
      pageH = PDF_MAX_H;
      pageW = pageH * aspect;
    }
  } else {
    pageH = PDF_MAX_W; // use the longer dimension for height
    pageW = pageH * aspect;
    if (pageW > PDF_MAX_H) {
      pageW = PDF_MAX_H;
      pageH = pageW / aspect;
    }
  }

  const orientation = isLandscape ? "landscape" : "portrait";
  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: [pageW, pageH],
  });

  if (opts?.title) {
    doc.setProperties({ title: opts.title });
  }

  const total = spec.slides.length;

  for (let i = 0; i < total; i++) {
    if (i > 0) doc.addPage([pageW, pageH], orientation);

    const slide = spec.slides[i]!;
    const fetchBody = slide.customHtml
      ? {
          rawHtml: slide.customHtml,
          heroImageDataUri: slide.heroImageDataUri,
          fontMood: spec.fontMood,
          canvasSize: spec.canvasSize,
          heroImageFit: spec.heroImageFit,
        }
      : {
          slide,
          globalStyle: spec.globalStyle,
          fontMood: spec.fontMood,
          canvasSize: spec.canvasSize,
          heroImageFit: spec.heroImageFit,
        };

    const res = await fetch("/api/design/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fetchBody),
    });

    if (!res.ok) continue;
    const data = (await res.json()) as { png: string };
    const imgData = data.png; // data:image/png;base64,...

    doc.addImage(imgData, "PNG", 0, 0, pageW, pageH, undefined, "FAST");

    opts?.onProgress?.((i + 1) / total);
  }

  return doc.output("blob");
}

/**
 * Trigger browser download of a PDF blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
