import type { ImageBrief, LicenseProfile } from "./types.js";
import {
  InsufficientProofError,
  LicenseConflictError,
  DerivativeNotAllowedError,
} from "./errors.js";

export type UsageValidationContext = {
  brief: ImageBrief;
  license: LicenseProfile;
  proofAvailable: boolean;
};

export function validateUsage(ctx: UsageValidationContext): void {
  const { brief, license, proofAvailable } = ctx;
  const baseMeta = { provider: license.provider };

  // Rule 1: proof 필수
  if (!proofAvailable) {
    throw new InsufficientProofError(
      "Proof is required but not available",
      { ...baseMeta, rule: "proof_required" }
    );
  }

  // Rule 2: intendedUse 검사
  if (
    brief.intendedUse === "commercial" &&
    !license.allowedUses.includes("commercial")
  ) {
    throw new LicenseConflictError(
      "Commercial use is not allowed by this license",
      { ...baseMeta, rule: "intended_use", intendedUse: brief.intendedUse }
    );
  }

  // Rule 3: editorialOnly 충돌
  if (
    license.restrictions.editorialOnly === true &&
    brief.intendedUse === "commercial"
  ) {
    throw new LicenseConflictError(
      "License is editorial-only but commercial use is requested",
      { ...baseMeta, rule: "editorial_only", intendedUse: brief.intendedUse }
    );
  }

  // Rule 4: derivatives (엄격)
  if (brief.requiresDerivative && license.derivatives.allowed !== true) {
    throw new DerivativeNotAllowedError(
      "Derivative use is required but not allowed by this license",
      { ...baseMeta, rule: "derivative_not_allowed" }
    );
  }

  // Rule 5: 채널 제한
  if (license.allowedChannels !== "any") {
    const channels: readonly string[] = license.allowedChannels;
    if (!channels.includes(brief.channel)) {
      throw new LicenseConflictError(
        `Channel "${brief.channel}" is not allowed by this license`,
        { ...baseMeta, rule: "channel_restriction", channel: brief.channel }
      );
    }
  }

  // Rule 6: territory 제한 (보수적)
  if (Array.isArray(license.territory)) {
    if (brief.targetTerritory) {
      if (!license.territory.includes(brief.targetTerritory)) {
        throw new LicenseConflictError(
          `Territory "${brief.targetTerritory}" is not covered by this license`,
          { ...baseMeta, rule: "territory_restriction", territory: brief.targetTerritory }
        );
      }
    } else {
      throw new LicenseConflictError(
        "License has territory restrictions but no target territory specified in brief",
        { ...baseMeta, rule: "territory_ambiguous" }
      );
    }
  }

  // Rule 7: expiry
  if (license.expiry) {
    const expiryDate = new Date(license.expiry);
    const now = new Date();
    if (expiryDate.getTime() < now.getTime()) {
      throw new LicenseConflictError(
        "License has expired",
        { ...baseMeta, rule: "license_expired", expiry: license.expiry }
      );
    }
  }

  // Rule 8: confidence
  if (license.confidence === "low") {
    throw new LicenseConflictError(
      "License confidence is too low for safe use",
      { ...baseMeta, rule: "low_confidence", confidence: license.confidence }
    );
  }
}
