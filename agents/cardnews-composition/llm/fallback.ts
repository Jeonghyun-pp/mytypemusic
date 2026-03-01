import { buildSlidePlan, type SlidePlan, type SlidePlanOptions } from "../story-planner.js";
import type { TopicPackage } from "../types.js";
import type { LLMSlidePlan, LLMSlideContent, SlideKind } from "./schema.js";

// ============================================================================
// Fallback: convert deterministic SlidePlan → LLMSlidePlan format
// Used when LLM call fails after retries
// ============================================================================

/**
 * Generate a slide plan using the deterministic planner,
 * then convert it to LLMSlidePlan format for downstream compatibility.
 */
export function buildFallbackSlidePlan(params: {
  topic: TopicPackage;
  slideCount: number;
  topicId: string;
  options?: SlidePlanOptions;
}): LLMSlidePlan {
  const { topic, slideCount, topicId, options } = params;

  const deterministicPlan = buildSlidePlan(topic, {
    ...options,
    slideCount,
  });

  const slides: LLMSlideContent[] = deterministicPlan.map((sp) => ({
    slideIndex: sp.index,
    kind: mapDeterministicKind(sp.kind),
    title: extractTitle(sp, topic),
    bodyText: extractBody(sp, topic),
    imageDescription: topic.title,
    layoutSuggestion: sp.kind === "cover" ? "hero-overlay" as const : "text-center" as const,
    templateHint: sp.templateId,
  }));

  return {
    topicId,
    totalSlides: slides.length,
    overallNarrative: `${topic.title} — deterministic fallback plan`,
    slides,
    hashtags: topic.hashtags ?? [],
    captionDraft: [topic.title, topic.subtitle, topic.bodyText].filter(Boolean).join("\n"),
    generatedAt: new Date().toISOString(),
    model: "deterministic-fallback",
  };
}

function mapDeterministicKind(kind: "cover" | "fact" | "outro"): SlideKind {
  if (kind === "outro") return "cta";
  return kind;
}

function extractTitle(sp: SlidePlan, topic: TopicPackage): string {
  if (sp.kind === "cover") return topic.title;
  if (sp.kind === "fact") {
    const payload = sp.payload as { headline?: string };
    return payload.headline ?? "핵심 포인트";
  }
  if (sp.kind === "outro") {
    const payload = sp.payload as { cta?: string };
    return payload.cta ?? "저장 & 팔로우";
  }
  return topic.title;
}

function extractBody(sp: SlidePlan, topic: TopicPackage): string {
  if (sp.kind === "cover") return topic.subtitle ?? "";
  if (sp.kind === "fact") {
    const payload = sp.payload as { body?: string };
    return payload.body ?? "";
  }
  if (sp.kind === "outro") {
    const payload = sp.payload as { cta?: string };
    return payload.cta ?? "";
  }
  return "";
}
