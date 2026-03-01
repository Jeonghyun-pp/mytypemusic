import {
  getTopicIntelPath,
  getTopicRequestPath,
  getContentPlanPath,
  getCaptionDraftPath,
  getRewriteReportPath,
} from "./io/paths.js";
import { loadJson } from "./io/load.js";
import { saveJson, saveText } from "./io/save.js";
import { parseTopicIntelInput, parseTopicRequestInput } from "./schema.js";
import { buildCoverTitle, buildSubtitle } from "./build/title.js";
import { buildSlides } from "./build/slides.js";
import { buildHashtags } from "./build/hashtags.js";
import { buildCaptionDraft } from "./build/caption.js";
import type { ContentPlan, TopicIntelInput } from "./contracts.js";
import { resolveRewriteConfig } from "./rewrite/config.js";
import { runRewrite } from "./rewrite/runner.js";
import type { RewriteConfig, RewriteMode, RewriteProvider } from "./rewrite/contracts.js";
import type { GuardrailReport } from "./rewrite/guardrails/report.js";
import { clampCaptionLength } from "../shared/qa/technical.js";

// ============================================================================
// Re-exports: rewrite module
// ============================================================================

export type {
  RewriteMode,
  RewriteProvider,
  RewriteConfig,
  RewriteInput,
  RewriteOutput,
} from "./rewrite/contracts.js";

export {
  RewriteModeSchema,
  RewriteProviderSchema,
  RewriteConfigSchema,
  RewriteOutputSchema,
  parseRewriteOutput,
} from "./rewrite/schema.js";

export {
  getDefaultRewriteConfig,
  resolveRewriteConfig,
} from "./rewrite/config.js";

export { runRewrite, type RunRewriteResult } from "./rewrite/runner.js";
export { extractJSONObject, safeJsonParse } from "./rewrite/json.js";
export {
  applySlidesRewrite,
  applyCaptionRewrite,
  type SlidesRewriteResult,
  type CaptionRewriteResult,
} from "./rewrite/apply.js";

export { enforceGuardrails } from "./rewrite/guardrails/enforce.js";
export type {
  GuardrailViolation,
  GuardrailReport,
} from "./rewrite/guardrails/report.js";
export {
  extractNumbers,
  extractDates,
  extractProperNounsHeuristic,
  normalizeToken,
} from "./rewrite/guardrails/extract.js";
export {
  diffMustPreserve,
  collectSlideText,
} from "./rewrite/guardrails/compare.js";

// ============================================================================
// Types
// ============================================================================

export type BuildContentOptions = {
  rewrite?: Partial<RewriteConfig>;
};

export type RewriteSummary = {
  mode: RewriteMode;
  provider: RewriteProvider;
  model: string;
  warnings: string[];
  guardrailReport?: GuardrailReport;
};

export type ContentResult = {
  contentPlan: ContentPlan;
  captionDraft: string;
  savedPaths: {
    contentPlanPath: string;
    captionDraftPath: string;
  };
  rewriteSummary?: RewriteSummary;
};

// ============================================================================
// Main
// ============================================================================

/**
 * Build a ContentPlan + caption draft from a topicId.
 *
 * Pipeline:
 *   1. Load topic-intel.json (required) + topic-request.json (optional)
 *   2. Build draft: title, slides, hashtags, caption
 *   3. Rewrite (LLM polish, if enabled)
 *   4. QA/Autofix (deterministic clamp — placeholder for 12-D)
 *   5. Save content-plan.json + caption.draft.txt
 */
