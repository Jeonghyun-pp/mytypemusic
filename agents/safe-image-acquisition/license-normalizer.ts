import type { LicenseProfile } from "./types.js";

const isoDateRegex =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/;

export function normalizeLicense(input: LicenseProfile): LicenseProfile {
  let allowedUses = [...input.allowedUses];
  let derivativesAllowed = input.derivatives.allowed;
  let allowedTransforms = input.derivatives.allowedTransforms;
  let prohibitedTransforms = input.derivatives.prohibitedTransforms;
  let confidence = input.confidence;
  let territory: "worldwide" | string[] =
    input.territory === "worldwide"
      ? "worldwide"
      : [...input.territory];

  // A) restrictions 정합성
  if (input.restrictions.editorialOnly === true) {
    allowedUses = allowedUses.filter((u) => u === "editorial");
    if (allowedUses.length === 0) {
      allowedUses = ["editorial"];
    }
  }

  if (input.restrictions.noCommercial === true) {
    allowedUses = allowedUses.filter((u) => u !== "commercial");
  }

  if (input.restrictions.noDerivatives === true) {
    derivativesAllowed = false;
    allowedTransforms = undefined;
    prohibitedTransforms = undefined;
  }

  // B) derivatives 정합성
  if (!derivativesAllowed) {
    allowedTransforms = undefined;
    prohibitedTransforms = undefined;
  }

  // C) confidence 보정
  if (!input.licenseUrl && !input.licenseText) {
    confidence = "low";
  } else if (
    input.licenseUrl &&
    input.sourceUrl &&
    allowedUses.length > 0 &&
    confidence === "low"
  ) {
    confidence = "medium";
  }

  // D) territory 정합성
  if (Array.isArray(territory) && territory.length === 0) {
    territory = "worldwide";
  }

  // E) expiry 정합성
  if (input.expiry !== undefined && !isoDateRegex.test(input.expiry)) {
    confidence = "low";
  }

  return {
    provider: input.provider,
    sourceUrl: input.sourceUrl,
    licenseUrl: input.licenseUrl,
    licenseText: input.licenseText,

    allowedUses,
    allowedChannels: input.allowedChannels === "any"
      ? "any"
      : [...input.allowedChannels],
    territory,
    expiry: input.expiry,

    derivatives: {
      allowed: derivativesAllowed,
      allowedTransforms,
      prohibitedTransforms,
    },

    attribution: {
      required: input.attribution.required,
      textTemplate: input.attribution.textTemplate,
    },

    modelRelease: input.modelRelease,
    propertyRelease: input.propertyRelease,

    restrictions: { ...input.restrictions },

    confidence,
  };
}
