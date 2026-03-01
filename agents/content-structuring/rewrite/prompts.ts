import type { RewriteConfig, RewriteInput } from "./contracts.js";
import type { LLMMessage } from "./providers/types.js";
import { buildSystemRules } from "./prompts/common.js";
import { buildSlidesUserPrompt, type SlideProfile } from "./prompts/slides.js";
import { buildCaptionUserPrompt } from "./prompts/caption.js";
import { buildGenerateSystemPrompt, buildGenerateUserPrompt } from "./prompts/generate.js";

// ============================================================================
// Public entry: build LLM messages for rewrite
// ============================================================================

export function buildRewriteMessages(params: {
  config: RewriteConfig;
  input: RewriteInput;
  target: "slides" | "caption";
  profiles?: Record<string, SlideProfile>;
}): LLMMessage[] {
  const { config, input, target, profiles } = params;

  // --- Generate mode: different prompts for slides ---
  if (config.mode === "generate" && target === "slides") {
    const systemMessage: LLMMessage = {
      role: "system",
      content: buildGenerateSystemPrompt({
        forbidNewFacts: config.forbidNewFacts,
        forbidEntityChanges: config.forbidEntityChanges,
        enforceProfiles: config.enforceProfiles,
      }),
    };

    const slideKinds = input.contentPlan.slides.map((s) => s.kind);

    const userMessage: LLMMessage = {
      role: "user",
      content: buildGenerateUserPrompt({
        keyFacts: input.keyFacts,
        angleCandidates: input.angleCandidates ?? [],
        category: input.category,
        depth: input.depth,
        slideCount: input.contentPlan.slides.length,
        slideKinds,
        profiles,
      }),
    };

    return [systemMessage, userMessage];
  }

  // --- Rewrite modes (slides, caption, all) + generate caption ---
  const systemMessage: LLMMessage = {
    role: "system",
    content: buildSystemRules({
      forbidNewFacts: config.forbidNewFacts,
      forbidEntityChanges: config.forbidEntityChanges,
      enforceProfiles: config.enforceProfiles,
    }),
  };

  if (target === "slides") {
    const userMessage: LLMMessage = {
      role: "user",
      content: buildSlidesUserPrompt({
        contentPlan: input.contentPlan,
        keyFacts: input.keyFacts,
        category: input.category,
        depth: input.depth,
        profiles,
      }),
    };

    return [systemMessage, userMessage];
  }

  // target === "caption"
  const captionDraft = input.captionDraft ?? "";

  const userMessage: LLMMessage = {
    role: "user",
    content: buildCaptionUserPrompt({
      captionDraft,
      angleCandidate: input.angleCandidates?.[0],
      category: input.category,
      depth: input.depth,
      hashtags: input.contentPlan.hashtags,
    }),
  };

  return [systemMessage, userMessage];
}
