import type { ContentPlan } from "../contracts.js";

// ============================================================================
// Slides rewrite result shape (from LLM response)
// ============================================================================

export type SlidesRewriteResult = {
  slides: Array<{
    headline: string;
    bullets?: string[];
    note?: string;
  }>;
};

// ============================================================================
// Caption rewrite result shape (from LLM response)
// ============================================================================

export type CaptionRewriteResult = {
  captionText: string;
};

// ============================================================================
// Apply slides rewrite to draft ContentPlan
// ============================================================================

/**
 * Merge LLM-rewritten slide text into the original draft.
 *
 * Rules:
 * - draft.slides.length must equal rewritten.slides.length (throws otherwise)
 * - kind and evidenceUrls are preserved from draft (never overwritten)
 * - headline, bullets, note come from rewritten
 */
export function applySlidesRewrite(params: {
  draft: ContentPlan;
  rewritten: SlidesRewriteResult;
}): ContentPlan {
  const { draft, rewritten } = params;

  if (draft.slides.length !== rewritten.slides.length) {
    throw new Error(
      `Slide count mismatch: draft has ${String(draft.slides.length)} slides, ` +
        `rewritten has ${String(rewritten.slides.length)} slides.`,
    );
  }

  const mergedSlides = draft.slides.map((original, i) => {
    const edited = rewritten.slides[i]!;
    return {
      kind: original.kind,
      headline: edited.headline,
      bullets: edited.bullets,
      note: edited.note,
      evidenceUrls: original.evidenceUrls,
    };
  });

  return {
    ...draft,
    slides: mergedSlides,
  };
}

// ============================================================================
// Apply caption rewrite
// ============================================================================

export function applyCaptionRewrite(params: {
  draftCaption: string | undefined;
  rewritten: CaptionRewriteResult;
}): string {
  return params.rewritten.captionText;
}
