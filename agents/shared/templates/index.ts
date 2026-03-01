/**
 * Shared template dispatcher — single entry point for slide HTML generation.
 */
import type { TemplateId, TemplateConfig, SlideRenderSpec, SlideKind } from "./types";
import { renderCoverV1, renderCoverV2, COVER_V1_CONFIG, COVER_V2_CONFIG } from "./cover";
import { renderFactV1, renderFactV2, renderFactV3, renderFactV4, FACT_V1_CONFIG, FACT_V2_CONFIG, FACT_V3_CONFIG, FACT_V4_CONFIG } from "./fact";
import { renderOutroV1, OUTRO_V1_CONFIG } from "./outro";

// Re-export types
export type { TemplateId, TemplateConfig, SlideRenderSpec, SlideKind };

// ── Template registry ────────────────────────────────────

export const TEMPLATES: Record<TemplateId, TemplateConfig> = {
  "cover.hero.v1": COVER_V1_CONFIG,
  "cover.hero.v2": COVER_V2_CONFIG,
  "body.fact.v1": FACT_V1_CONFIG,
  "body.fact.v2": FACT_V2_CONFIG,
  "body.fact.v3": FACT_V3_CONFIG,
  "body.fact.v4": FACT_V4_CONFIG,
  "end.outro.v1": OUTRO_V1_CONFIG,
};

export const TEMPLATES_BY_KIND: Record<SlideKind, TemplateId[]> = {
  cover: ["cover.hero.v1", "cover.hero.v2"],
  fact: ["body.fact.v1", "body.fact.v2", "body.fact.v3", "body.fact.v4"],
  summary: [],
  cta: ["end.outro.v1"],
};

// ── Dispatcher ───────────────────────────────────────────

/**
 * Render a single slide to Satori-compatible inline-style HTML.
 * Returns an HTML string (no <html>/<body> wrapper — just the root <div>).
 */
export function renderSlideHtml(
  templateId: TemplateId,
  input: SlideRenderSpec,
): string {
  switch (templateId) {
    case "cover.hero.v1": return renderCoverV1(input);
    case "cover.hero.v2": return renderCoverV2(input);
    case "body.fact.v1": return renderFactV1(input);
    case "body.fact.v2": return renderFactV2(input);
    case "body.fact.v3": return renderFactV3(input);
    case "body.fact.v4": return renderFactV4(input);
    case "end.outro.v1": return renderOutroV1(input);
    default: {
      throw new Error(`Unknown template: ${String(templateId)}`);
    }
  }
}
