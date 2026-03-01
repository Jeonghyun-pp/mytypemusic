import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { Resvg } from "@resvg/resvg-js";
import { SlideSpecSchema, SlideStyleOverridesSchema, CanvasSizeSchema } from "@/lib/studio/designEditor/types";
import { LayerSchema } from "@/lib/studio/designEditor/layerTypes";
import { renderSlideHtml, TEMPLATES } from "@/lib/studio/designEditor/templates";
import { renderHtmlToDataUri, warmUp, isValidFontMood, MOOD_CSS_STACKS } from "@/lib/studio/designEditor/inlineRenderer";
import { composeLayers } from "@agents/shared/layerCompositor";
import type { FontMood, SvgEffectOptions } from "@/lib/studio/designEditor/inlineRenderer";
import type { SlideStyleOverrides } from "@/lib/studio/designEditor/types";
import { z } from "zod";

// ── LRU render cache (20 entries) ─────────────────────────
const CACHE_MAX = 20;
const renderCache = new Map<string, string>();

function cacheGet(key: string): string | undefined {
  const val = renderCache.get(key);
  if (val === undefined) return undefined;
  // Move to end (most recent)
  renderCache.delete(key);
  renderCache.set(key, val);
  return val;
}

function cacheSet(key: string, value: string): void {
  if (renderCache.size >= CACHE_MAX) {
    const oldest = renderCache.keys().next().value;
    if (oldest !== undefined) renderCache.delete(oldest);
  }
  renderCache.set(key, value);
}

function hashInput(html: string): string {
  return crypto.createHash("md5").update(html).digest("hex");
}

// ── JSX style={{ }} → HTML style="..." 변환 ─────────────

const UNITLESS = new Set([
  "fontWeight", "lineHeight", "opacity", "zIndex", "flex", "flexGrow",
  "flexShrink", "order", "orphans", "widows", "columnCount", "fillOpacity",
  "strokeOpacity", "strokeWidth", "animationIterationCount",
]);

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function jsxStyleObjectToCSS(objStr: string): string {
  const pairs: string[] = [];
  // Match: key: 'value', key: "value", key: number, key: `value`
  const re = /(\w+)\s*:\s*(?:'([^']*)'|"([^"]*)"|(-?\d+(?:\.\d+)?))/g;
  let m;
  while ((m = re.exec(objStr)) !== null) {
    const key = m[1]!;
    const strVal = m[2] ?? m[3];
    const numVal = m[4];
    const cssKey = camelToKebab(key);
    let cssVal: string;
    if (numVal !== undefined) {
      cssVal = UNITLESS.has(key) ? numVal : `${numVal}px`;
    } else {
      cssVal = strVal ?? "";
    }
    pairs.push(`${cssKey}: ${cssVal}`);
  }
  return pairs.join("; ");
}

/**
 * Convert JSX-style code to plain HTML.
 * Handles: style={{ ... }} → style="..."
 */
function jsxToHtml(input: string): string {
  if (!input.includes("style={{")) return input;

  let result = "";
  let i = 0;

  while (i < input.length) {
    const idx = input.indexOf("style={{", i);
    if (idx === -1) {
      result += input.slice(i);
      break;
    }

    result += input.slice(i, idx);
    const contentStart = idx + "style={{".length;

    // Find matching }} by tracking brace depth (start at 2 for {{ )
    let depth = 2;
    let j = contentStart;
    while (j < input.length && depth > 0) {
      const ch = input[j];
      if (ch === "'" || ch === '"') {
        // Skip string literals
        const quote = ch;
        j++;
        while (j < input.length && input[j] !== quote) j++;
      }
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      if (depth > 0) j++;
    }

    const objContent = input.slice(contentStart, j - 1); // exclude last }
    const css = jsxStyleObjectToCSS(objContent);
    result += `style="${css}"`;
    i = j + 1; // skip past the second }
  }

  return result;
}

