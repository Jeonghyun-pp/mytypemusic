import { z } from "zod";
import type { PublishBundle } from "./contracts.js";

// ============================================================================
// PublishBundle Zod schema
// ============================================================================

const DeckSlideSchema = z.object({
  index: z.number().int().min(1),
  kind: z.enum(["cover", "fact", "summary", "cta", "credits"]),
  filePath: z.string().min(1),
});

const DeckSchema = z.object({
  size: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  format: z.literal("png"),
  slides: z.array(DeckSlideSchema),
  manifestPath: z.string().optional(),
});

const CaptionSchema = z.object({
  text: z.string(),
  hashtags: z.array(z.string()),
});

const PerImageCreditSchema = z.object({
  localPath: z.string().min(1),
  creditLine: z.string().min(1),
});

const AttributionSchema = z.object({
  captionAppendix: z.string().optional(),
  footerCredits: z.string().optional(),
  perImageCredits: z.array(PerImageCreditSchema).optional(),
});

const ComplianceSourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().min(1),
  publisher: z.string().optional(),
  publishedAt: z.string().optional(),
});

const ComplianceSchema = z.object({
  riskNotes: z.array(z.string()),
  attribution: AttributionSchema,
  sources: z.array(ComplianceSourceSchema),
});

const ProvenanceSchema = z.object({
  topicIntelPath: z.string().optional(),
  contentPlanPath: z.string().optional(),
  agent2TopicPath: z.string().optional(),
  deckManifestPath: z.string().optional(),
  validatedPostPath: z.string().optional(),
});

const PublishBundleSchema = z.object({
  topicId: z.string().min(1),
  category: z.enum(["music", "lifestyle"]),
  region: z.enum(["KR", "GLOBAL"]),
  title: z.string().min(1),
  subtitle: z.string().optional(),

  deck: DeckSchema,
  caption: CaptionSchema,
  compliance: ComplianceSchema,
  provenance: ProvenanceSchema,

  createdAt: z.string().min(1),
  version: z.literal("1.0"),
});

export function parsePublishBundle(raw: unknown): PublishBundle {
  return PublishBundleSchema.parse(raw);
}
