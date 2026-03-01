import { buildContent, type RewriteSummary } from "../index.js";
import type { RewriteConfig } from "../rewrite/contracts.js";

export type ContentRunResult = {
  topicId: string;
  contentPlanPath: string;
  captionDraftPath: string;
  slides: number;
  hashtags: number;
  rewriteSummary?: RewriteSummary;
};

/**
 * Run content structuring for a given topicId.
 *
 * Pipeline: Draft → Rewrite (optional) → QA/Autofix (placeholder) → Save
 */
export async function runContent(params: {
  topicId: string;
  rewrite?: Partial<RewriteConfig>;
}): Promise<ContentRunResult> {
  const { topicId, rewrite } = params;
  const result = await buildContent(topicId, { rewrite });

  return {
    topicId,
    contentPlanPath: result.savedPaths.contentPlanPath,
    captionDraftPath: result.savedPaths.captionDraftPath,
    slides: result.contentPlan.slides.length,
    hashtags: result.contentPlan.hashtags.length,
    rewriteSummary: result.rewriteSummary,
  };
}
