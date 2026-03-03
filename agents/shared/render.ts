/**
 * Shared Satori + resvg-js render core.
 *
 * Single source of truth for HTML → VDOM → SVG → PNG conversion.
 * Used by both Agent CLI (via satori.ts wrapper) and Studio API (via inlineRenderer.ts wrapper).
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

import { loadFontsForMood } from "./fonts";
import type { FontMood } from "./fonts";
import {
  buildDropShadowFilter,
  buildGaussianBlurFilter,
  injectSvgFilters,
} from "./svgFilters";
import type { DropShadowOptions } from "./svgFilters";

// ============================================================================
// Constants
// ============================================================================

export const W = 1080;
export const H = 1350;

// ============================================================================
// Satori VDOM types
// ============================================================================

export type SatoriVNode = {
  type: string;
  props: {
    style?: Record<string, string | number>;
    src?: string;
    children?: (SatoriVNode | string)[];
    [key: string]: unknown;
  };
};

// ============================================================================
// HTML → Satori VDOM converter
// ============================================================================

/** Parse a CSS inline style string to a camelCase style object */
export function parseInlineStyle(styleStr: string): Record<string, string | number> {
  const style: Record<string, string | number> = {};
  const parts = styleStr.split(";").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx < 0) continue;
    const rawKey = part.slice(0, colonIdx).trim();
    const val = part.slice(colonIdx + 1).trim();
    const key = rawKey.replace(/-([a-z])/g, (_, c) => (c as string).toUpperCase());
    const numVal = parseFloat(val);
    if (!isNaN(numVal) && /^-?[\d.]+px$/.test(val)) {
      style[key] = numVal;
    } else {
      style[key] = val;
    }
  }
  return style;
}

/** Very simple HTML tokenizer for controlled template output */
export function htmlToVdom(
  html: string,
  canvasWidth?: number,
  canvasHeight?: number,
): SatoriVNode | string {
  const w = canvasWidth ?? W;
  const h = canvasHeight ?? H;
  const trimmed = html.trim();
  if (!trimmed) return "";

  const tokens: Array<
    | { type: "open"; tag: string; attrs: string }
    | { type: "close"; tag: string }
    | { type: "selfclose"; tag: string; attrs: string }
    | { type: "text"; text: string }
  > = [];

  const tagRe = /<\/?(\w+)([^>]*?)\/?>|([^<]+)/g;
  let m;
  while ((m = tagRe.exec(trimmed)) !== null) {
    if (m[3] !== undefined) {
      const text = m[3].trim();
      if (text) tokens.push({ type: "text", text });
    } else {
      const full = m[0];
      const tag = m[1]!.toLowerCase();
      const attrs = m[2] ?? "";
      if (full.startsWith("</")) {
        tokens.push({ type: "close", tag });
      } else if (full.endsWith("/>") || tag === "img" || tag === "br" || tag === "hr") {
        tokens.push({ type: "selfclose", tag, attrs });
      } else {
        tokens.push({ type: "open", tag, attrs });
      }
    }
  }

  function parseAttrs(attrStr: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrRe = /(\w[\w-]*)="([^"]*)"/g;
    let am;
    while ((am = attrRe.exec(attrStr)) !== null) {
      attrs[am[1]!] = am[2]!;
    }
    return attrs;
  }

  function buildNode(tag: string, attrStr: string): SatoriVNode {
    const rawAttrs = parseAttrs(attrStr);
    const props: SatoriVNode["props"] = {};
    if (rawAttrs.style) props.style = parseInlineStyle(rawAttrs.style);

    // Pass through all other attributes (src, width, viewBox, fill, d, etc.)
    for (const [key, val] of Object.entries(rawAttrs)) {
      if (key === "style") continue;
      props[key] = val;
    }

    props.children = [];
    return { type: tag, props };
  }

  const root: SatoriVNode = {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", width: w, height: h },
      children: [],
    },
  };
  const stack: SatoriVNode[] = [root];

  for (const token of tokens) {
    const current = stack[stack.length - 1]!;
    if (token.type === "text") {
      current.props.children!.push(token.text);
    } else if (token.type === "selfclose") {
      current.props.children!.push(buildNode(token.tag, token.attrs));
    } else if (token.type === "open") {
      const node = buildNode(token.tag, token.attrs);
      current.props.children!.push(node);
      stack.push(node);
    } else if (token.type === "close") {
      if (stack.length > 1) stack.pop();
    }
  }

  fixSatoriCompat(root);

  const children = root.props.children!;
  if (children.length === 1 && typeof children[0] !== "string" && children[0] !== undefined) {
    return children[0];
  }
  return root;
}

// ============================================================================
// Satori compatibility fixer
// ============================================================================

const SVG_TAGS = new Set([
  "svg", "path", "circle", "rect", "line", "polyline", "polygon",
  "ellipse", "text", "tspan", "g", "defs", "use", "clippath",
  "lineargradient", "radialgradient", "stop", "mask", "image",
]);

/**
 * Satori requires every <div> with non-string children to have
 * display: flex | contents | none. SVG elements are excluded.
 */
