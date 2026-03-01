import { z } from "zod";
import type { TopicIntelInput, TopicRequestInput, ContentPlan, Agent2TopicPackage } from "./contracts.js";

// ============================================================================
// TopicIntelInput (minimal validation for Agent3 consumption)
// ============================================================================

const IntelSourceSchema = z.object({
  title: z.string().min(1),
  publisher: z.string().optional(),
  url: z.string().min(1),
  publishedAt: z.string().optional(),
});

const IntelKeyFactSchema = z.object({
  text: z.string().min(1),
  evidenceUrls: z.array(z.string()),
});

const TopicIntelInputSchema = z.object({
  topicId: z.string().min(1),
  normalizedTopic: z.string().min(1),
  category: z.string().min(1),
  angleCandidates: z.array(z.string()),
  sources: z.array(IntelSourceSchema),
  keyFacts: z.array(IntelKeyFactSchema),
  imageQueries: z.array(z.string()),
  riskNotes: z.array(z.string()),
  createdAt: z.string().min(1),
});

export function parseTopicIntelInput(raw: unknown): TopicIntelInput {
  return TopicIntelInputSchema.parse(raw);
}

// ============================================================================
// TopicRequestInput (minimal — only need seedKeyword + depth)
// ============================================================================

const TopicRequestInputSchema = z.object({
  seedKeyword: z.string().min(1),
  depth: z.enum(["news", "explainer", "analysis"]).optional(),
});

export function parseTopicRequestInput(raw: unknown): TopicRequestInput {
  return TopicRequestInputSchema.parse(raw);
}

// ============================================================================
// ContentPlan validation
// ============================================================================

export const ContentSlideSchema = z.object({
  kind: z.enum(["cover", "fact", "summary", "cta", "credits"]),
  headline: z.string().min(1),
  bullets: z.array(z.string()).optional(),
  note: z.string().optional(),
  evidenceUrls: z.array(z.string()).optional(),
});

const ContentCreditsSourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().min(1),
  publisher: z.string().optional(),
  publishedAt: z.string().optional(),
});

export const ContentPlanSchema = z.object({
  topicId: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  category: z.enum(["music", "lifestyle"]),
  depth: z.enum(["news", "explainer", "analysis"]),
  slides: z.array(ContentSlideSchema).min(1),
  hashtags: z.array(z.string()),
  credits: z.object({
    sources: z.array(ContentCreditsSourceSchema),
  }),
  createdAt: z.string().min(1),
});

export function parseContentPlan(raw: unknown): ContentPlan {
  return ContentPlanSchema.parse(raw);
}

// ============================================================================
// Agent2TopicPackage validation
// ============================================================================

const Agent2TopicPackageSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  category: z.string().min(1),
  keyFacts: z.array(z.string()).optional(),
  hashtags: z.array(z.string()).optional(),
});

export function parseAgent2TopicPackage(raw: unknown): Agent2TopicPackage {
  return Agent2TopicPackageSchema.parse(raw);
}