// ── Warm-up: pre-load fonts + resvg on first import ──────
warmUp();

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const start = performance.now();
  let html: string;

  // ── Parse fontMood ────────────────────────────────────
  const fontMoodRaw = (body as Record<string, unknown>).fontMood;
  const fontMood: FontMood | undefined =
    typeof fontMoodRaw === "string" && isValidFontMood(fontMoodRaw)
      ? fontMoodRaw
      : undefined;

  // ── Parse canvasSize ───────────────────────────────────
  const canvasSizeRaw = (body as Record<string, unknown>).canvasSize;
  const canvasSizeParsed = CanvasSizeSchema.safeParse(canvasSizeRaw);
  const canvasWidth = canvasSizeParsed.success ? canvasSizeParsed.data.width : undefined;
  const canvasHeight = canvasSizeParsed.success ? canvasSizeParsed.data.height : undefined;

  // ── Layer mode: composeLayers → SVG → PNG ────────────
  const layersRaw = (body as Record<string, unknown>).layers;
  if (Array.isArray(layersRaw) && layersRaw.length > 0) {
    const layersParsed = z.array(LayerSchema).safeParse(layersRaw);
    if (!layersParsed.success) {
      return NextResponse.json(
        { error: "Invalid layers", details: layersParsed.error.flatten() },
        { status: 400 },
      );
    }

    const bgColor = ((body as Record<string, unknown>).background as string) ?? "#FFFFFF";
    const w = canvasWidth ?? 1080;
    const h = canvasHeight ?? 1350;

    const layerCacheKey = hashInput(JSON.stringify(layersRaw) + bgColor + (fontMood ?? "") + `${String(w)}x${String(h)}`);
    const layerCached = cacheGet(layerCacheKey);
    if (layerCached) {
      const elapsed = Math.round(performance.now() - start);
      return NextResponse.json({ png: layerCached, renderTimeMs: elapsed, cached: true });
    }

    try {
      const svg = await composeLayers(layersParsed.data, {
        width: w,
        height: h,
        background: bgColor,
        fontMood: fontMood ?? "bold-display",
      });
      const resvg = new Resvg(svg, { fitTo: { mode: "width" as const, value: w } });
      const pngBuf = Buffer.from(resvg.render().asPng());
      const png = `data:image/png;base64,${pngBuf.toString("base64")}`;
      const elapsed = Math.round(performance.now() - start);
      cacheSet(layerCacheKey, png);
      return NextResponse.json({ png, renderTimeMs: elapsed });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: "Layer render failed", details: msg }, { status: 500 });
    }
  }

  // ── Code mode: rawHtml 직접 렌더 ──────────────────────
  const rawHtml = (body as Record<string, unknown>).rawHtml;
  if (typeof rawHtml === "string" && rawHtml.trim()) {
    html = jsxToHtml(rawHtml);
  } else {
    // ── Template mode: 기존 로직 ────────────────────────
    const parsed = SlideSpecSchema.safeParse((body as Record<string, unknown>).slide);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid slide spec", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const globalStyleRaw = (body as Record<string, unknown>).globalStyle;
    let globalStyle: SlideStyleOverrides | undefined;
    if (globalStyleRaw) {
      const gp = SlideStyleOverridesSchema.safeParse(globalStyleRaw);
      if (gp.success) globalStyle = gp.data;
    }

    const slide = parsed.data;
    const merged = { ...globalStyle, ...slide.styleOverrides };
    const tmpl = TEMPLATES[slide.templateId];

    html = renderSlideHtml(slide.templateId, {
      title: slide.title,
      bodyText: slide.bodyText,
      footerText: slide.footerText,
      heroImageDataUri: slide.heroImageDataUri,
      slideIndex: slide.slideIndex,
      bgGradient: merged.bgGradient,
      textColor: merged.textColor,
      accentColor: merged.accentColor,
      footerColor: merged.footerColor,
      titleSizePx: merged.titleSizePx ?? tmpl.defaults.titleSizePx,
      bodySizePx: merged.bodySizePx ?? tmpl.defaults.bodySizePx,
      headlineSizePx: merged.headlineSizePx,
      titleWeight: merged.titleWeight ?? tmpl.defaults.titleWeight,
      bodyWeight: merged.bodyWeight ?? tmpl.defaults.bodyWeight,
      letterSpacing: merged.letterSpacing,
      scrimOpacity: merged.scrimOpacity,
      imageBrightness: merged.imageBrightness,
      cardRadius: merged.cardRadius,
      fontFamily: fontMood ? MOOD_CSS_STACKS[fontMood] : undefined,
      canvasWidth,
      canvasHeight,
    });
  }

  // ── Parse SVG effects (shadow, blur) ─────────────────
  const effects: SvgEffectOptions = {};
  const shadowRaw = (body as Record<string, unknown>).shadow;
  if (shadowRaw && typeof shadowRaw === "object") {
    const sh = shadowRaw as Record<string, unknown>;
    if (
      typeof sh.offsetX === "number" &&
      typeof sh.offsetY === "number" &&
      typeof sh.blur === "number" &&
      typeof sh.color === "string"
    ) {
      effects.shadow = {
        offsetX: sh.offsetX,
        offsetY: sh.offsetY,
        blur: sh.blur,
        color: sh.color,
      };
    }
  }
  const blurRaw = (body as Record<string, unknown>).blur;
  if (typeof blurRaw === "number" && blurRaw > 0) {
    effects.blur = blurRaw;
  }
  const hasEffects = effects.shadow !== undefined || effects.blur !== undefined;

  // ── Check LRU cache ──────────────────────────────────
  const cacheKey = hashInput(html + (fontMood ?? "") + (hasEffects ? JSON.stringify(effects) : ""));
  const cached = cacheGet(cacheKey);
  if (cached) {
    const elapsed = Math.round(performance.now() - start);
    return NextResponse.json({ png: cached, renderTimeMs: elapsed, cached: true });
  }

  try {
    const png = await renderHtmlToDataUri(html, fontMood, canvasWidth, canvasHeight, hasEffects ? effects : undefined);
    const elapsed = Math.round(performance.now() - start);

    cacheSet(cacheKey, png);

    return NextResponse.json({ png, renderTimeMs: elapsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Render failed", details: msg },
      { status: 500 },
    );
  }
}
