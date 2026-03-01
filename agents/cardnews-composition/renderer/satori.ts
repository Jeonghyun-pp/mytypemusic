/**
 * Agent-side Satori renderer wrapper.
 *
 * Core rendering logic lives in agents/shared/render.ts.
 * This file adds Agent-specific features:
 *   - postProcessHtml: file:// → base64, CSS class inlining, unsupported CSS removal
 *   - renderHtmlToPng: file I/O wrapper (reads HTML from disk, writes PNG to disk)
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { renderHtmlToPngBuffer, htmlToVdom, W, H } from "../../shared/render.js";
import type { FontMood } from "../../shared/fonts.js";

import { prepareImage, bufferToDataUri } from "./image-prep.js";

// Re-export for existing consumers
export type { FontMood };
export { htmlToVdom };

// ============================================================================
// HTML post-processing for Satori compatibility (Agent-specific)
// ============================================================================

interface ImageBrightness {
  fileUrl: string;
  brightness: number;
}

function scanImagesWithBrightness(htmlStr: string): ImageBrightness[] {
  const results: ImageBrightness[] = [];
  const imgRe = /<img[^>]*>/gi;
  let match;
  while ((match = imgRe.exec(htmlStr)) !== null) {
    const imgTag = match[0];
    const srcMatch = imgTag.match(/src="(file:\/\/\/[^"]+)"/);
    const brightMatch = imgTag.match(/brightness\(([0-9.]+)\)/);
    if (srcMatch) {
      results.push({
        fileUrl: srcMatch[1]!,
        brightness: brightMatch ? parseFloat(brightMatch[1]!) : 1.0,
      });
    }
  }
  return results;
}

async function postProcessHtml(htmlStr: string): Promise<string> {
  const images = scanImagesWithBrightness(htmlStr);
  const urlToDataUri = new Map<string, string>();

  for (const img of images) {
    if (urlToDataUri.has(img.fileUrl)) continue;
    let localPath: string;
    try {
      localPath = fileURLToPath(img.fileUrl);
    } catch {
      continue;
    }
    const buffer = await prepareImage({
      localPath,
      targetW: W,
      targetH: H,
      brightness: img.brightness < 1.0 ? img.brightness : undefined,
    });
    urlToDataUri.set(img.fileUrl, bufferToDataUri(buffer));
  }

  let result = htmlStr;

  // Replace file:// URLs with data URIs
  result = result.replace(/src="(file:\/\/\/[^"]+)"/g, (_m, url: string) => {
    const dataUri = urlToDataUri.get(url);
    return dataUri ? `src="${dataUri}"` : _m;
  });

  // Remove unsupported CSS
  result = result.replace(/filter:\s*brightness\([0-9.]+\);?\s*/g, "");
  result = result.replace(/text-shadow:\s*[^;]+;?\s*/g, "");
  result = result.replace(/box-shadow:\s*[^;]+;?\s*/g, "");
  result = result.replace(/text-overflow:\s*ellipsis;?\s*/g, "");
  result = result.replace(/object-fit:\s*cover;?\s*/g, "");

  // Replace percentage dimensions on <img> with pixel values
  result = result.replace(
    /(<img[^>]*style="[^"]*?)width:\s*100%\s*;?\s*([^"]*?")/g,
    `$1width:${W}px;$2`,
  );
  result = result.replace(
    /(<img[^>]*style="[^"]*?)height:\s*100%\s*;?\s*([^"]*?")/g,
    `$1height:${H}px;$2`,
  );

  return result;
}

// ============================================================================
// CSS → inline style conversion (for Agent's <style> block templates)
// ============================================================================

interface ParsedCssRules {
  rules: Map<string, Record<string, string>>;
  importantRules: Map<string, Record<string, string>>;
}

