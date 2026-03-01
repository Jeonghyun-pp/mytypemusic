/**
 * Curved Text — SVG textPath presets and generator.
 *
 * Generates SVG path data for common text curve shapes.
 * Used by the layer compositor when a TextLayer has `curvedPath` set.
 */

// ── Preset IDs ───────────────────────────────────────────

export type CurvePreset = "arch-top" | "arch-bottom" | "circle" | "wave";

// ── Preset generators ────────────────────────────────────

/**
 * Generate SVG path data for a curve preset.
 *
 * @param preset   Curve shape preset ID
 * @param width    Bounding box width
 * @param height   Bounding box height
 * @returns        SVG path `d` attribute value
 */
export function generateCurvePath(
  preset: CurvePreset,
  width: number,
  height: number,
): string {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2;

  switch (preset) {
    case "arch-top":
      // Arc curving upward — text bows up
      return `M ${String(cx - r)},${String(cy)} A ${String(r)},${String(r)} 0 0,1 ${String(cx + r)},${String(cy)}`;

    case "arch-bottom":
      // Arc curving downward — text bows down
      return `M ${String(cx - r)},${String(cy)} A ${String(r)},${String(r)} 0 0,0 ${String(cx + r)},${String(cy)}`;

    case "circle":
      // Full circle — text wraps around
      return [
        `M ${String(cx)},${String(cy - r)}`,
        `A ${String(r)},${String(r)} 0 1,1 ${String(cx - 0.001)},${String(cy - r)}`,
      ].join(" ");

    case "wave":
      // Sine wave — text flows in a wave pattern
      return [
        `M 0,${String(height / 2)}`,
        `Q ${String(width / 4)},0 ${String(width / 2)},${String(height / 2)}`,
        `T ${String(width)},${String(height / 2)}`,
      ].join(" ");

    default:
      return `M 0,${String(height / 2)} L ${String(width)},${String(height / 2)}`;
  }
}

/**
 * All available presets with display labels.
 */
export const CURVE_PRESETS: { id: CurvePreset; label: string }[] = [
  { id: "arch-top", label: "상단 아치" },
  { id: "arch-bottom", label: "하단 아치" },
  { id: "circle", label: "원형" },
  { id: "wave", label: "웨이브" },
];
