/**
 * Figma SVG Template Renderer
 *
 * Loads Figma-exported SVG templates, replaces placeholder text/images/colors,
 * and rasterises to PNG via resvg-js.
 *
 * Template convention:
 * - Text layers in Figma named `{{title}}`, `{{body}}`, etc. → become `id="{{title}}"` in SVG
 * - Image layers named `{{hero-image}}` → `<image id="{{hero-image}}" ...>`
 * - Color-swap elements named `{{accent-color}}` → fill/stroke replaced
 *
 * Text wrapping metadata via `data-*` attributes on `<text>` elements:
 *   data-max-width="920"   → max pixel width before wrapping
 *   data-max-lines="2"     → max number of lines
 *   data-line-height="1.3" → line height multiplier
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

// ── Registry types ──────────────────────────────────────────

export interface FigmaTemplateEntry {
  width: number;
  height: number;
  placeholders: string[];
  kind: string;
  description?: string;
}

export interface FigmaReplacements {
  texts?: Record<string, string>;
  images?: Record<string, string>;
  colors?: Record<string, string>;
}

export interface FigmaRenderOptions {
  width?: number;
  height?: number;
  scale?: number;
}

// ── Registry cache ──────────────────────────────────────────

let registryCache: Record<string, FigmaTemplateEntry> | null = null;

function resolveTemplatesDir(): string {
  // __dirname is reliable on both local dev and Vercel Lambda
  const fromDirname = path.resolve(__dirname, "templates", "figma");
  if (existsSync(fromDirname)) return fromDirname;
  // Fallback: cwd-based resolution (monorepo root)
  const fromCwd = path.resolve(process.cwd(), "agents", "shared", "templates", "figma");
  if (existsSync(fromCwd)) return fromCwd;
  return path.resolve(process.cwd(), "..", "..", "agents", "shared", "templates", "figma");
}

const TEMPLATES_DIR = resolveTemplatesDir();

export async function loadRegistry(): Promise<Record<string, FigmaTemplateEntry>> {
  if (registryCache) return registryCache;
  const raw = await readFile(path.join(TEMPLATES_DIR, "_registry.json"), "utf-8");
  registryCache = JSON.parse(raw) as Record<string, FigmaTemplateEntry>;
  return registryCache;
}

export function getTemplatesDir(): string {
  return TEMPLATES_DIR;
}

// ── SVG template cache ──────────────────────────────────────

const svgCache = new Map<string, string>();

async function loadSvgTemplate(templateId: string): Promise<string> {
  const cached = svgCache.get(templateId);
  if (cached) return cached;

  const filePath = path.join(TEMPLATES_DIR, `${templateId}.svg`);
  if (!existsSync(filePath)) {
    throw new Error(`Figma SVG template not found: ${filePath}`);
  }
  const svg = await readFile(filePath, "utf-8");
  svgCache.set(templateId, svg);
  return svg;
}

// ── Korean text wrapping ────────────────────────────────────

/**
 * Wrap Korean text into lines respecting word boundaries.
 * Uses a character-count heuristic — for precise pixel-level wrapping,
 * font metrics would be needed, but char count is sufficient for
 * fixed-width template regions.
 */
export function wrapKoreanText(
  text: string,
  maxCharsPerLine: number,
  maxLines: number,
): string[] {
  if (text.length <= maxCharsPerLine) return [text];

  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > 0 && lines.length < maxLines) {
    if (remaining.length <= maxCharsPerLine) {
      lines.push(remaining);
      remaining = "";
      break;
    }

    // Try to break at a natural boundary (space, comma, period)
    let breakAt = maxCharsPerLine;
    const searchFrom = Math.max(0, maxCharsPerLine - 5);
    for (let i = maxCharsPerLine; i >= searchFrom; i--) {
      const ch = remaining[i];
      if (ch === " " || ch === "," || ch === "." || ch === "·" || ch === "、") {
        breakAt = i + 1;
        break;
      }
    }

    // For Korean keep-all: don't break in the middle of a word
    // Check if we're splitting a Korean word (no spaces around)
    const line = remaining.slice(0, breakAt).trimEnd();
    lines.push(line);
    remaining = remaining.slice(breakAt).trimStart();
  }

  // If there's remaining text and we hit maxLines, truncate with ellipsis
  if (remaining.length > 0 && lines.length === maxLines) {
    const last = lines[lines.length - 1]!;
    lines[lines.length - 1] = last.slice(0, -1) + "…";
  }

  return lines;
}

