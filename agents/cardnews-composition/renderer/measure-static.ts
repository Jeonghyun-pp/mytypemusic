/**
 * Static measurement wrappers that parse HTML inline styles and data-*
 * attributes to compute overflow / safe-area / QA without a browser.
 *
 * Drop-in replacements for the Playwright-based measure.ts and qa.ts.
 */
import { readFile } from "node:fs/promises";
import { estimateOverflow } from "./measure-heuristic.js";
import { computeSlideQa, computeSafeArea } from "./qa-static.js";
import type { BoxDef, QaMeasurement, SlideQaResult, SlideOverflow } from "./qa-static.js";

// Re-export types that compose.ts needs
export type { QaMeasurement, SlideQaResult, SlideOverflow };

export interface OverflowResult {
  titleOverflow: boolean;
  subtitleOverflow: boolean;
}

// ============================================================================
// HTML parsing helpers
// ============================================================================

/** Extract a data-attribute value from an element with given id */
function dataAttr(html: string, id: string, attr: string): number {
  const re = new RegExp(`id="${id}"[^>]*data-${attr}="(\\d+)"`, "i");
  const m = html.match(re);
  if (m) return parseInt(m[1]!, 10);
  // Try reversed order (data-attr before id)
  const re2 = new RegExp(`data-${attr}="(\\d+)"[^>]*id="${id}"`, "i");
  const m2 = html.match(re2);
  return m2 ? parseInt(m2[1]!, 10) : 0;
}

/** Extract inline style property value (px) from an element with given id */
function stylePx(html: string, id: string, prop: string): number {
  const re = new RegExp(`id="${id}"[^>]*style="([^"]*)"`, "i");
  const m = html.match(re);
  if (!m) {
    // Try reversed order
    const re2 = new RegExp(`style="([^"]*)"[^>]*id="${id}"`, "i");
    const m2 = html.match(re2);
    if (!m2) return 0;
    return extractPxFromStyle(m2[1]!, prop);
  }
  return extractPxFromStyle(m[1]!, prop);
}

function extractPxFromStyle(styleStr: string, prop: string): number {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*(-?[\\d.]+)px`, "i");
  const m = styleStr.match(re);
  return m ? parseFloat(m[1]!) : 0;
}

/** Extract text content from an element with given id (strip inner tags) */
function textContent(html: string, id: string): string {
  // Match opening tag with id → content → closing tag
  const re = new RegExp(`<[^>]*id="${id}"[^>]*>([\\s\\S]*?)</`, "i");
  const m = html.match(re);
  if (!m) return "";
  // Strip inner HTML tags
  return m[1]!.replace(/<[^>]*>/g, "").trim();
}

/** Extract font-size from style of element with given id */
function fontSize(html: string, id: string): number {
  return stylePx(html, id, "font-size");
}

/** Extract line-height from style of element with given id (defaults to 1.3) */
function lineHeight(html: string, id: string): number {
  const re = new RegExp(`id="${id}"[^>]*style="([^"]*)"`, "i");
  const m = html.match(re);
  if (!m) return 1.3;
  const lhRe = /line-height\s*:\s*([\d.]+)/i;
  const lhm = m[1]!.match(lhRe);
  return lhm ? parseFloat(lhm[1]!) : 1.3;
}

/** Extract box position from inline style */
function extractBox(html: string, id: string): BoxDef | null {
  const x = stylePx(html, id, "left");
  const y = stylePx(html, id, "top");
  const width = stylePx(html, id, "width");
  const height = stylePx(html, id, "height");
  if (width === 0 && height === 0) return null;
  return { id: id.replace("box-", ""), x, y, width, height };
}

// ============================================================================
// Public API (same signatures as Playwright versions)
// ============================================================================

/**
 * Measure whether title / subtitle text overflows its bounding box.
 * Drop-in replacement for measureOverflow() from measure.ts.
 */
