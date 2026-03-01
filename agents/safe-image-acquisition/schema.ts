import { z } from "zod";

const IntendedUseEnum = z.enum(["commercial", "editorial"]);
const ChannelEnum = z.enum(["instagram", "web", "print"]);
const TransformEnum = z.enum([
  "resize",
  "crop",
  "text_overlay",
  "composite",
  "color_grade",
]);
const ModelReleaseEnum = z.enum(["unknown", "provided", "not_provided"]);
const PropertyReleaseEnum = z.enum(["unknown", "provided", "not_provided"]);
const ConfidenceEnum = z.enum(["high", "medium", "low"]);
const AssetRoleEnum = z.enum(["background_editable", "hero_unedited", "evidence_only"]);

const isoDateTimeRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const ImageCategoryEnum = z.enum(["music", "fashion", "celebrity", "issue"]);

export const ImageBriefSchema = z.object({
  topic: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
  intendedUse: IntendedUseEnum,
  channel: ChannelEnum,
  requiresDerivative: z.boolean(),
  allowPeople: z.boolean(),
  allowLogos: z.boolean(),
  targetTerritory: z.string().optional(),
  category: ImageCategoryEnum.optional(),
});

export const RawImageCandidateSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  previewUrl: z.string().url(),
  sourceUrl: z.string().url(),
  author: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const LicenseProfileSchema = z
  .object({
    provider: z.string().min(1),
    sourceUrl: z.string().url(),
    licenseUrl: z.string().url().optional(),
    licenseText: z.string().optional(),

    allowedUses: z.array(IntendedUseEnum).min(1),
    allowedChannels: z.union([z.array(ChannelEnum).min(1), z.literal("any")]),
    territory: z.union([z.literal("worldwide"), z.array(z.string().min(1))]),
    expiry: z
      .string()
      .regex(isoDateTimeRegex, "Must be a valid ISO 8601 datetime string")
      .optional(),

    derivatives: z.object({
      allowed: z.boolean(),
      allowedTransforms: z
        .union([z.array(TransformEnum).min(1), z.literal("any")])
        .optional(),
      prohibitedTransforms: z.array(TransformEnum).optional(),
    }),

    attribution: z.object({
      required: z.boolean(),
      textTemplate: z.string().optional(),
    }),

    modelRelease: ModelReleaseEnum,
    propertyRelease: PropertyReleaseEnum,

    restrictions: z.object({
      editorialOnly: z.boolean().optional(),
      noCommercial: z.boolean().optional(),
      noDerivatives: z.boolean().optional(),
      noAITraining: z.boolean().optional(),
      sensitiveUseProhibited: z.boolean().optional(),
      trademarkRestricted: z.boolean().optional(),
    }),

    confidence: ConfidenceEnum,
  })
  .refine(
    (data) => {
      if (!data.derivatives.allowed) {
        return data.derivatives.allowedTransforms === undefined;
      }
      return true;
    },
    {
      message:
        "allowedTransforms must be undefined when derivatives.allowed is false",
      path: ["derivatives", "allowedTransforms"],
    }
  );

export const RiskFlagsSchema = z.object({
  containsPerson: z.boolean(),
  containsLogo: z.boolean(),
  hasWatermark: z.boolean(),
  celebrityLikelihood: z.boolean(),
});

export const ValidatedAssetSchema = z.object({
  assetId: z.string().min(1),
  provider: z.string().min(1),
  localPath: z.string().min(1),
  sourceUrl: z.string().url(),
  license: LicenseProfileSchema,
  proof: z.object({
    capturedAt: z
      .string()
      .regex(isoDateTimeRegex, "Must be a valid ISO 8601 datetime string"),
    sourceHash: z.string().min(1),
    licenseHash: z.string().optional(),
  }),
  risk: z.object({
    flags: RiskFlagsSchema,
    riskScore: z.number().min(0).max(100),
  }),
  role: AssetRoleEnum,
  recommendedAttribution: z.string().optional(),
});
