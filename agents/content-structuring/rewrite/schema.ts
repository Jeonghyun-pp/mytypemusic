import { z } from "zod";
import { ContentPlanSchema } from "../schema.js";

// ============================================================================
// RewriteConfigSchema
// ============================================================================

export const RewriteModeSchema = z.enum(["off", "slides", "caption", "all", "generate"]);

export const RewriteProviderSchema = z.enum(["openai", "anthropic", "mock"]);

export const RewriteConfigSchema = z.object({
  mode: RewriteModeSchema,
  provider: RewriteProviderSchema,
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  maxRetries: z.number().int().min(0),
  timeoutMs: z.number().int().positive(),
  enforceProfiles: z.boolean(),
  forbidNewFacts: z.boolean(),
  forbidEntityChanges: z.boolean(),
});

// ============================================================================
// RewriteOutputSchema — minimal validation for LLM output
// ============================================================================

export const RewriteOutputSchema = z.object({
  contentPlan: ContentPlanSchema,
  captionText: z.string().optional(),

  provider: RewriteProviderSchema,
  model: z.string().min(1),
  mode: RewriteModeSchema,
  appliedAt: z.string().min(1),
});

export function parseRewriteOutput(raw: unknown) {
  return RewriteOutputSchema.parse(raw);
}