/**
 * Estimate characters per line based on pixel width and font size.
 * Korean characters are roughly square; Latin chars are ~0.6x width.
 * This is a heuristic — Figma templates should set data-max-width.
 */
function estimateCharsPerLine(maxWidthPx: number, fontSizePx: number): number {
  // Average Korean character width ≈ fontSize * 1.0
  // Average mixed content ≈ fontSize * 0.8
  const avgCharWidth = fontSizePx * 0.85;
  return Math.floor(maxWidthPx / avgCharWidth);
}

// ── SVG placeholder replacement ─────────────────────────────

/**
 * Replace text placeholders in SVG.
 * Finds `<text id="{{key}}">...</text>` and replaces content,
 * handling multi-line wrapping via <tspan> elements.
 */
function replaceTexts(svg: string, texts: Record<string, string>): string {
  let result = svg;

  for (const [key, value] of Object.entries(texts)) {
    const placeholder = `{{${key}}}`;

    // Find <text> element with this id
    // Pattern: <text id="{{key}}" ... data-max-width="N" data-max-lines="N" ...>content</text>
    const textRegex = new RegExp(
      `(<text[^>]*\\bid="${escapeRegex(placeholder)}"[^>]*>)([\\s\\S]*?)(</text>)`,
      "g",
    );

    result = result.replace(textRegex, (match, openTag: string, _content: string, closeTag: string) => {
      // Extract metadata from data attributes
      const maxWidthMatch = openTag.match(/data-max-width="(\d+)"/);
      const maxLinesMatch = openTag.match(/data-max-lines="(\d+)"/);
      const lineHeightMatch = openTag.match(/data-line-height="([\d.]+)"/);
      const fontSizeMatch = openTag.match(/font-size="(\d+)"/);

      const maxWidth = maxWidthMatch ? parseInt(maxWidthMatch[1]!, 10) : 920;
      const maxLines = maxLinesMatch ? parseInt(maxLinesMatch[1]!, 10) : 3;
      const lineHeight = lineHeightMatch ? parseFloat(lineHeightMatch[1]!) : 1.3;
      const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1]!, 10) : 48;

      const charsPerLine = estimateCharsPerLine(maxWidth, fontSize);
      const lines = wrapKoreanText(value, charsPerLine, maxLines);

      if (lines.length === 1) {
        return `${openTag}${escapeXml(lines[0]!)}${closeTag}`;
      }

      // Multi-line: use <tspan> elements with dy for line spacing
      const xMatch = openTag.match(/\bx="([^"]+)"/);
      const x = xMatch ? xMatch[1]! : "0";

      const tspans = lines.map((line, i) => {
        const dy = i === 0 ? "0" : `${lineHeight}em`;
        return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
      }).join("");

      return `${openTag}${tspans}${closeTag}`;
    });
  }

  return result;
}

/**
 * Replace image placeholders in SVG.
 * Finds `<image id="{{key}}" ...>` and replaces href with data URI.
 */
function replaceImages(svg: string, images: Record<string, string>): string {
  let result = svg;

  for (const [key, dataUri] of Object.entries(images)) {
    const placeholder = `{{${key}}}`;

    // Replace href or xlink:href in <image> elements with matching id
    const imageRegex = new RegExp(
      `(<image[^>]*\\bid="${escapeRegex(placeholder)}"[^>]*?)\\b(href|xlink:href)="[^"]*"`,
      "g",
    );
    result = result.replace(imageRegex, `$1href="${dataUri}"`);

    // Also handle <image> where the id might be on a parent <g> element
    const groupImageRegex = new RegExp(
      `(<g[^>]*\\bid="${escapeRegex(placeholder)}"[^>]*>[\\s\\S]*?<image[^>]*?)\\b(href|xlink:href)="[^"]*"`,
      "g",
    );
    result = result.replace(groupImageRegex, `$1href="${dataUri}"`);
  }

  return result;
}

/**
 * Replace color placeholders in SVG.
 * Finds elements with `id="{{key}}"` and replaces fill/stroke colors.
 */
