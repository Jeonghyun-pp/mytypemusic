/**
 * Inline Satori + resvg-js renderer for the Design Editor.
 *
 * Core rendering logic lives in agents/shared/render.ts.
 * This file adds Studio-specific features: warmUp() for cold-start optimization.
 */
import {
  renderHtmlToPngBuffer as sharedRenderBuffer,
  renderHtmlToDataUri as sharedRenderDataUri,
  W,
  H,
} from "@agents/shared/render";
import type { SvgEffectOptions } from "@agents/shared/render";

import {
  loadFontsForMood,
  isValidFontMood as sharedIsValidFontMood,
  MOOD_CSS_STACKS as sharedMoodCssStacks,
} from "@agents/shared/fonts";

import type { FontMood } from "@agents/shared/fonts";

// Re-export for existing consumers
export type { FontMood, SvgEffectOptions };
export const MOOD_CSS_STACKS = sharedMoodCssStacks;
export const isValidFontMood = sharedIsValidFontMood;

/**
 * Render inline-style HTML string to a PNG buffer using Satori + resvg-js.
 */
export async function renderHtmlToPngBuffer(
  html: string,
  fontMood?: FontMood,
  canvasWidth?: number,
  canvasHeight?: number,
  effects?: SvgEffectOptions,
): Promise<Buffer> {
  return sharedRenderBuffer(html, fontMood, canvasWidth, canvasHeight, effects);
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
  return sharedRenderDataUri(html, fontMood, canvasWidth, canvasHeight, effects);
}

// ── Warm-up ──────────────────────────────────────────────

let warmUpDone = false;

/**
 * Pre-load fonts and run a minimal Satori + resvg cycle so the first
 * real render doesn't pay cold-start costs (~500ms → ~200ms saved).
 */
export function warmUp(): void {
  if (warmUpDone) return;
  warmUpDone = true;

  void (async () => {
    try {
      // Trigger font loading + a minimal render cycle
      const html = `<div style="display:flex;width:${W}px;height:${H}px;background:#000;"></div>`;
      await sharedRenderBuffer(html, "bold-display");
    } catch {
      // warm-up failure is non-fatal
    }
  })();
}
