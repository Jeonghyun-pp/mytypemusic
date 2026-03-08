/**
 * Shared types & constants for Motion Skill compositions.
 */

export const FPS = 30;

/** Common easing helpers for interpolate extrapolation. */
export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Hex color to rgba string. Handles 3-char and 6-char hex, falls back to black on invalid input. */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  let r: number, g: number, b: number;
  if (h.length === 3) {
    r = parseInt(h[0]! + h[0]!, 16);
    g = parseInt(h[1]! + h[1]!, 16);
    b = parseInt(h[2]! + h[2]!, 16);
  } else {
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  }
  if (isNaN(r)) r = 0;
  if (isNaN(g)) g = 0;
  if (isNaN(b)) b = 0;
  return `rgba(${r},${g},${b},${alpha})`;
}
