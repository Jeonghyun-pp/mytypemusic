import type { TopicPackage } from "./types.js";
import { pickBodyVariation, pickCoverVariation, type VariationId, type CoverVariationId } from "./selector.js";
import { STYLE_PRESETS, pickPresetByCategory, type StylePresetId } from "./presets.js";

// ============================================================================
// Slide Plan Types
// ============================================================================

export interface SlidePlan {
  index: number;
  kind: "cover" | "fact" | "outro";
  templateId: string;
  payload: Record<string, unknown>;
}

// ============================================================================
// Plan Builder
// ============================================================================

/**
 * Build an ordered slide plan from a topic.
 *
 * Structure:
 *   1. cover  (1 slide)
 *   2. fact   (min(4, keyFacts.length) slides — top 4 facts)
 *   3. outro  (1 slide)
 *
 * Total = 1 + min(4, facts) + 1
 *
 * Each fact slide gets a variationId (v1/v2/v3) via pickBodyVariation.
 * Seed: topic.topicId (if present) or topic.title.
 * Optional seedOverride takes priority over both.
 *
 * Style preset: resolved from topic.category (or explicit stylePresetId override).
 * The preset controls cover variation default, fact headline label, and outro CTA.
 */
export interface SlidePlanOptions {
  seed?: string;
  stylePresetId?: StylePresetId;
  /** Override slide count (3-15). If set, generates (slideCount - 2) fact slides. */
  slideCount?: number;
}

export function buildSlidePlan(
  topic: TopicPackage,
  options?: SlidePlanOptions,
): SlidePlan[] {
  const plans: SlidePlan[] = [];
  let idx = 1;

  // Determine seed for variation selection
  // topicId may exist in JSON but not in the strict TS type — check at runtime
  const topicAny = topic as unknown as Record<string, unknown>;
  const topicId = typeof topicAny.topicId === "string" ? topicAny.topicId : undefined;
  const seed = options?.seed ?? topicId ?? topic.title;

  // Resolve style preset: explicit override > category-based > default
  const presetId = options?.stylePresetId ?? pickPresetByCategory(topic.category);
  const preset = STYLE_PRESETS[presetId];

  // 1) Cover
  // Preset provides the default cover variation; selector is fallback when no preset preference
  const coverVariationId: CoverVariationId =
    preset.cover.defaultVariation ?? pickCoverVariation({ seed });
  plans.push({
    index: idx++,
    kind: "cover",
    templateId: `cover.hero.${coverVariationId}`,
    payload: { coverVariationId, presetId },
  });

  // 2) Fact slides
  // If slideCount is specified, generate (slideCount - 2) fact slides (minus cover + outro).
  // Otherwise default to up to 4 facts.
  const maxFacts = options?.slideCount
    ? Math.max(1, options.slideCount - 2)
    : 4;
  const topFacts = topic.keyFacts?.slice(0, maxFacts) ?? [];

  // If slideCount is specified but we don't have enough keyFacts,
  // pad with placeholder facts to reach the requested count
  while (options?.slideCount && topFacts.length < maxFacts) {
    topFacts.push(topFacts[topFacts.length - 1] ?? topic.title);
  }

  // Determine if editorial mood should force v4 template
  const isEditorialMood = preset.fontMood === "editorial" || preset.fontMood === "minimal";

  let factIndex = 0;
  for (const fact of topFacts) {
    const variationId: VariationId = isEditorialMood
      ? "v4"
      : pickBodyVariation({ seed, index: factIndex });
    plans.push({
      index: idx++,
      kind: "fact",
      templateId: `body.fact.${variationId}`,
      payload: {
        headline: preset.fact.headlineLabel,
        body: fact,
        variationId,
        presetId,
      },
    });
    factIndex++;
  }

  // 3) Outro
  plans.push({
    index: idx++,
    kind: "outro",
    templateId: "outro.cta.v1",
    payload: { cta: preset.outro.cta, presetId },
  });

  return plans;
}
