/**
 * Design Engine Font Adapter — bridges brand-kit typography with Satori rendering.
 *
 * Re-uses the shared font system (agents/shared/fonts.ts + render.ts) while
 * providing design-engine-specific utilities:
 *   - BrandKit → FontMood mapping
 *   - Content-type aware font selection
 *   - Satori CSS property helpers
 *
 * Font files live in agents/cardnews-composition/fonts/.
 * The shared render core handles lazy loading and caching.
 */

import type { BrandKit, FontMood } from "./brand-kit";
import type { DesignContentType } from "./types";

// ── Content-type → FontMood mapping ─────────────────────

/**
 * Select the best font mood based on content type and role.
 * This allows different content types to have distinct visual identities
 * while staying within the brand kit.
 */
export function selectFontMood(
  kit: BrandKit,
  contentType: DesignContentType,
  role: "heading" | "body" = "heading",
): FontMood {
  // Content-type specific overrides
  const contentOverrides: Partial<Record<DesignContentType, FontMood>> = {
    album_review: "editorial",
    artist_spotlight: "bold-display",
    trending: "impact",
    data_insight: "clean-sans",
    list_ranking: "bold-display",
    general: "minimal",
  };

  if (role === "heading" && contentOverrides[contentType]) {
    return contentOverrides[contentType]!;
  }

  // Fall back to brand kit default
  return kit.typography[role].fontMood;
}

// ── TypographyMood → FontMood mapping ───────────────────

import type { TypographyMood } from "./types";

const TYPOGRAPHY_TO_FONT_MOOD: Record<TypographyMood, FontMood> = {
  serif_classic: "editorial",
  sans_modern: "clean-sans",
  display_impact: "bold-display",
  handwritten: "playful",
};

/**
 * Convert a TypographyMood (from DesignBrief) to a FontMood (for font loading).
 */
export function typographyMoodToFontMood(mood: TypographyMood): FontMood {
  return TYPOGRAPHY_TO_FONT_MOOD[mood] ?? "clean-sans";
}

// ── Satori CSS helpers ──────────────────────────────────

/**
 * Build Satori-compatible font style props for a given role.
 */
export function fontStyleProps(
  kit: BrandKit,
  role: "heading" | "body" | "accent",
  sizeOverride?: number,
): Record<string, string | number> {
  const typo = kit.typography[role];
  const defaultSize = role === "heading"
    ? kit.typography.sizes.title
    : role === "accent"
      ? kit.typography.sizes.caption
      : kit.typography.sizes.body;

  return {
    fontFamily: `"${typo.fontFamily}", "Apple SD Gothic Neo", sans-serif`,
    fontSize: sizeOverride ?? defaultSize,
    fontWeight: typo.weights[0] ?? 400,
  };
}

/**
 * Get a hero title style (largest text, heaviest weight).
 */
export function heroTitleStyle(kit: BrandKit): Record<string, string | number> {
  const typo = kit.typography.heading;
  return {
    fontFamily: `"${typo.fontFamily}", "Apple SD Gothic Neo", sans-serif`,
    fontSize: kit.typography.sizes.hero,
    fontWeight: typo.weights[typo.weights.length - 1] ?? 800,
    lineHeight: 1.2,
  };
}

/**
 * List of supported Satori CSS properties (for reference / validation).
 * Satori uses Yoga Layout (Flexbox only) — no CSS Grid, no float.
 */
export const SATORI_SUPPORTED_CSS = [
  // Layout
  "display", "flexDirection", "flexWrap", "flexGrow", "flexShrink", "flexBasis",
  "alignItems", "alignSelf", "justifyContent", "gap",
  "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
  "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "position", "top", "right", "bottom", "left",
  "overflow",
  // Visual
  "background", "backgroundColor", "backgroundImage",
  "border", "borderWidth", "borderColor", "borderStyle", "borderRadius",
  "borderTop", "borderRight", "borderBottom", "borderLeft",
  "color", "opacity",
  "boxShadow", "textShadow",
  "objectFit",
  // Text
  "fontFamily", "fontSize", "fontWeight", "fontStyle",
  "textAlign", "textDecoration", "textTransform",
  "lineHeight", "letterSpacing", "wordBreak",
  "whiteSpace", "textOverflow",
] as const;

/**
 * CSS properties NOT supported by Satori (common mistakes).
 */
export const SATORI_UNSUPPORTED_CSS = [
  "grid", "gridTemplate", "float", "clear",
  "filter", "backdropFilter",
  "transition", "animation", "transform",
  "cursor", "userSelect", "pointerEvents",
  "objectPosition",
] as const;
