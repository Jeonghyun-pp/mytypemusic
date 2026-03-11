/**
 * Satori HTML Sanitizer — fixes LLM-generated HTML for Satori compatibility.
 *
 * Satori (Vercel) uses Yoga layout (Flexbox only) and has strict limitations.
 * This module post-processes HTML strings to strip/fix unsupported features
 * before they reach the renderer, preventing crashes.
 *
 * Fixes applied:
 *   1. Remove unsupported CSS properties from inline styles
 *   2. Remove/convert unsupported HTML elements (<br>, <hr>, <style>, <script>)
 *   3. Remove class/className attributes
 *   4. Ensure <img> has explicit width + height
 *   5. Convert rem/em units to px
 *   6. Add display:flex where missing on container elements
 *   7. Strip CSS Grid properties
 */

import { SATORI_SUPPORTED_CSS } from "./fonts";

// ── Unsupported CSS (kebab-case set for fast matching) ──

const SUPPORTED_SET = new Set(
  SATORI_SUPPORTED_CSS.map((p) => camelToKebab(p)),
);

// Additional shorthand properties Satori supports
const EXTRA_SUPPORTED = new Set([
  "flex", "flex-flow",
  "border-top-left-radius", "border-top-right-radius",
  "border-bottom-left-radius", "border-bottom-right-radius",
  "background-color", "background-image",
  "border-width", "border-color", "border-style",
  "font-family", "font-size", "font-weight", "font-style",
  "text-align", "text-decoration", "text-transform",
  "line-height", "letter-spacing", "word-break",
  "white-space", "text-overflow",
  "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis",
  "align-items", "align-self", "justify-content",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "min-width", "min-height", "max-width", "max-height",
  "box-shadow", "text-shadow",
  "object-fit",
]);

function isSupportedProperty(kebabProp: string): boolean {
  return SUPPORTED_SET.has(kebabProp) || EXTRA_SUPPORTED.has(kebabProp);
}

// ── Helpers ─────────────────────────────────────────────

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Convert rem/em values to px (assume 16px base). */
function convertUnits(value: string): string {
  return value.replace(
    /(\d+(?:\.\d+)?)(rem|em)/g,
    (_, num) => `${String(Math.round(parseFloat(num as string) * 16))}px`,
  );
}

// ── CSS property filter ─────────────────────────────────

/**
 * Filter a CSS style string, keeping only Satori-supported properties.
 * Also converts rem/em → px.
 */
function sanitizeStyleString(style: string): string {
  const pairs = style.split(";").map((s) => s.trim()).filter(Boolean);
  const kept: string[] = [];

  for (const pair of pairs) {
    const colonIdx = pair.indexOf(":");
    if (colonIdx < 0) continue;

    const prop = pair.slice(0, colonIdx).trim().toLowerCase();
    let value = pair.slice(colonIdx + 1).trim();

    if (!isSupportedProperty(prop)) continue;

    // Convert rem/em → px
    value = convertUnits(value);

    kept.push(`${prop}:${value}`);
  }

  // Ensure display:flex exists
  if (!kept.some((p) => p.startsWith("display:"))) {
    kept.unshift("display:flex");
  }

  return kept.join(";");
}

// ── HTML tag sanitization ───────────────────────────────

/** Remove <style>, <script> blocks entirely. */
function removeBlockTags(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
}

/** Convert <br> to spacing div, remove <hr>. */
function replaceInlineTags(html: string): string {
  // <br> / <br/> → small spacing div
  html = html.replace(/<br\s*\/?>/gi, '<div style="display:flex;height:8px"></div>');
  // <hr> / <hr/> → thin border div
  html = html.replace(
    /<hr\s*\/?>/gi,
    '<div style="display:flex;width:100%;height:1px;background-color:#ccc;margin:8px 0"></div>',
  );
  return html;
}

/** Remove class/className attributes. */
function removeClassAttributes(html: string): string {
  return html.replace(/\s+(class|className)\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi, "");
}

/** Ensure <img> tags have width and height. */
function fixImgTags(html: string): string {
  return html.replace(/<img\s([^>]*?)\/?\s*>/gi, (match, attrs: string) => {
    const hasWidth = /width\s*[:=]/i.test(attrs);
    const hasHeight = /height\s*[:=]/i.test(attrs);

    if (hasWidth && hasHeight) return match;

    // Add default dimensions if missing
    let fixedAttrs = attrs;
    if (!hasWidth) fixedAttrs += ' width="200"';
    if (!hasHeight) fixedAttrs += ' height="200"';

    return `<img ${fixedAttrs.trim()} />`;
  });
}

// ── Style attribute processor ───────────────────────────

/** Process all style="..." attributes in the HTML, filtering unsupported CSS. */
function processStyles(html: string): string {
  return html.replace(
    /style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
    (_, dq: string | undefined, sq: string | undefined) => `style="${sanitizeStyleString(dq ?? sq ?? "")}"`,
  );
}

// ── Main function ───────────────────────────────────────

/**
 * Sanitize HTML for Satori compatibility.
 *
 * Call this on LLM-generated HTML before passing to the render pipeline.
 * Safe to call on already-valid HTML (no-op for compliant content).
 */
export function sanitizeForSatori(html: string): string {
  if (!html || !html.trim()) return html;

  let result = html;

  // 1. Remove <style>/<script> blocks
  result = removeBlockTags(result);

  // 2. Convert <br>/<hr> to Satori-compatible divs
  result = replaceInlineTags(result);

  // 3. Remove class/className attributes
  result = removeClassAttributes(result);

  // 4. Fix <img> tags (ensure width/height)
  result = fixImgTags(result);

  // 5. Process all style attributes (filter unsupported CSS, convert units)
  result = processStyles(result);

  return result;
}

/**
 * Validate HTML and return a list of issues found (for logging/debugging).
 * Does NOT modify the HTML.
 */
export function validateForSatori(html: string): string[] {
  const issues: string[] = [];

  if (/<style[\s>]/i.test(html)) issues.push("<style> tag found");
  if (/<script[\s>]/i.test(html)) issues.push("<script> tag found");
  if (/<br\s*\/?>/i.test(html)) issues.push("<br> tag found");
  if (/<hr\s*\/?>/i.test(html)) issues.push("<hr> tag found");
  if (/class\s*=/i.test(html)) issues.push("class attribute found");
  if (/\d+rem/i.test(html)) issues.push("rem unit found");
  if (/\d+em[^;]/i.test(html)) issues.push("em unit found");

  // Check for unsupported CSS in style attributes
  const styleMatches = html.matchAll(/style\s*=\s*"([^"]*)"/gi);
  for (const m of styleMatches) {
    const style = m[1]!;
    const pairs = style.split(";").map((s) => s.trim()).filter(Boolean);
    for (const pair of pairs) {
      const prop = pair.slice(0, pair.indexOf(":")).trim().toLowerCase();
      if (prop && !isSupportedProperty(prop)) {
        issues.push(`Unsupported CSS: ${prop}`);
      }
    }
  }

  // Check <img> without dimensions
  const imgMatches = html.matchAll(/<img\s([^>]*?)\/?\s*>/gi);
  for (const m of imgMatches) {
    const attrs = m[1]!;
    if (!/width/i.test(attrs)) issues.push("<img> missing width");
    if (!/height/i.test(attrs)) issues.push("<img> missing height");
  }

  return issues;
}
