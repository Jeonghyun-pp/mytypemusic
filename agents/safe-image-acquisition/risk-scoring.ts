import type { IntendedUse, LicenseProfile, RiskFlags } from "./types.js";

export type RiskContext = {
  intendedUse: IntendedUse;
  license: LicenseProfile;
  flags: RiskFlags;
  category: "music" | "fashion" | "celebrity" | "issue";
  proofAvailable: boolean;
};

export type RiskResult = {
  score: number;
  shouldFail: boolean;
  reasons: string[];
};

export function calculateRisk(ctx: RiskContext): RiskResult {
  let score = 0;
  const reasons: string[] = [];
  const { intendedUse, license, flags, category, proofAvailable } = ctx;

  // A) 라이선스/증빙 리스크
  if (!proofAvailable) {
    score += 50;
    reasons.push("proof_unavailable");
  }
  if (license.confidence === "low") {
    score += 40;
    reasons.push("low_confidence");
  }
  if (license.allowedUses.length === 0) {
    score += 80;
    reasons.push("no_allowed_uses");
  }

  // B) intendedUse 충돌 (방어적 가중치)
  if (
    intendedUse === "commercial" &&
    !license.allowedUses.includes("commercial")
  ) {
    score += 80;
    reasons.push("commercial_not_allowed");
  }

  // C) derivatives 리스크
  if (license.derivatives.allowed !== true) {
    score += 20;
    reasons.push("derivatives_not_allowed");
  }

  // D) flags 기반
  if (flags.containsLogo) {
    score += 25;
    reasons.push("contains_logo");
  }
  if (flags.hasWatermark) {
    score += 35;
    reasons.push("has_watermark");
  }
  if (flags.containsPerson) {
    if (intendedUse === "commercial") {
      score += 35;
      reasons.push("contains_person_commercial");
    } else {
      score += 15;
      reasons.push("contains_person_editorial");
    }
  }
  if (flags.celebrityLikelihood) {
    if (intendedUse === "commercial") {
      score += 50;
      reasons.push("celebrity_likelihood_commercial");
    } else {
      score += 25;
      reasons.push("celebrity_likelihood_editorial");
    }
  }

  // E) 카테고리 baseline
  switch (category) {
    case "celebrity":
      score += 20;
      reasons.push("category_celebrity");
      break;
    case "fashion":
      score += 15;
      reasons.push("category_fashion");
      break;
    case "music":
      score += 10;
      reasons.push("category_music");
      break;
    case "issue":
      score += 5;
      reasons.push("category_issue");
      break;
  }

  return {
    score,
    shouldFail: score >= 60,
    reasons,
  };
}
