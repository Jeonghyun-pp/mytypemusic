import { z } from "zod";
import type { SignalRequest, SignalResult } from "./contracts.js";
import { NormalizedArticleSchema } from "../topic-intelligence/schema.js";

// ============================================================================
// SignalRequest Schema
// ============================================================================

export const SignalRequestSchema = z.object({
  seedKeyword: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "seedKeyword must be non-empty after trim")),
  sources: z
    .array(z.enum(["youtube", "instagram"]))
    .min(1, "at least one source required"),
  region: z.enum(["KR", "US", "GLOBAL"]).optional(),
  maxResults: z.number().int().min(1).max(50).optional(),
});

// ============================================================================
// SignalResult Schema
// ============================================================================

const SourceSummarySchema = z.object({
  sourceId: z.enum(["youtube", "instagram"]),
  count: z.number().int().nonnegative(),
  errors: z.array(z.string()),
});

export const SignalResultSchema = z.object({
  seedKeyword: z.string().min(1),
  articles: z.array(NormalizedArticleSchema),
  sourceSummaries: z.array(SourceSummarySchema),
  collectedAt: z.string().datetime(),
});

// ============================================================================
// Parse helpers
// ============================================================================

export function parseSignalRequest(input: unknown): SignalRequest {
  return SignalRequestSchema.parse(input) as SignalRequest;
}

export function parseSignalResult(input: unknown): SignalResult {
  return SignalResultSchema.parse(input) as SignalResult;
}
