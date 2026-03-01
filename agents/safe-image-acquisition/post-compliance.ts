import type {
  ValidatedAsset,
  IntendedUse,
  PostChannel,
  PostComplianceResult,
} from "./types.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function aggregatePostCompliance(
  images: ValidatedAsset[],
  context: {
    postUseIntent: IntendedUse;
    channel: PostChannel;
  }
): PostComplianceResult {
  const requiredActions: string[] = [];
  const notes: string[] = [];
  let allowed = true;
  let attributionRequired = false;

  // A) Base overallRiskScore = average of image riskScores
  const sum = images.reduce((acc, img) => acc + img.risk.riskScore, 0);
  let overallRiskScore = images.length > 0 ? sum / images.length : 0;

  // B) Weighted rules

  // low-confidence penalty
  const hasLowConfidence = images.some(
    (img) => img.license.confidence === "low"
  );
  if (hasLowConfidence) {
    overallRiskScore += 20;
  }

  // editorialOnly + commercial intent → block
  for (const img of images) {
    if (
      img.license.restrictions.editorialOnly === true &&
      context.postUseIntent === "commercial"
    ) {
      allowed = false;
      notes.push(
        `Image ${img.assetId}: editorialOnly conflicts with commercial use`
      );
    }
  }

  // noCommercial + commercial intent → block
  for (const img of images) {
    if (
      img.license.restrictions.noCommercial === true &&
      context.postUseIntent === "commercial"
    ) {
      allowed = false;
      notes.push(
        `Image ${img.assetId}: noCommercial conflicts with commercial use`
      );
    }
  }

  // noDerivatives + non-hero role → force hero_unedited
  for (const img of images) {
    if (
      img.license.restrictions.noDerivatives === true &&
      img.role !== "hero_unedited"
    ) {
      requiredActions.push(
        `Force hero_unedited for image ${img.assetId}`
      );
    }
  }

  // attribution aggregation
  for (const img of images) {
    if (img.license.attribution.required) {
      attributionRequired = true;
    }
  }

  // Mixed source detection
  const providers = new Set(images.map((img) => img.provider));
  const hasAI = providers.has("ai-generation");
  const hasPR = providers.has("pressroom");
  if (hasAI && hasPR) {
    notes.push("Mixed source types detected");
  }

  // D) Provider-based risk adjustments
  if (hasPR) overallRiskScore += 10;
  if (hasAI) overallRiskScore += 5;

  overallRiskScore = clamp(Math.round(overallRiskScore), 0, 100);

  return {
    postUseIntent: context.postUseIntent,
    channel: context.channel,
    images,
    overallRiskScore,
    allowed,
    requiredActions,
    attributionRequired,
    notes,
  };
}
