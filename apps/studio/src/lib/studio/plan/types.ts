import { z } from "zod";

// ── Content type & status (shared with calendar) ─────────

export const ContentTypeSchema = z.enum(["post", "reels", "promotion"]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

// ── Category IDs (must match CONTENT_CATEGORIES) ─────────

export const CategoryIdSchema = z.enum([
  "scene-news",
  "live-experience",
  "artist-deep-dive",
  "playlist",
  "nerd-analysis",
  "culture-crossover",
  "seasonal-special",
  "song-spotlight",
]);
export type CategoryId = z.infer<typeof CategoryIdSchema>;

// ── Plan item ────────────────────────────────────────────

export const PlanItemSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1),
  description: z.string(),
  type: ContentTypeSchema,
  category: CategoryIdSchema,
  tags: z.array(z.string()),
  reasoning: z.string(),
  addedToCalendar: z.boolean(),
  calendarEventId: z.string().optional(),
});
export type PlanItem = z.infer<typeof PlanItemSchema>;

// ── Frequency config ─────────────────────────────────────

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;
export { DAY_LABELS };

export const FrequencyConfigSchema = z.object({
  weeklyTotal: z.number().int().min(1).max(21),
  maxPerDay: z.number().int().min(1).max(5),
  heavyDays: z.array(z.number().int().min(0).max(6)).optional(), // 0=일 ~ 6=토
});
export type FrequencyConfig = z.infer<typeof FrequencyConfigSchema>;

// ── Saved plan generation ────────────────────────────────

export const PlanPreferencesSchema = z.object({
  focusCategories: z.array(CategoryIdSchema).optional(),
  avoidCategories: z.array(CategoryIdSchema).optional(),
  typeRatio: z
    .object({
      post: z.number().min(0).max(100),
      reels: z.number().min(0).max(100),
      promotion: z.number().min(0).max(100),
    })
    .optional(),
  notes: z.string().optional(),
});
export type PlanPreferences = z.infer<typeof PlanPreferencesSchema>;

export interface ContentPlanGeneration {
  id: string;
  startDate: string;
  endDate: string;
  frequency: FrequencyConfig;
  items: PlanItem[];
  summary: string;
  createdAt: string;
  preferences?: PlanPreferences;
}

// ── API request / response ───────────────────────────────

export const PlanGenerateRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  frequency: FrequencyConfigSchema,
  existingEvents: z
    .array(
      z.object({
        date: z.string(),
        title: z.string(),
        category: z.string(),
      }),
    )
    .optional(),
  preferences: PlanPreferencesSchema.optional(),
});
export type PlanGenerateRequest = z.infer<typeof PlanGenerateRequestSchema>;

export const PlanGenerateResponseSchema = z.object({
  items: z.array(
    z.object({
      date: z.string(),
      title: z.string(),
      description: z.string(),
      type: ContentTypeSchema,
      category: CategoryIdSchema,
      tags: z.array(z.string()),
      reasoning: z.string(),
    }),
  ),
  summary: z.string(),
});
export type PlanGenerateResponse = z.infer<typeof PlanGenerateResponseSchema>;