export async function buildContent(
  topicId: string,
  options?: BuildContentOptions,
): Promise<ContentResult> {
  // ── 1) Load topic-intel.json ──
  const intelPath = getTopicIntelPath(topicId);
  const rawIntel = await loadJson<unknown>(intelPath);
  const intel: TopicIntelInput = parseTopicIntelInput(rawIntel);

  // ── 2) Load topic-request.json (optional — for depth) ──
  let depth: "news" | "explainer" | "analysis" = "explainer";
  try {
    const reqPath = getTopicRequestPath(topicId);
    const rawReq = await loadJson<unknown>(reqPath);
    const req = parseTopicRequestInput(rawReq);
    if (req.depth) {
      depth = req.depth;
    }
  } catch {
    // topic-request.json missing or invalid — use default depth
  }

  // ── 3) Validate category ──
  const category: "music" | "lifestyle" =
    intel.category === "music" ? "music" : "lifestyle";

  // ── 4) Build draft ──
  const title = buildCoverTitle(intel);
  const subtitle = buildSubtitle(intel);
  const { slides, creditsSources } = buildSlides(intel, title, subtitle);
  const hashtags = buildHashtags(intel);

  const draftPlan: ContentPlan = {
    topicId,
    title,
    subtitle,
    category,
    depth,
    slides,
    hashtags,
    credits: { sources: creditsSources },
    createdAt: new Date().toISOString(),
  };

  const draftCaption = buildCaptionDraft(intel, hashtags);

  // ── 5) Rewrite (LLM polish) ──
  const rewriteConfig = resolveRewriteConfig(options?.rewrite);
  let finalPlan = draftPlan;
  let finalCaption = draftCaption;
  let rewriteSummary: RewriteSummary | undefined;

  if (rewriteConfig.mode !== "off") {
    console.log(`\n[rewrite] mode=${rewriteConfig.mode} provider=${rewriteConfig.provider} model=${rewriteConfig.model}`);

    const rewriteResult = await runRewrite({
      config: rewriteConfig,
      input: {
        topicId,
        category,
        depth,
        contentPlan: draftPlan,
        captionDraft: draftCaption,
        keyFacts: intel.keyFacts,
        angleCandidates: intel.angleCandidates,
        riskNotes: intel.riskNotes,
      },
    });

    finalPlan = rewriteResult.output.contentPlan;
    finalCaption = rewriteResult.output.captionText ?? draftCaption;

    rewriteSummary = {
      mode: rewriteConfig.mode,
      provider: rewriteConfig.provider,
      model: rewriteConfig.model,
      warnings: rewriteResult.warnings,
      guardrailReport: rewriteResult.guardrailReport,
    };

    // Log warnings
    if (rewriteResult.warnings.length > 0) {
      console.log(`[rewrite] warnings (${String(rewriteResult.warnings.length)}):`);
      for (const w of rewriteResult.warnings) {
        console.log(`  - ${w}`);
      }
    }

    const gr = rewriteResult.guardrailReport;
    if (gr) {
      console.log(
        `[rewrite] guardrails: violations=${String(gr.violations.length)} slidesRolledBack=${String(gr.slidesRolledBack)} captionRolledBack=${String(gr.captionRolledBack)}`,
      );
    }

    // Save rewrite report (best-effort)
    try {
      const reportPath = getRewriteReportPath(topicId);
      await saveJson(reportPath, {
        topicId,
        provider: rewriteConfig.provider,
        model: rewriteConfig.model,
        mode: rewriteConfig.mode,
        appliedAt: rewriteResult.output.appliedAt,
        warnings: rewriteResult.warnings,
        guardrails: gr
          ? {
              slidesRolledBack: gr.slidesRolledBack,
              captionRolledBack: gr.captionRolledBack,
              violationsCount: gr.violations.length,
            }
          : null,
      });
    } catch {
      console.log("[rewrite] warning: failed to save rewrite.report.json");
    }

    console.log("[rewrite] done\n");
  }

  // ── 6) QA/Autofix (deterministic clamp) ──
  finalCaption = clampCaptionLength(finalCaption, 2200);

  // ── 7) Save ──
  const contentPlanPath = getContentPlanPath(topicId);
  await saveJson(contentPlanPath, finalPlan);

  const captionDraftPath = getCaptionDraftPath(topicId);
  await saveText(captionDraftPath, finalCaption);

  return {
    contentPlan: finalPlan,
    captionDraft: finalCaption,
    savedPaths: { contentPlanPath, captionDraftPath },
    rewriteSummary,
  };
}
