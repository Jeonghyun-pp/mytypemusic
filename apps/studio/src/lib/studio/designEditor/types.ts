import { z } from "zod";
import { LayerSchema } from "./layerTypes";
import type { Layer } from "./layerTypes";

// ── Font mood & preset ────────────────────────────────────

export const FontMoodSchema = z.enum([
  "bold-display",
  "clean-sans",
  "editorial",
  "playful",
  "minimal",
  "impact",
]);
export type FontMood = z.infer<typeof FontMoodSchema>;

export const StylePresetIdSchema = z.enum([
  "news",
  "beauty",
  "tech",
  "lifestyle",
  "finance",
  "music",
  "default",
]);
export type StylePresetId = z.infer<typeof StylePresetIdSchema>;

// ── Slide kinds & templates ────────────────────────────────

export const SlideKindSchema = z.enum(["cover", "fact", "cta", "quote", "stat", "list", "ranking", "sns", "infographic"]);
export type SlideKind = z.infer<typeof SlideKindSchema>;

export const TemplateIdSchema = z.enum([
  "cover.hero.v1",
  "cover.hero.v2",
  "cover.minimal.v1",
  "body.fact.v1",
  "body.fact.v2",
  "body.fact.v3",
  "body.fact.v4",
  "body.quote.v1",
  "body.stat.v1",
  "body.list.v1",
  "body.ranking.v1",
  "body.highlight.v1",
  "end.outro.v1",
  "end.cta.v1",
  "sns.square.v1",
  "sns.story.v1",
  "sns.twitter.v1",
  "sns.youtube.v1",
  "sns.quote.v1",
  "infographic.bar.v1",
  "infographic.donut.v1",
  "infographic.comparison.v1",
  "infographic.timeline.v1",
]);
export type TemplateId = z.infer<typeof TemplateIdSchema>;

// ── Style overrides ────────────────────────────────────────

export const SlideStyleOverridesSchema = z.object({
  bgGradient: z.string().optional(),
  textColor: z.string().optional(),
  accentColor: z.string().optional(),
  footerColor: z.string().optional(),

  titleSizePx: z.number().min(20).max(120).optional(),
  bodySizePx: z.number().min(16).max(80).optional(),
  headlineSizePx: z.number().min(16).max(60).optional(),
  titleWeight: z.number().int().min(400).max(900).optional(),
  bodyWeight: z.number().int().min(400).max(900).optional(),
  letterSpacing: z.enum(["tight", "normal", "wide"]).optional(),

  scrimOpacity: z.number().min(0).max(1).optional(),
  imageBrightness: z.number().min(0.1).max(1.0).optional(),
  cardRadius: z.number().min(0).max(48).optional(),

  // SVG effects (Phase 2)
  shadow: z
    .object({
      offsetX: z.number().min(-50).max(50),
      offsetY: z.number().min(-50).max(50),
      blur: z.number().min(0).max(50),
      color: z.string(),
    })
    .optional(),
  blur: z.number().min(0).max(30).optional(),
});
export type SlideStyleOverrides = z.infer<typeof SlideStyleOverridesSchema>;

// ── Per-slide spec ─────────────────────────────────────────

export const SlideSpecSchema = z.object({
  slideIndex: z.number().int().min(0),
  kind: SlideKindSchema,
  templateId: TemplateIdSchema,

  title: z.string(),
  bodyText: z.string(),
  footerText: z.string(),

  heroImageDataUri: z.string().optional(),
  customHtml: z.string().optional(),

  styleOverrides: SlideStyleOverridesSchema.optional(),

  /** Multi-layer mode: when present, layer compositor renders instead of templates */
  layers: z.array(LayerSchema).optional(),
});
export type SlideSpec = z.infer<typeof SlideSpecSchema>;

// ── Canvas size ───────────────────────────────────────────

export const CanvasSizeSchema = z.object({
  width: z.number().int().min(540).max(3840),
  height: z.number().int().min(540).max(3840),
  label: z.string().optional(),
});
export type CanvasSize = z.infer<typeof CanvasSizeSchema>;

// ── Hero image fit mode ───────────────────────────────────
export const HeroImageFitSchema = z.enum(["cover", "fill"]);
export type HeroImageFit = z.infer<typeof HeroImageFitSchema>;

// ── Full deck spec ─────────────────────────────────────────

export const DesignSpecSchema = z.object({
  slides: z.array(SlideSpecSchema).min(1).max(10),
  currentSlideIndex: z.number().int().min(0),
  globalStyle: SlideStyleOverridesSchema.optional(),
  deckTitle: z.string().optional(),
  fontMood: FontMoodSchema.optional(),
  presetId: StylePresetIdSchema.optional(),
  canvasSize: CanvasSizeSchema.optional(),
  heroImageFit: HeroImageFitSchema.optional(),
});
export type DesignSpec = z.infer<typeof DesignSpecSchema>;

// ── AI Design Chat types ───────────────────────────────────

export const AiDesignActionSchema = z.object({
  action: z.enum([
    "update_text",
    "update_style",
    "change_template",
    "change_kind",
    "add_slide",
    "remove_slide",
    "apply_global_style",
    "update_html",
  ]),
  slideIndex: z.number().optional(),
  textChanges: z
    .object({
      title: z.string().optional(),
      bodyText: z.string().optional(),
      footerText: z.string().optional(),
    })
    .optional(),
  styleChanges: SlideStyleOverridesSchema.optional(),
  templateId: TemplateIdSchema.optional(),
  kind: SlideKindSchema.optional(),
  html: z.string().optional(),
  explanation: z.string(),
});
export type AiDesignAction = z.infer<typeof AiDesignActionSchema>;

export const AiDesignResponseSchema = z.object({
  message: z.string(),
  actions: z.array(AiDesignActionSchema),
});
export type AiDesignResponse = z.infer<typeof AiDesignResponseSchema>;
