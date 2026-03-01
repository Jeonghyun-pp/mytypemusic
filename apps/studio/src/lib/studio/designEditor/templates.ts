/**
 * Design Editor templates — re-exports from shared template module.
 *
 * All template rendering logic now lives in agents/shared/templates/.
 * This file provides backward-compatible exports for the Design Editor.
 */
import {
  renderSlideHtml as sharedRenderSlideHtml,
  TEMPLATES as sharedTemplates,
  TEMPLATES_BY_KIND as sharedTemplatesByKind,
} from "@agents/shared/templates/index";
import type {
  TemplateConfig,
  SlideRenderSpec,
  TemplateId,
  SlideKind,
} from "@agents/shared/templates/types";

export { W, H } from "@agents/shared/templates/util";

// Re-export types
export type { TemplateConfig, TemplateId, SlideKind };

// Re-export template registry
export const TEMPLATES = sharedTemplates;
export const TEMPLATES_BY_KIND = sharedTemplatesByKind;

// ── RenderInput (backward-compatible wrapper) ────────────

export interface RenderInput {
  title: string;
  bodyText: string;
  footerText: string;
  heroImageDataUri?: string;
  slideIndex: number;
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
  fontFamily?: string;
  canvasWidth?: number;
  canvasHeight?: number;
}

/**
 * Render a single slide to Satori-compatible inline-style HTML.
 * RenderInput is compatible with SlideRenderSpec.
 */
export function renderSlideHtml(
  templateId: TemplateId,
  input: RenderInput,
): string {
  const spec: SlideRenderSpec = input;
  return sharedRenderSlideHtml(templateId, spec);
}
