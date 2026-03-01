import type { ContentPlan } from "../../contracts.js";
import type { GuardrailViolation, GuardrailReport } from "./report.js";
import { collectSlideText, diffMustPreserve } from "./compare.js";

// ============================================================================
// Enforce guardrails: partial rollback on violation
// ============================================================================

export function enforceGuardrails(params: {
  topicId: string;
  draftPlan: ContentPlan;
  rewrittenPlan: ContentPlan;
  draftCaption?: string;
  rewrittenCaption?: string;
  mode?: "off" | "slides" | "caption" | "all" | "generate";
}): {
  plan: ContentPlan;
  captionText?: string;
  report: GuardrailReport;
} {
  const {
    topicId,
    draftPlan,
    rewrittenPlan,
    draftCaption,
    rewrittenCaption,
    mode,
  } = params;

  const violations: GuardrailViolation[] = [];
  let slidesRolledBack = 0;
  let captionRolledBack = false;

  // Start from rewritten plan, selectively roll back violated slides
  const finalSlides = rewrittenPlan.slides.map((rewrittenSlide, i) => {
    const draftSlide = draftPlan.slides[i];
    if (!draftSlide) return rewrittenSlide;

    const kind = draftSlide.kind;
    // Generate mode writes headlines from scratch → strong check would roll back
    // nearly everything. Use weak (numbers/dates only) for generate.
    const strictness: "strong" | "weak" =
      mode === "generate" ? "weak" : (kind === "fact" ? "strong" : "weak");

    const draftText = collectSlideText(draftSlide);
    const rewrittenText = collectSlideText(rewrittenSlide);

    const { violations: slideViolations } = diffMustPreserve({
      draftText,
      rewrittenText,
      strictness,
    });

    if (slideViolations.length > 0) {
      // Record violations
      for (const v of slideViolations) {
        violations.push({
          slideIndex: i,
          kind,
          type: v.type,
          detail: v.detail,
        });
      }

      // Roll back this slide to draft
      slidesRolledBack++;
      return draftSlide;
    }

    return rewrittenSlide;
  });

  const finalPlan: ContentPlan = {
    ...rewrittenPlan,
    slides: finalSlides,
  };

  // --- Caption guardrails (weak: numbers/dates only) ---
  let finalCaption = rewrittenCaption;

  if (draftCaption && rewrittenCaption) {
    const { violations: captionViolations } = diffMustPreserve({
      draftText: draftCaption,
      rewrittenText: rewrittenCaption,
      strictness: "weak",
    });

    if (captionViolations.length > 0) {
      for (const v of captionViolations) {
        violations.push({
          field: "caption",
          type: v.type,
          detail: v.detail,
        });
      }

      finalCaption = draftCaption;
      captionRolledBack = true;
    }
  }

  const report: GuardrailReport = {
    topicId,
    violations,
    slidesRolledBack,
    captionRolledBack,
  };

  return { plan: finalPlan, captionText: finalCaption, report };
}
