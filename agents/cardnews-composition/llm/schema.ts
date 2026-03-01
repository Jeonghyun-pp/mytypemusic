import { z } from "zod";

// ============================================================================
// LLM Slide Plan — Zod schemas & TypeScript types
// ============================================================================

export const SlideKindSchema = z.enum(["cover", "fact", "summary", "cta"]);
export type SlideKind = z.infer<typeof SlideKindSchema>;

export const LayoutSuggestionSchema = z.enum([
  "hero-overlay",
  "text-left",
  "text-right",
  "text-center",
  "split-horizontal",
  "split-vertical",
  "card-centered",
  "minimal-text",
]);
export type LayoutSuggestion = z.infer<typeof LayoutSuggestionSchema>;

export const LLMSlideContentSchema = z.object({
  slideIndex: z.number().int().min(1),
  kind: SlideKindSchema,
  title: z.string().min(1),
  bodyText: z.string(),
  imageDescription: z.string().optional(),
  layoutSuggestion: LayoutSuggestionSchema.optional(),
  templateHint: z.string().optional(),
  sourceLinks: z.array(z.string()).optional(),
});
export type LLMSlideContent = z.infer<typeof LLMSlideContentSchema>;

export const LLMSlidePlanSchema = z.object({
  topicId: z.string(),
  totalSlides: z.number().int().min(1),
  overallNarrative: z.string(),
  slides: z.array(LLMSlideContentSchema).min(1),
  hashtags: z.array(z.string()),
  captionDraft: z.string(),
  generatedAt: z.string(),
  model: z.string(),
});
export type LLMSlidePlan = z.infer<typeof LLMSlidePlanSchema>;
