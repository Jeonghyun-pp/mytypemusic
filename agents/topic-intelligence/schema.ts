import { z } from "zod";
import type { TopicRequest, TopicIntelPack } from "./contracts.js";
import type { NormalizedArticle } from "./phase1/feeds/normalize.js";

// ============================================================================
// NormalizedArticle Schema (shared with trend-signals agent)
// ============================================================================

const MetricsBlockSchema = z.object({
  views: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional(),
});

export const NormalizedArticleSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  publishedAt: z.string().optional(),
  publisher: z.string().optional(),
  snippet: z.string().optional(),
  feedId: z.string().min(1),
  feedTitle: z.string().min(1),
  sourceType: z.enum(["rss", "news-rss", "naver-news", "youtube", "instagram"]).optional(),
  metrics: MetricsBlockSchema.optional(),
});

export function parseNormalizedArticles(input: unknown): NormalizedArticle[] {
  return z.array(NormalizedArticleSchema).parse(input);
}

// ============================================================================
// TopicRequest Schema
// ============================================================================

export const TopicRequestSchema = z.object({
  mode: z.enum(["manual", "auto"]),
  seedKeyword: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "seedKeyword must be non-empty after trim")),
  category: z.enum(["music", "lifestyle"]).optional(),
  depth: z.enum(["news", "explainer", "analysis"]).optional(),
  region: z.enum(["KR", "GLOBAL"]).optional(),
  maxArticles: z.number().int().min(1).max(50).optional(),
  recencyDays: z.number().int().min(1).max(30).optional(),
  searchEntities: z.array(z.string().min(1)).optional(),
});

// ============================================================================
// TopicIntelPack Schema
// ============================================================================

const TopicSourceSchema = z.object({
  title: z.string().min(1),
  publisher: z.string().optional(),
  url: z.string().url(),
  publishedAt: z.string().optional(),
});

const TopicKeyFactSchema = z.object({
  text: z.string().min(20, "keyFact text must be at least 20 characters"),
  evidenceUrls: z.array(z.string().url()).min(1, "at least 1 evidence URL required"),
});

export const TopicIntelPackSchema = z.object({
  topicId: z.string().min(1),
  normalizedTopic: z.string().min(1),
  category: z.string().min(1),
  angleCandidates: z.array(
    z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(1)),
  ),
  sources: z.array(TopicSourceSchema),
  keyFacts: z.array(TopicKeyFactSchema),
  imageQueries: z.array(z.string()),
  riskNotes: z.array(z.string()),
  createdAt: z.string().datetime(),
});

// ============================================================================
// Parse helpers
// ============================================================================

export function parseTopicRequest(input: unknown): TopicRequest {
  return TopicRequestSchema.parse(input);
}

export function parseTopicIntelPack(input: unknown): TopicIntelPack {
  return TopicIntelPackSchema.parse(input);
}
