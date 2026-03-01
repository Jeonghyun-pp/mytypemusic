import { z } from "zod";

// ============================================================================
// StyleProfile — extracted from reference images via Claude Vision
// ============================================================================

export const LayoutTypeSchema = z.enum([
  "hero-overlay",
  "split-horizontal",
  "split-vertical",
  "card-centered",
  "grid",
  "minimal-text",
]);

export const TextPositionSchema = z.enum(["top", "center", "bottom", "left", "right"]);
export const ImageRoleSchema = z.enum(["background-full", "inset", "grid", "none"]);
export const TypographyMoodSchema = z.enum(["bold-display", "clean-sans", "editorial", "playful", "minimal", "impact"]);
export const SpacingDensitySchema = z.enum(["tight", "normal", "airy"]);
export const LetterSpacingSchema = z.enum(["tight", "normal", "wide"]);

export const GradientStopSchema = z.object({
  color: z.string(),
  position: z.number().min(0).max(100),
});

export const StyleProfileSchema = z.object({
  profileId: z.string(),

  layout: z.object({
    type: LayoutTypeSchema,
    textPosition: TextPositionSchema,
    imageRole: ImageRoleSchema,
    elementRatio: z.object({
      imagePercent: z.number().min(0).max(100),
      textPercent: z.number().min(0).max(100),
    }),
  }),

  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    textColor: z.string(),
    gradientDirection: z.number().optional(),
    gradientStops: z.array(GradientStopSchema).optional(),
  }),

  typography: z.object({
    mood: TypographyMoodSchema,
    titleWeight: z.number().int().min(400).max(900),
    bodyWeight: z.number().int().min(400).max(900),
    letterSpacing: LetterSpacingSchema,
  }),

  spacing: z.object({
    density: SpacingDensitySchema,
    usesCards: z.boolean(),
    cardRadius: z.number().optional(),
    usesAccentBars: z.boolean(),
  }),

  referenceImagePaths: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type StyleProfile = z.infer<typeof StyleProfileSchema>;