export async function measureOverflow(htmlPath: string): Promise<OverflowResult> {
  const html = await readFile(htmlPath, "utf-8");

  const titleText = textContent(html, "box-title");
  const subtitleText = textContent(html, "box-subtitle");

  const titleW = dataAttr(html, "box-title", "bbox-w") || stylePx(html, "box-title", "width");
  const titleH = dataAttr(html, "box-title", "bbox-h") || stylePx(html, "box-title", "height");
  const titleFs = fontSize(html, "box-title") || 64;
  const titleLh = lineHeight(html, "box-title");

  const subtitleW = dataAttr(html, "box-subtitle", "bbox-w") || stylePx(html, "box-subtitle", "width");
  const subtitleH = dataAttr(html, "box-subtitle", "bbox-h") || stylePx(html, "box-subtitle", "height");
  const subtitleFs = fontSize(html, "box-subtitle") || 32;
  const subtitleLh = lineHeight(html, "box-subtitle");

  const titleOv = titleText
    ? estimateOverflow({
        text: titleText,
        containerWidthPx: titleW,
        containerHeightPx: titleH,
        fontSizePx: titleFs,
        lineHeight: titleLh,
      })
    : { overflows: false };

  const subtitleOv = subtitleText
    ? estimateOverflow({
        text: subtitleText,
        containerWidthPx: subtitleW,
        containerHeightPx: subtitleH,
        fontSizePx: subtitleFs,
        lineHeight: subtitleLh,
      })
    : { overflows: false };

  return {
    titleOverflow: titleOv.overflows,
    subtitleOverflow: subtitleOv.overflows,
  };
}

/**
 * Measure safe-area / footer-zone violations.
 * Drop-in replacement for measureSafeAreaAndFooter() from qa.ts.
 */
export async function measureSafeAreaAndFooter(htmlPath: string): Promise<QaMeasurement> {
  const html = await readFile(htmlPath, "utf-8");

  const safeArea = {
    top: dataAttr(html, "canvas", "safe-top"),
    bottom: dataAttr(html, "canvas", "safe-bottom"),
    left: dataAttr(html, "canvas", "safe-left"),
    right: dataAttr(html, "canvas", "safe-right"),
  };
  const footerZoneH = dataAttr(html, "canvas", "footer-zone-h") || 220;

  const boxes: BoxDef[] = [];
  for (const id of ["box-title", "box-subtitle", "box-footer"]) {
    const box = extractBox(html, id);
    if (box) boxes.push(box);
  }

  return computeSafeArea({ safeArea, footerZoneH, boxes });
}

/**
 * Combined slide QA: safe-area/footer + text overflow for all slide types.
 * Drop-in replacement for measureSlideQa() from qa.ts.
 */
export async function measureSlideQa(htmlPath: string): Promise<SlideQaResult> {
  const html = await readFile(htmlPath, "utf-8");

  const safeArea = {
    top: dataAttr(html, "canvas", "safe-top"),
    bottom: dataAttr(html, "canvas", "safe-bottom"),
    left: dataAttr(html, "canvas", "safe-left"),
    right: dataAttr(html, "canvas", "safe-right"),
  };
  const footerZoneH = dataAttr(html, "canvas", "footer-zone-h") || 220;

  // Extract all known box positions
  const boxes: BoxDef[] = [];
  for (const id of ["box-title", "box-subtitle", "box-footer", "box-headline", "box-body", "box-cta"]) {
    const box = extractBox(html, id);
    if (box) boxes.push(box);
  }

  // Estimate text overflow for each slot
  const overflowIds = [
    { key: "title", id: "box-title" },
    { key: "subtitle", id: "box-subtitle" },
    { key: "headline", id: "box-headline" },
    { key: "body", id: "box-body" },
    { key: "cta", id: "box-cta" },
  ];

  const textOverflows: Record<string, boolean> = {};

  for (const { key, id } of overflowIds) {
    const text = textContent(html, id);
    if (!text) continue;

    const w = dataAttr(html, id, "bbox-w") || stylePx(html, id, "width");
    const h = dataAttr(html, id, "bbox-h") || stylePx(html, id, "height");
    const fs = fontSize(html, id);
    const lh = lineHeight(html, id);

    if (w > 0 && h > 0 && fs > 0) {
      const ov = estimateOverflow({
        text,
        containerWidthPx: w,
        containerHeightPx: h,
        fontSizePx: fs,
        lineHeight: lh,
      });
      textOverflows[key] = ov.overflows;
    }
  }

  return computeSlideQa({ safeArea, footerZoneH, boxes, textOverflows });
}
