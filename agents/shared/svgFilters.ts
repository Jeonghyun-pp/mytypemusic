/**
 * SVG Filter builders — drop shadow & gaussian blur.
 *
 * These produce raw SVG markup that can be injected into the <defs> block
 * of a Satori-generated SVG before passing to resvg-js.
 */

// ── Types ────────────────────────────────────────────────

export interface DropShadowOptions {
  offsetX: number;
  offsetY: number;
  blur: number;
  /** CSS color string, e.g. "rgba(0,0,0,0.4)" or "#000000" */
  color: string;
}

export interface GaussianBlurOptions {
  /** Blur standard deviation in px */
  stdDeviation: number;
}

// ── Helpers ───────────────────────────────────────────────

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Filter builders ──────────────────────────────────────

/**
 * Build an SVG `<filter>` element for a drop shadow effect.
 *
 * Uses feDropShadow which is supported by resvg-js.
 */
export function buildDropShadowFilter(
  id: string,
  opts: DropShadowOptions,
): string {
  const { offsetX, offsetY, blur, color } = opts;
  // Add generous filterRegion to avoid clipping the shadow
  return [
    `<filter id="${escapeAttr(id)}" x="-50%" y="-50%" width="200%" height="200%">`,
    `  <feDropShadow dx="${String(offsetX)}" dy="${String(offsetY)}" stdDeviation="${String(blur)}" flood-color="${escapeAttr(color)}" flood-opacity="1"/>`,
    `</filter>`,
  ].join("\n");
}

/**
 * Build an SVG `<filter>` element for a gaussian blur effect.
 */
export function buildGaussianBlurFilter(
  id: string,
  opts: GaussianBlurOptions,
): string {
  return [
    `<filter id="${escapeAttr(id)}" x="-50%" y="-50%" width="200%" height="200%">`,
    `  <feGaussianBlur in="SourceGraphic" stdDeviation="${String(opts.stdDeviation)}"/>`,
    `</filter>`,
  ].join("\n");
}

/**
 * Wrap SVG content with a `<g>` that references a filter.
 */
export function wrapWithFilter(
  svgContent: string,
  filterId: string,
): string {
  return `<g filter="url(#${filterId})">${svgContent}</g>`;
}

// ── SVG post-processing ──────────────────────────────────

/**
 * Inject `<defs>` filters into a Satori-generated SVG string and
 * optionally wrap the entire body content with a filter reference.
 *
 * @param svg           Raw SVG string from Satori
 * @param filterDefs    Array of filter definition strings (from buildDropShadowFilter etc.)
 * @param bodyFilterId  Optional filter ID to apply to the entire SVG body
 * @returns             Modified SVG string
 */
export function injectSvgFilters(
  svg: string,
  filterDefs: string[],
  bodyFilterId?: string,
): string {
  if (filterDefs.length === 0 && !bodyFilterId) return svg;

  const defsBlock = `<defs>${filterDefs.join("\n")}</defs>`;

  // Find the first > of the root <svg ...> tag
  const svgOpenEnd = svg.indexOf(">") + 1;
  if (svgOpenEnd <= 0) return svg;

  const svgOpen = svg.slice(0, svgOpenEnd);
  let svgBody = svg.slice(svgOpenEnd);

  // Remove closing </svg>
  const closingIdx = svgBody.lastIndexOf("</svg>");
  const svgClose = closingIdx >= 0 ? svgBody.slice(closingIdx) : "</svg>";
  if (closingIdx >= 0) svgBody = svgBody.slice(0, closingIdx);

  // Optionally wrap body with filter
  if (bodyFilterId) {
    svgBody = `<g filter="url(#${bodyFilterId})">${svgBody}</g>`;
  }

  return svgOpen + defsBlock + svgBody + svgClose;
}
