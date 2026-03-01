/**
 * Shared template types — unified input model for slide HTML generation.
 */

// ── Slide kinds ──────────────────────────────────────────
export type SlideKind = "cover" | "fact" | "summary" | "cta";

// ── Template IDs ─────────────────────────────────────────
export type TemplateId =
  | "cover.hero.v1"
  | "cover.hero.v2"
  | "body.fact.v1"
  | "body.fact.v2"
  | "body.fact.v3"
  | "body.fact.v4"
  | "end.outro.v1";

// ── Template metadata ────────────────────────────────────
export interface TemplateConfig {
  id: TemplateId;
  kind: SlideKind;
  label: string;
  description: string;
  defaultBg: string;
  defaults: {
    titleSizePx: number;
    bodySizePx: number;
    footerSizePx: number;
    titleWeight: number;
    bodyWeight: number;
  };
}

// ── Unified render input ─────────────────────────────────
export interface SlideRenderSpec {
  // Content
  title: string;
  bodyText: string;
  footerText: string;
  heroImageDataUri?: string;
  slideIndex: number;

  // Style overrides
  fontFamily?: string;
  bgGradient?: string;
  textColor?: string;
  accentColor?: string;
  footerColor?: string;
  titleSizePx?: number;
  bodySizePx?: number;
  headlineSizePx?: number;
  titleWeight?: number;
  bodyWeight?: number;
  letterSpacing?: "tight" | "normal" | "wide";
  scrimOpacity?: number;
  imageBrightness?: number;
  cardRadius?: number;

  // Agent-specific (optional)
  cssOverrideBlock?: string;

  // Canvas dimensions (default 1080×1350)
  canvasWidth?: number;
  canvasHeight?: number;
}
