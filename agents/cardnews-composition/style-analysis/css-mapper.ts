import type { StyleProfile } from "./schema.js";
import { getFontSet, isValidFontMood } from "../fonts/registry.js";
import type { FontMood } from "../fonts/registry.js";
import type { ColorPalette } from "./palettes.js";

// ============================================================================
// CSSOverrides — values injected into the renderer's CSS
// ============================================================================

export interface CSSOverrides {
  /** Background gradient or solid color for fact/outro slides */
  bgGradient?: string;
  /** Cover scrim gradient */
  coverScrimGradient?: string;
  /** Primary color */
  primaryColor?: string;
  /** Secondary color */
  secondaryColor?: string;
  /** Accent color */
  accentColor?: string;
  /** Main text color (hex) */
  textColor?: string;
  /** Footer text color with opacity */
  footerColor?: string;
  /** Headline label color */
  headlineLabelColor?: string;
  /** Title font weight */
  titleWeight?: string;
  /** Body font weight */
  bodyWeight?: string;
  /** Letter spacing value */
  letterSpacing?: string;
  /** Card border radius (px) */
  cardRadius?: number;
  /** Divider/accent bar color */
  accentBarColor?: string;
  /** Typography mood hint (used for font-family fallback selection) */
  fontMood?: string;
}

/**
 * Convert a StyleProfile to CSSOverrides for renderer injection.
 */
export function styleProfileToCSSOverrides(profile: StyleProfile): CSSOverrides {
  const { colors, typography, spacing } = profile;
  const overrides: CSSOverrides = {};

  // Background gradient
  if (colors.gradientStops && colors.gradientStops.length >= 2) {
    const dir = colors.gradientDirection ?? 160;
    const stops = colors.gradientStops
      .map((s) => `${s.color} ${s.position}%`)
      .join(", ");
    overrides.bgGradient = `linear-gradient(${dir}deg, ${stops})`;
  } else {
    overrides.bgGradient = colors.background;
  }

  // Cover scrim — darkened version of primary
  overrides.coverScrimGradient =
    `linear-gradient(to top, ${hexToRgba(colors.primary, 0.7)}, transparent)`;

  // Colors
  overrides.primaryColor = colors.primary;
  overrides.secondaryColor = colors.secondary;
  overrides.accentColor = colors.accent;
  overrides.textColor = colors.textColor;
  overrides.footerColor = hexToRgba(colors.textColor, 0.7);
  overrides.headlineLabelColor = hexToRgba(colors.textColor, 0.55);

  // Typography
  overrides.titleWeight = String(typography.titleWeight);
  overrides.bodyWeight = String(typography.bodyWeight);
  overrides.letterSpacing = mapLetterSpacing(typography.letterSpacing);
  overrides.fontMood = typography.mood;

  // Spacing
  if (spacing.usesCards && spacing.cardRadius !== undefined) {
    overrides.cardRadius = spacing.cardRadius;
  }
  if (spacing.usesAccentBars) {
    overrides.accentBarColor = colors.accent;
  }

  return overrides;
}

/**
 * Generate a CSS override block to be appended after the existing :root vars.
 * Only emits rules for non-undefined overrides.
 */
export function buildCSSOverrideBlock(overrides: CSSOverrides): string {
  const rules: string[] = [];

  if (overrides.bgGradient) {
    rules.push(`.canvas { background: ${overrides.bgGradient} !important; }`);
  }
  if (overrides.coverScrimGradient) {
    rules.push(`.scrim { background: ${overrides.coverScrimGradient} !important; }`);
  }
  if (overrides.textColor) {
    rules.push(`.canvas { color: ${overrides.textColor} !important; }`);
  }
  if (overrides.titleWeight) {
    rules.push(`.slot-title { font-weight: ${overrides.titleWeight} !important; }`);
  }
  if (overrides.bodyWeight) {
    rules.push(`.slot-body { font-weight: ${overrides.bodyWeight} !important; }`);
  }
  if (overrides.letterSpacing) {
    rules.push(`.slot-headline { letter-spacing: ${overrides.letterSpacing} !important; }`);
  }
  if (overrides.footerColor) {
    rules.push(`.slot-footer { color: ${overrides.footerColor} !important; }`);
  }
  if (overrides.headlineLabelColor) {
    rules.push(`.slot-headline { color: ${overrides.headlineLabelColor} !important; }`);
  }
  if (overrides.accentBarColor) {
    rules.push(`.divider { background: ${overrides.accentBarColor} !important; }`);
    rules.push(`.accent-bar { background: ${overrides.accentBarColor} !important; }`);
  }
  if (overrides.cardRadius !== undefined) {
    rules.push(`.card { border-radius: ${overrides.cardRadius}px !important; }`);
  }

  // Font-family based on mood
  if (overrides.fontMood && isValidFontMood(overrides.fontMood)) {
    const fontSet = getFontSet(overrides.fontMood as FontMood);
    rules.push(`.canvas { font-family: ${fontSet.cssStack} !important; }`);
    rules.push(`.slot-title { font-family: "${fontSet.primary}", ${fontSet.cssStack} !important; }`);
    if (fontSet.primary !== fontSet.body) {
      rules.push(`.slot-body { font-family: "${fontSet.body}", sans-serif !important; }`);
      rules.push(`.slot-headline { font-family: "${fontSet.body}", sans-serif !important; }`);
    }
  }

  if (rules.length === 0) return "";
  return `\n/* --- Style Overrides --- */\n${rules.join("\n")}`;
}

// ── Helpers ──────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
  return `rgba(${r},${g},${b},${alpha})`;
}

function mapLetterSpacing(spacing: "tight" | "normal" | "wide"): string {
  switch (spacing) {
    case "tight": return "-1px";    // 디에디트 기준 타이틀 letterSpacing
    case "normal": return "-0.2px"; // 디에디트 기준 본문 letterSpacing
    case "wide": return "2px";
  }
}

/**
 * Convert a ColorPalette + optional FontMood to CSSOverrides.
 * Used when no style-profile.json exists — preset palette provides colors.
 */
export function paletteToCSSOverrides(
  palette: ColorPalette,
  fontMood?: FontMood,
): CSSOverrides {
  const overrides: CSSOverrides = {
    bgGradient: palette.background,
    textColor: palette.textColor,
    primaryColor: palette.primary,
    secondaryColor: palette.secondary,
    accentColor: palette.accent,
    footerColor: palette.footerColor,
    headlineLabelColor: hexToRgba(palette.textColor, 0.55),
  };

  if (fontMood) {
    overrides.fontMood = fontMood;
  }

  return overrides;
}