export function fixSatoriCompat(node: SatoriVNode | string): void {
  if (typeof node === "string") return;
  const children = node.props.children;

  // Recurse first
  if (children) {
    for (const child of children) fixSatoriCompat(child);
  }

  // SVG elements are rendered natively by Satori — don't add display:flex
  if (SVG_TAGS.has(node.type)) return;

  // Satori requires ALL <div> elements to have explicit display:flex
  if (!node.props.style) node.props.style = {};
  const d = node.props.style.display;
  if (d !== "flex" && d !== "contents" && d !== "none") {
    node.props.style.display = "flex";
    if (!node.props.style.flexDirection) {
      node.props.style.flexDirection = "column";
    }
  }
}

// ============================================================================
// SVG effect options
// ============================================================================

export interface SvgEffectOptions {
  shadow?: DropShadowOptions;
  /** Gaussian blur standard deviation (px) */
  blur?: number;
}

// ============================================================================
// Main render functions
// ============================================================================

/**
 * Apply SVG filters (shadow, blur) to a Satori-generated SVG string.
 * When both shadow and blur are active, they are combined into a single
 * composite filter so both effects apply simultaneously.
 */
function applySvgEffects(svg: string, effects?: SvgEffectOptions): string {
  if (!effects) return svg;
  const filterDefs: string[] = [];
  let bodyFilterId: string | undefined;

  const hasShadow = !!effects.shadow;
  const hasBlur = effects.blur != null && effects.blur > 0;

  if (hasShadow && hasBlur) {
    // Combine both primitives into a single composite filter
    const { offsetX, offsetY, blur: shadowBlur, color } = effects.shadow!;
    filterDefs.push([
      `<filter id="fx-combined" x="-50%" y="-50%" width="200%" height="200%">`,
      `  <feGaussianBlur in="SourceGraphic" stdDeviation="${String(effects.blur)}" result="blurred"/>`,
      `  <feDropShadow dx="${String(offsetX)}" dy="${String(offsetY)}" stdDeviation="${String(shadowBlur)}" flood-color="${color}" flood-opacity="1"/>`,
      `</filter>`,
    ].join("\n"));
    bodyFilterId = "fx-combined";
  } else if (hasShadow) {
    filterDefs.push(buildDropShadowFilter("fx-shadow", effects.shadow!));
    bodyFilterId = "fx-shadow";
  } else if (hasBlur) {
    filterDefs.push(buildGaussianBlurFilter("fx-blur", { stdDeviation: effects.blur! }));
    bodyFilterId = "fx-blur";
  }

  return injectSvgFilters(svg, filterDefs, bodyFilterId);
}

/**
 * Render inline-style HTML string to a PNG buffer using Satori + resvg-js.
 * Input HTML must already use inline styles (no <style> blocks).
 */
export async function renderHtmlToPngBuffer(
  html: string,
  fontMood?: FontMood,
  canvasWidth?: number,
  canvasHeight?: number,
  effects?: SvgEffectOptions,
): Promise<Buffer> {
  const w = canvasWidth ?? W;
  const h = canvasHeight ?? H;
  const vdom = htmlToVdom(html, w, h);
  const fonts = await loadFontsForMood(fontMood ?? "bold-display");

  let svg = await satori(vdom as Parameters<typeof satori>[0], {
    width: w,
    height: h,
    fonts: fonts as Parameters<typeof satori>[1]["fonts"],
  });

  svg = applySvgEffects(svg, effects);

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: w },
  });
  return Buffer.from(resvg.render().asPng());
}

/**
 * Render inline-style HTML string to a base64 data URI.
 */
export async function renderHtmlToDataUri(
  html: string,
  fontMood?: FontMood,
  canvasWidth?: number,
  canvasHeight?: number,
  effects?: SvgEffectOptions,
): Promise<string> {
  const buf = await renderHtmlToPngBuffer(html, fontMood, canvasWidth, canvasHeight, effects);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

/**
 * Render HTML and measure the fraction of non-transparent pixels (0–1).
 *
 * Used to verify overlay-only HTML: a proper overlay should have mostly
 * transparent pixels (~20-40% opaque for text + scrims). If the ratio
 * is very high (>75%), the overlay likely recreated the background.
 *
 * Renders at 1/4 resolution for speed (~50ms vs ~200ms at full res).
 */
export async function measureOpacityRatio(
  html: string,
  fontMood?: FontMood,
): Promise<number> {
  const w = Math.round(W / 4); // 270
  const h = Math.round(H / 4); // 338
  const vdom = htmlToVdom(html, w, h);
  const fonts = await loadFontsForMood(fontMood ?? "bold-display");

  const svg = await satori(vdom as Parameters<typeof satori>[0], {
    width: w,
    height: h,
    fonts: fonts as Parameters<typeof satori>[1]["fonts"],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: w },
  });
  const rendered = resvg.render();
  const pixels = rendered.pixels; // Uint8Array — RGBA, 4 bytes per pixel

  const totalPixels = rendered.width * rendered.height;
  let opaqueCount = 0;

  // Every 4th byte starting at index 3 is the alpha channel
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i]! > 10) opaqueCount++; // alpha > 10 ≈ visible
  }

  return opaqueCount / totalPixels;
}

// Re-export FontMood for convenience
export type { FontMood };