function replaceColors(svg: string, colors: Record<string, string>): string {
  let result = svg;

  for (const [key, color] of Object.entries(colors)) {
    const placeholder = `{{${key}}}`;

    // Replace fill color on elements with this id
    const fillRegex = new RegExp(
      `(<[^>]*\\bid="${escapeRegex(placeholder)}"[^>]*?)\\bfill="[^"]*"`,
      "g",
    );
    result = result.replace(fillRegex, `$1fill="${color}"`);

    // Replace stroke color on elements with this id
    const strokeRegex = new RegExp(
      `(<[^>]*\\bid="${escapeRegex(placeholder)}"[^>]*?)\\bstroke="[^"]*"`,
      "g",
    );
    result = result.replace(strokeRegex, `$1stroke="${color}"`);

    // Also handle CSS style fill/stroke
    const styleFillRegex = new RegExp(
      `(<[^>]*\\bid="${escapeRegex(placeholder)}"[^>]*?style="[^"]*?)fill:\\s*[^;"]+(;?)`,
      "g",
    );
    result = result.replace(styleFillRegex, `$1fill:${color}$2`);
  }

  return result;
}

// ── Utility ─────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ── Font embedding for resvg ────────────────────────────────

import { loadFontsForMood } from "./fonts";
import type { FontMood } from "./fonts";

/**
 * Embed font data as base64 @font-face declarations inside SVG <defs><style>.
 * resvg needs fonts either as system fonts or embedded in the SVG.
 */
async function embedFontsInSvg(svg: string, fontMood: FontMood): Promise<string> {
  const fonts = await loadFontsForMood(fontMood);

  const fontFaces = fonts.map((f) => {
    const b64 = Buffer.from(f.data).toString("base64");
    return `@font-face {
  font-family: '${f.name}';
  src: url('data:font/otf;base64,${b64}') format('opentype');
  font-weight: ${String(f.weight)};
  font-style: ${f.style};
}`;
  }).join("\n");

  // Inject <defs><style> after root <svg> tag
  const svgTagEnd = svg.indexOf(">") + 1;
  const defsBlock = `<defs><style type="text/css">${fontFaces}</style></defs>`;

  return svg.slice(0, svgTagEnd) + defsBlock + svg.slice(svgTagEnd);
}

// ── Main render function ────────────────────────────────────

/**
 * Render a Figma SVG template to PNG buffer.
 *
 * @param templateId - Template ID matching a file in templates/figma/ (e.g. "cover.hero.v1")
 * @param replacements - Text, image, and color replacements
 * @param options - Render options (width, height, scale)
 * @returns PNG buffer
 */
export async function renderFigmaTemplate(
  templateId: string,
  replacements: FigmaReplacements,
  options?: FigmaRenderOptions,
  fontMood?: FontMood,
): Promise<Buffer> {
  const registry = await loadRegistry();
  const entry = registry[templateId];
  if (!entry) {
    throw new Error(`Unknown Figma template: ${templateId}. Available: ${Object.keys(registry).join(", ")}`);
  }

  // Load SVG template
  let svg = await loadSvgTemplate(templateId);

  // Apply replacements
  if (replacements.texts) {
    svg = replaceTexts(svg, replacements.texts);
  }
  if (replacements.images) {
    svg = replaceImages(svg, replacements.images);
  }
  if (replacements.colors) {
    svg = replaceColors(svg, replacements.colors);
  }

  // Embed fonts for resvg rendering
  svg = await embedFontsInSvg(svg, fontMood ?? "bold-display");

  // Rasterise via resvg
  const w = options?.width ?? entry.width;
  const h = options?.height ?? entry.height;
  const scale = options?.scale ?? 1;

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: w * scale },
  });
  const pngBuf = Buffer.from(resvg.render().asPng());

  return pngBuf;
}

/**
 * List all available Figma templates.
 */
export async function listFigmaTemplates(): Promise<Record<string, FigmaTemplateEntry>> {
  return loadRegistry();
}

/**
 * Check if a Figma SVG template file exists for the given templateId.
 */
export function figmaTemplateExists(templateId: string): boolean {
  const filePath = path.join(TEMPLATES_DIR, `${templateId}.svg`);
  return existsSync(filePath);
}
