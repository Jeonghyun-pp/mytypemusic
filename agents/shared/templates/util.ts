/**
 * Shared template utility functions.
 */
import type { SlideRenderSpec } from "./types";

export const W = 1080;
export const H = 1350;

/** Resolve canvas width from input or default */
export function cw(input: SlideRenderSpec): number {
  return input.canvasWidth ?? W;
}

/** Resolve canvas height from input or default */
export function ch(input: SlideRenderSpec): number {
  return input.canvasHeight ?? H;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function ls(spacing: "tight" | "normal" | "wide" | undefined): string {
  switch (spacing) {
    case "tight": return "-0.02em";
    case "wide": return "0.05em";
    default: return "0";
  }
}

/** Build background style, preferring hero image over gradient */
export function bgStyle(input: SlideRenderSpec, defaultGrad: string): string {
  if (input.heroImageDataUri) return "background: #000;";
  return `background: ${input.bgGradient ?? defaultGrad};`;
}

/** Hero image block with scrim overlay */
export function heroBlock(input: SlideRenderSpec, scrimH: number): string {
  if (!input.heroImageDataUri) return "";
  const w = cw(input);
  const h = ch(input);
  const scrimOp = input.scrimOpacity ?? 0.65;
  return `<img style="position:absolute;top:0;left:0;width:${w}px;height:${h}px;display:block;" src="${escapeHtml(input.heroImageDataUri)}" alt="" /><div style="position:absolute;left:0;bottom:0;width:${w}px;height:${scrimH}px;background:linear-gradient(to top, rgba(0,0,0,${scrimOp}), transparent);display:flex;"></div>`;
}

/**
 * Scale a position value proportionally based on canvas size.
 * Example: sx(80, input) scales 80px from 1080-base to current canvas width.
 */
export function sx(px: number, input: SlideRenderSpec): number {
  const w = cw(input);
  return w === W ? px : Math.round(px * (w / W));
}

/** Scale Y position proportionally based on canvas height */
export function sy(px: number, input: SlideRenderSpec): number {
  const h = ch(input);
  return h === H ? px : Math.round(px * (h / H));
}
