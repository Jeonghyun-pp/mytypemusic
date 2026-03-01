import { z } from "zod";
import type { RewriteConfig, RewriteInput, RewriteOutput } from "./contracts.js";
import { buildRewriteMessages } from "./prompts.js";
import { getProvider } from "./providers/index.js";
import { RewriteOutputSchema } from "./schema.js";
import { extractJSONObject, safeJsonParse } from "./json.js";
import {
  applySlidesRewrite,
  applyCaptionRewrite,
  type SlidesRewriteResult,
  type CaptionRewriteResult,
} from "./apply.js";
import { enforceGuardrails } from "./guardrails/enforce.js";
import type { GuardrailReport } from "./guardrails/report.js";
import type { SlideProfile } from "./prompts/slides.js";

// ============================================================================
// Local Zod schemas for LLM response shapes
// ============================================================================

const SlidesRewriteSchema = z.object({
  slides: z.array(
    z.object({
      headline: z.string().min(1),
      bullets: z.array(z.string()).optional(),
      note: z.string().optional(),
    }),
  ),
});

const CaptionRewriteSchema = z.object({
  captionText: z.string().min(1),
});

// ============================================================================
// Check if mode includes a given target
// ============================================================================

function modeIncludes(
  mode: RewriteConfig["mode"],
  target: "slides" | "caption",
): boolean {
  if (mode === "all" || mode === "generate") return true;
  return mode === target;
}

// ============================================================================
// Runner
// ============================================================================

export type RunRewriteResult = {
  output: RewriteOutput;
  warnings: string[];
  guardrailReport?: GuardrailReport;
};

export async function runRewrite(params: {
  config: RewriteConfig;
  input: RewriteInput;
  profiles?: Record<string, SlideProfile>;
}): Promise<RunRewriteResult> {
  const { config, input, profiles } = params;
  const warnings: string[] = [];

  // --- mode=off: passthrough ---
  if (config.mode === "off") {
    const output: RewriteOutput = {
      contentPlan: input.contentPlan,
      captionText: input.captionDraft,
      provider: config.provider,
      model: config.model,
      mode: config.mode,
      appliedAt: new Date().toISOString(),
    };
    return { output, warnings };
  }

  const provider = getProvider(config.provider);
  let contentPlan = input.contentPlan;
  let captionText: string | undefined = input.captionDraft;

  // --- Slides rewrite ---
  if (modeIncludes(config.mode, "slides")) {
    try {
      const messages = buildRewriteMessages({
        config,
        input,
        target: "slides",
        profiles,
      });

      const resp = await provider.generateJSON({ config, messages });
      const jsonText = extractJSONObject(resp.jsonText ?? resp.rawText);
      const parsed = safeJsonParse(jsonText);
      const validated: SlidesRewriteResult = SlidesRewriteSchema.parse(parsed);

      contentPlan = applySlidesRewrite({ draft: contentPlan, rewritten: validated });
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      warnings.push(`slides_rewrite_failed: ${reason}`);
      // fallback: keep draft slides
    }
  }

  // --- Caption rewrite ---
  if (modeIncludes(config.mode, "caption")) {
    try {
      const messages = buildRewriteMessages({
        config,
        input,
        target: "caption",
        profiles,
      });

      const resp = await provider.generateJSON({ config, messages });
      const jsonText = extractJSONObject(resp.jsonText ?? resp.rawText);
      const parsed = safeJsonParse(jsonText);
      const validated: CaptionRewriteResult = CaptionRewriteSchema.parse(parsed);

      captionText = applyCaptionRewrite({
        draftCaption: input.captionDraft,
        rewritten: validated,
      });
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      warnings.push(`caption_rewrite_failed: ${reason}`);
      // fallback: keep draft caption
    }
  }

  // --- Guardrails: entity/number/date preservation ---
  const guardrailResult = enforceGuardrails({
    topicId: input.topicId,
    draftPlan: input.contentPlan,
    rewrittenPlan: contentPlan,
    draftCaption: input.captionDraft,
    rewrittenCaption: captionText,
    mode: config.mode,
  });

  contentPlan = guardrailResult.plan;
  captionText = guardrailResult.captionText;
  const guardrailReport = guardrailResult.report;

  if (guardrailReport.slidesRolledBack > 0) {
    warnings.push(
      `guardrails: rolled_back_slides=${String(guardrailReport.slidesRolledBack)}`,
    );
  }
  if (guardrailReport.captionRolledBack) {
    warnings.push("guardrails: caption_rolled_back");
  }
  if (guardrailReport.violations.length > 0) {
    warnings.push(
      `guardrails: ${String(guardrailReport.violations.length)} violation(s) detected`,
    );
  }

  // --- Assemble output ---
  const output: RewriteOutput = {
    contentPlan,
    captionText,
    provider: config.provider,
    model: config.model,
    mode: config.mode,
    appliedAt: new Date().toISOString(),
  };

  // Final validation
  RewriteOutputSchema.parse(output);

  return { output, warnings, guardrailReport };
}
