import type { TopicPackage } from "../types.js";
import { LLMSlidePlanSchema, type LLMSlidePlan } from "./schema.js";
import { callOpenAIJSON } from "./openai-client.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompts.js";
import { buildFallbackSlidePlan } from "./fallback.js";

// ============================================================================
// generateSlidePlan — LLM-based slide plan generation
// ============================================================================

const LLM_MAX_RETRIES = 3;

export interface WebResearchSlide {
  slideIndex: number;
  keywords: string[];
  facts: Array<{
    title: string;
    description: string;
    source: string;
    link: string;
    date?: string;
  }>;
}

export interface GenerateSlidePlanParams {
  topicPackage: TopicPackage;
  slideCount: number;
  postType?: string;
  category?: string;
  topicId?: string;
  existingKeyFacts?: string[];
  angleCandidates?: string[];
  slideKeywords?: string[][];
  webResearchFacts?: WebResearchSlide[] | unknown[];
  recentTopics?: string[];
}

/**
 * Generate an LLM-based slide plan for card news.
 *
 * - Calls Claude API with topic data and slide count
 * - Validates response against Zod schema
 * - Falls back to deterministic planner on failure
 *
 * @returns LLMSlidePlan with exactly `slideCount` slides
 */
export async function generateSlidePlan(
  params: GenerateSlidePlanParams,
): Promise<LLMSlidePlan> {
  const {
    topicPackage,
    slideCount,
    postType,
    category,
    topicId: topicIdParam,
    existingKeyFacts,
    angleCandidates,
    slideKeywords,
    webResearchFacts,
    recentTopics,
  } = params;

  // Resolve topicId from param or topic data
  const topicAny = topicPackage as unknown as Record<string, unknown>;
  const topicId = topicIdParam
    ?? (typeof topicAny.topicId === "string" ? topicAny.topicId : undefined)
    ?? `topic_${Date.now()}`;

  const resolvedCategory = category ?? topicPackage.category ?? "music";
  const keyFacts = existingKeyFacts ?? topicPackage.keyFacts ?? [];

  // Build messages
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({
    topicId,
    title: topicPackage.title,
    category: resolvedCategory,
    slideCount,
    keyFacts,
    angleCandidates,
    postType,
    slideKeywords,
    webResearchFacts: webResearchFacts as WebResearchSlide[] | undefined,
    recentTopics,
  });

  // Try LLM call with retries
  let lastError: unknown;

  for (let attempt = 0; attempt < LLM_MAX_RETRIES; attempt++) {
    try {
      const result = await callOpenAIJSON(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        {
          model: process.env["LLM_SLIDE_PLAN_MODEL"] ?? undefined,
          temperature: 0.7,
          maxTokens: 4096,
          timeoutMs: 30_000,
        },
      );

      // Parse and validate
      const parsed = JSON.parse(result.text) as unknown;
      const plan = LLMSlidePlanSchema.parse(parsed);

      // Ensure slide count matches (LLM may ignore instruction)
      if (plan.slides.length !== slideCount) {
        console.warn(
          `[llm-plan] LLM returned ${plan.slides.length} slides, expected ${slideCount}. Attempt ${attempt + 1}/${LLM_MAX_RETRIES}.`,
        );
        lastError = new Error(`Slide count mismatch: got ${plan.slides.length}, expected ${slideCount}`);
        continue;
      }

      // Stamp metadata
      plan.generatedAt = new Date().toISOString();
      plan.model = process.env["LLM_SLIDE_PLAN_MODEL"] ?? "gpt-4o";
      plan.topicId = topicId;
      plan.totalSlides = slideCount;

      return plan;
    } catch (err) {
      lastError = err;
      console.warn(
        `[llm-plan] Attempt ${attempt + 1}/${LLM_MAX_RETRIES} failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // Fallback to deterministic planner
  console.warn(
    `[llm-plan] All ${LLM_MAX_RETRIES} attempts failed. Falling back to deterministic planner.`,
    lastError instanceof Error ? lastError.message : String(lastError),
  );

  return buildFallbackSlidePlan({
    topic: topicPackage,
    slideCount,
    topicId,
  });
}
