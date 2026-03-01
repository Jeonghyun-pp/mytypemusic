import { z } from "zod";

// ============================================================================
// Agent2-side minimal subset of Agent1's validated-post.json
// Only the fields Agent2 actually consumes are validated here.
// ============================================================================

const AssetRoleEnum = z.enum([
  "background_editable",
  "hero_unedited",
  "evidence_only",
]);

// ---- AttributionLineSubsetSchema ----

export const AttributionLineSubsetSchema = z.object({
  assetId: z.string().optional(), // footerCredits may lack assetId
  text: z.string(),
  role: z.string().optional(),
  provider: z.string().optional(),
});

export type AttributionLineSubset = z.infer<typeof AttributionLineSubsetSchema>;

// ---- ValidatedAssetSubsetSchema ----

export const ValidatedAssetSubsetSchema = z.object({
  assetId: z.string().min(1),
  localPath: z.string().min(1),
  sourceUrl: z.string().url(),
  provider: z.string().optional(),
  role: AssetRoleEnum,
  license: z
    .object({
      attribution: z
        .object({
          required: z.boolean(),
          textTemplate: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  recommendedAttribution: z.string().optional(),
});

export type ValidatedAssetSubset = z.infer<typeof ValidatedAssetSubsetSchema>;

// ---- AttributionBundleSubsetSchema ----

export const AttributionBundleSubsetSchema = z.object({
  captionAppendix: z.string().optional(),
  footerCredits: z.array(AttributionLineSubsetSchema).optional(),
  perImageCredits: z.array(AttributionLineSubsetSchema).optional(),
});

export type AttributionBundleSubset = z.infer<
  typeof AttributionBundleSubsetSchema
>;

// ---- ValidatedPostSubsetSchema ----

export const ValidatedPostSubsetSchema = z.object({
  allowed: z.boolean(),
  attributionRequired: z.boolean(),
  notes: z.array(z.string()).optional(),
  requiredActions: z.array(z.string()).optional(),
  images: z.array(ValidatedAssetSubsetSchema).min(1),
  attribution: AttributionBundleSubsetSchema.optional(),
});

export type ValidatedPostSubset = z.infer<typeof ValidatedPostSubsetSchema>;
