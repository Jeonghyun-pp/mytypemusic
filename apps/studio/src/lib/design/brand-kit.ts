/**
 * Brand Kit — visual identity system for all design engine outputs.
 *
 * Single source of truth for colors, typography, logos, and layout rules.
 * All design agents reference this to maintain brand consistency.
 */

/**
 * FontMood type — mirrors agents/shared/fonts.ts.
 * Re-declared here to avoid cross-package import issues in Studio builds.
 */
export type FontMood =
  | "bold-display"
  | "clean-sans"
  | "editorial"
  | "playful"
  | "minimal"
  | "impact";

// ── Brand Kit interface ─────────────────────────────────

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: {
    dark: string;
    light: string;
  };
  text: {
    primary: string;
    secondary: string;
    onDark: string;
    onLight: string;
  };
  gradients: string[];        // CSS gradient presets
}

export interface BrandTypography {
  heading: {
    fontFamily: string;
    weights: number[];
    fontMood: FontMood;
  };
  body: {
    fontFamily: string;
    weights: number[];
    fontMood: FontMood;
  };
  accent: {
    fontFamily: string;
    weights: number[];
    fontMood: FontMood;
  };
  sizes: {
    hero: number;             // px
    title: number;
    subtitle: number;
    body: number;
    caption: number;
    label: number;
  };
}

export interface BrandAssets {
  logoUrl?: string;
  logoSmallUrl?: string;
  watermarkUrl?: string;
}

export interface BrandLayout {
  safeMargin: number;         // px — minimum padding from edge
  cornerRadius: number;       // px — default border radius
  maxTextPerSlide: number;    // characters
  maxTitleLength: number;     // characters
  slideGap: number;           // px — gap between elements
}

export interface BrandKit {
  name: string;
  colors: BrandColors;
  typography: BrandTypography;
  assets: BrandAssets;
  layout: BrandLayout;
}

// ── Default Brand Kit ───────────────────────────────────

export const DEFAULT_BRAND_KIT: BrandKit = {
  name: "Web Magazine Default",

  colors: {
    primary: "#6C5CE7",       // vibrant purple
    secondary: "#2D3436",     // charcoal
    accent: "#E17055",        // warm coral
    background: {
      dark: "#1A1A2E",
      light: "#F8F9FA",
    },
    text: {
      primary: "#2D3436",
      secondary: "#636E72",
      onDark: "#FFFFFF",
      onLight: "#2D3436",
    },
    gradients: [
      "linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)",           // deep dark
      "linear-gradient(135deg, #6C5CE7 0%, #A29BFE 100%)",           // purple glow
      "linear-gradient(135deg, #2D3436 0%, #636E72 100%)",           // charcoal
      "linear-gradient(135deg, #E17055 0%, #FDCB6E 100%)",           // warm sunset
      "linear-gradient(180deg, #0F0F1A 0%, #1A1A2E 50%, #2D1B69 100%)", // concert night
    ],
  },

  typography: {
    heading: {
      fontFamily: "Pretendard",
      weights: [700, 800, 900],
      fontMood: "bold-display",
    },
    body: {
      fontFamily: "Pretendard",
      weights: [400, 500, 600],
      fontMood: "clean-sans",
    },
    accent: {
      fontFamily: "Pretendard",
      weights: [600, 700],
      fontMood: "minimal",
    },
    sizes: {
      hero: 64,
      title: 48,
      subtitle: 32,
      body: 18,
      caption: 14,
      label: 12,
    },
  },

  assets: {
    logoUrl: undefined,
    logoSmallUrl: undefined,
    watermarkUrl: undefined,
  },

  layout: {
    safeMargin: 60,
    cornerRadius: 16,
    maxTextPerSlide: 80,
    maxTitleLength: 22,
    slideGap: 24,
  },
};

// ── Utility functions ───────────────────────────────────

/**
 * Get a CSS-ready font stack string from the brand kit.
 */
export function getBrandFontStack(
  kit: BrandKit,
  role: "heading" | "body" | "accent" = "heading",
): string {
  const family = kit.typography[role].fontFamily;
  return `"${family}", "Apple SD Gothic Neo", sans-serif`;
}

/**
 * Get the appropriate FontMood for Satori rendering based on content type.
 */
export function getFontMoodForContent(
  kit: BrandKit,
  role: "heading" | "body" | "accent" = "heading",
): FontMood {
  return kit.typography[role].fontMood;
}

/**
 * Build a safe-zone-aware container style object for Satori JSX.
 */
export function getSafeContainerStyle(
  kit: BrandKit,
  width: number,
  height: number,
): Record<string, string | number> {
  return {
    display: "flex",
    flexDirection: "column",
    width,
    height,
    padding: kit.layout.safeMargin,
    fontFamily: getBrandFontStack(kit, "body"),
  };
}

/**
 * Pick gradient from brand kit by index (wraps around).
 */
export function pickGradient(kit: BrandKit, index: number): string {
  const gradients = kit.colors.gradients;
  if (gradients.length === 0) return kit.colors.background.dark;
  return gradients[index % gradients.length]!;
}

/**
 * Merge a partial brand kit override into the defaults (deep merge for nested objects).
 */
export function mergeBrandKit(overrides: Partial<BrandKit>): BrandKit {
  return {
    ...DEFAULT_BRAND_KIT,
    ...overrides,
    colors: {
      ...DEFAULT_BRAND_KIT.colors,
      ...overrides.colors,
      background: { ...DEFAULT_BRAND_KIT.colors.background, ...overrides.colors?.background },
      text: { ...DEFAULT_BRAND_KIT.colors.text, ...overrides.colors?.text },
      gradients: overrides.colors?.gradients ?? DEFAULT_BRAND_KIT.colors.gradients,
    },
    typography: {
      ...DEFAULT_BRAND_KIT.typography,
      ...overrides.typography,
      heading: { ...DEFAULT_BRAND_KIT.typography.heading, ...overrides.typography?.heading },
      body: { ...DEFAULT_BRAND_KIT.typography.body, ...overrides.typography?.body },
      accent: { ...DEFAULT_BRAND_KIT.typography.accent, ...overrides.typography?.accent },
      sizes: { ...DEFAULT_BRAND_KIT.typography.sizes, ...overrides.typography?.sizes },
    },
    assets: { ...DEFAULT_BRAND_KIT.assets, ...overrides.assets },
    layout: { ...DEFAULT_BRAND_KIT.layout, ...overrides.layout },
  };
}
