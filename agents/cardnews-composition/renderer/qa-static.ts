/**
 * Static QA measurement without browser DOM.
 *
 * Replaces Playwright-based measureSafeAreaAndFooter() and measureSlideQa().
 * Since all positions are absolute pixel values known at template time,
 * we compute QA metrics via pure arithmetic.
 */

// Re-export types compatible with qa.ts
export interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
  withinSafe: boolean;
}

export interface FooterBoxRect extends BoxRect {
  withinFooterZone: boolean;
}

export interface QaMeasurement {
  safeArea: { top: number; bottom: number; left: number; right: number };
  boxes: {
    title?: BoxRect;
    subtitle?: BoxRect;
    footer?: FooterBoxRect;
  };
  violations: string[];
}

export interface SlideOverflow {
  title?: boolean;
  subtitle?: boolean;
  headline?: boolean;
  body?: boolean;
  cta?: boolean;
}

export interface SlideQaResult {
  safeAreaAndFooter: QaMeasurement;
  overflow: SlideOverflow;
}

// ============================================================================
// Static computation
// ============================================================================

const W = 1080;
const H = 1350;

export interface BoxDef {
  id: string; // "title", "subtitle", "footer", "headline", "body", "cta"
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute slide QA from known absolute positions.
 *
 * Drop-in replacement for measureSlideQa() from qa.ts.
 */
export function computeSlideQa(params: {
  safeArea?: { top: number; bottom: number; left: number; right: number };
  footerZoneH?: number;
  boxes: BoxDef[];
  textOverflows?: Record<string, boolean>;
}): SlideQaResult {
  const sa = params.safeArea ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const footerZoneH = params.footerZoneH ?? 220;

  const safeLeft = sa.left;
  const safeTop = sa.top;
  const safeRight = W - sa.right;
  const safeBottom = H - sa.bottom;

  const footerZoneTop = H - sa.bottom - footerZoneH;
  const footerZoneBottom = H - sa.bottom;

  const qaBoxes: QaMeasurement["boxes"] = {};
  const violations: string[] = [];

  for (const box of params.boxes) {
    const { id, x, y, width: w, height: h } = box;

    const withinSafe =
      x >= safeLeft &&
      y >= safeTop &&
      x + w <= safeRight &&
      y + h <= safeBottom;

    if (!withinSafe) {
      violations.push(`${id}_outside_safe_area`);
    }

    if (id === "footer") {
      const withinFZ = y >= footerZoneTop && y + h <= footerZoneBottom;
      if (!withinFZ) {
        violations.push("footer_outside_footer_zone");
      }
      (qaBoxes as Record<string, FooterBoxRect>)[id] = {
        x,
        y,
        w,
        h,
        withinSafe,
        withinFooterZone: withinFZ,
      };
    } else if (id === "title" || id === "subtitle") {
      (qaBoxes as Record<string, BoxRect>)[id] = { x, y, w, h, withinSafe };
    }
  }

  const overflow: SlideOverflow = {};
  if (params.textOverflows) {
    for (const [key, val] of Object.entries(params.textOverflows)) {
      (overflow as Record<string, boolean>)[key] = val;
    }
  }

  return {
    safeAreaAndFooter: {
      safeArea: sa,
      boxes: qaBoxes,
      violations,
    },
    overflow,
  };
}

/**
 * Compute safe-area + footer measurement only (no overflow).
 *
 * Drop-in replacement for measureSafeAreaAndFooter() from qa.ts.
 */
export function computeSafeArea(params: {
  safeArea?: { top: number; bottom: number; left: number; right: number };
  footerZoneH?: number;
  boxes: BoxDef[];
}): QaMeasurement {
  const result = computeSlideQa({ ...params, textOverflows: {} });
  return result.safeAreaAndFooter;
}