function parseCssRules(htmlStr: string): ParsedCssRules {
  const styleMatch = htmlStr.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (!styleMatch) return { rules: new Map(), importantRules: new Map() };

  let css = styleMatch[1]!;

  // Resolve :root CSS variables
  const varMap = new Map<string, string>();
  const rootMatch = css.match(/:root\s*\{([^}]+)\}/);
  if (rootMatch) {
    const varRe = /--([\w-]+)\s*:\s*([^;]+);/g;
    let m;
    while ((m = varRe.exec(rootMatch[1]!)) !== null) {
      varMap.set(`--${m[1]}`, m[2]!.trim());
    }
  }
  css = css.replace(/var\(--([\w-]+)\)/g, (_, name) =>
    varMap.get(`--${name}`) ?? `var(--${name})`,
  );

  const rules = new Map<string, Record<string, string>>();
  const importantRules = new Map<string, Record<string, string>>();
  const ruleRe = /([.#][\w-]+)\s*\{([^}]+)\}/g;
  let match;
  while ((match = ruleRe.exec(css)) !== null) {
    const selector = match[1]!;
    const normalProps: Record<string, string> = {};
    const impProps: Record<string, string> = {};
    const propRe = /([\w-]+)\s*:\s*([^;]+);/g;
    let pm;
    while ((pm = propRe.exec(match[2]!)) !== null) {
      const val = pm[2]!.trim();
      if (val.includes("!important")) {
        impProps[pm[1]!.trim()] = val.replace(/\s*!important\s*$/, "");
      } else {
        normalProps[pm[1]!.trim()] = val;
      }
    }

    // Merge into existing rules (not replace)
    const existing = rules.get(selector) ?? {};
    rules.set(selector, { ...existing, ...normalProps });

    if (Object.keys(impProps).length > 0) {
      const existingImp = importantRules.get(selector) ?? {};
      importantRules.set(selector, { ...existingImp, ...impProps });
    }
  }

  return { rules, importantRules };
}

function propsToInline(props: Record<string, string>): string {
  return Object.entries(props)
    .map(([k, v]) => `${k}:${v.replace(/"/g, "'")}`)
    .join(";");
}

function inlineCssClasses(
  bodyHtml: string,
  rules: Map<string, Record<string, string>>,
  importantRules: Map<string, Record<string, string>>,
): string {
  return bodyHtml.replace(/<(\w+)\s+([^>]*?)>/g, (full, tag: string, attrs: string) => {
    const classMatch = attrs.match(/class="([^"]+)"/);
    const idMatch = attrs.match(/id="([^"]+)"/);
    const styleMatch = attrs.match(/style="([^"]+)"/);

    const merged: Record<string, string> = {};

    // 1) Normal class/id rules (lowest priority)
    if (classMatch) {
      for (const cls of classMatch[1]!.split(/\s+/)) {
        const r = rules.get(`.${cls}`);
        if (r) Object.assign(merged, r);
      }
    }
    if (idMatch) {
      const r = rules.get(`#${idMatch[1]}`);
      if (r) Object.assign(merged, r);
    }

    // 2) Inline styles (override normal rules)
    if (styleMatch) {
      const propRe = /([\w-]+)\s*:\s*([^;]+)/g;
      let pm;
      while ((pm = propRe.exec(styleMatch[1]!)) !== null) {
        merged[pm[1]!.trim()] = pm[2]!.trim();
      }
    }

    // 3) !important rules (highest priority — override even inline styles)
    if (classMatch) {
      for (const cls of classMatch[1]!.split(/\s+/)) {
        const r = importantRules.get(`.${cls}`);
        if (r) Object.assign(merged, r);
      }
    }
    if (idMatch) {
      const r = importantRules.get(`#${idMatch[1]}`);
      if (r) Object.assign(merged, r);
    }

    if (Object.keys(merged).length === 0) return full;

    const clean = attrs
      .replace(/class="[^"]*"\s*/g, "")
      .replace(/style="[^"]*"\s*/g, "")
      .trim();

    return `<${tag} ${clean} style="${propsToInline(merged)}">`.replace(/\s+>/g, ">");
  });
}

function extractBody(htmlStr: string): string {
  const m = htmlStr.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1]!.trim() : htmlStr;
}

// ============================================================================
// Main render function (Agent file I/O wrapper)
// ============================================================================

/**
 * Render an HTML file to PNG using Satori + resvg-js.
 *
 * @param htmlPath  Path to self-contained HTML file
 * @param pngPath   Output PNG path
 * @param mood      Font mood for Satori font selection (default: "bold-display")
 */
export async function renderHtmlToPng(
  htmlPath: string,
  pngPath: string,
  mood?: FontMood,
): Promise<void> {
  const rawHtml = await readFile(htmlPath, "utf-8");

  // Post-process: file:// → base64, remove unsupported CSS
  const processed = await postProcessHtml(rawHtml);

  // Parse CSS rules and inline them
  const { rules, importantRules } = parseCssRules(processed);
  let body = extractBody(processed);
  body = inlineCssClasses(body, rules, importantRules);

  // Remove data-* attributes
  body = body.replace(/\s*data-[\w-]+="[^"]*"/g, "");

  // Render to PNG buffer using shared core
  const pngBuffer = await renderHtmlToPngBuffer(body, mood);

  await writeFile(pngPath, pngBuffer);
}
