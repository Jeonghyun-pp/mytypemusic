import type { GateItem } from "../gate/loadGateReport.js";

// ============================================================================
// Types
// ============================================================================

export type FinalScoreInput = {
  keyword: string;
  category: "music" | "lifestyle" | "unknown";
  trendScore: number | undefined; // from SeedCandidate.score (0~100)
  coverageScore: number | undefined; // from GateItem.coverage.score (0~100)
  gateDecision: "pass" | "fail" | "missing";
};

export type FinalScoreResult = {
  keyword: string;
  category: "music" | "lifestyle" | "unknown";
  trendScore: number | undefined;
  coverageScore: number | undefined;
  gateDecision: "pass" | "fail" | "missing";
  finalScore: number; // 0~100 int
  reasons: string[];
};

// ============================================================================
// Policy defaults
// ============================================================================

export type FinalScorePolicy = {
  trendWeight?: number; // default 0.45
  coverageWeight?: number; // default 0.55
  gateFailMultiplier?: number; // default 0.30
  gateMissingMultiplier?: number; // default 0.85
  lowCoveragePenalty?: number; // default 15 (applied when cov < 30)
  lowCoverageThreshold?: number; // default 30
  lowTrendPenalty?: number; // default 10 (applied when trend < 30)
  lowTrendThreshold?: number; // default 30
  strongBothBonus?: number; // default 10
  strongCoverageThreshold?: number; // default 70
  strongTrendThreshold?: number; // default 60
};

const DEFAULT_POLICY: Required<FinalScorePolicy> = {
  trendWeight: 0.45,
  coverageWeight: 0.55,
  gateFailMultiplier: 0.30,
  gateMissingMultiplier: 0.85,
  lowCoveragePenalty: 15,
  lowCoverageThreshold: 30,
  lowTrendPenalty: 10,
  lowTrendThreshold: 30,
  strongBothBonus: 10,
  strongCoverageThreshold: 70,
  strongTrendThreshold: 60,
};

// ============================================================================
// Main
// ============================================================================

/**
 * Compute the final seed score combining trend score and coverage score.
 *
 * Formula:
 *   raw = trendWeight * trend + coverageWeight * cov
 *
 * Penalties:
 *   - gate_fail:  raw *= gateFailMultiplier (0.30)
 *   - gate_missing: raw *= gateMissingMultiplier (0.85)
 *   - low_coverage (cov < 30): raw -= lowCoveragePenalty (15)
 *   - low_trend (trend < 30): raw -= lowTrendPenalty (10)
 *
 * Bonus:
 *   - strong_both (cov >= 70 && trend >= 60): raw += strongBothBonus (10)
 *
 * Clamp 0..100, round to int.
 */
export function computeFinalScore(
  input: FinalScoreInput,
  policy?: FinalScorePolicy,
): FinalScoreResult {
  const p = { ...DEFAULT_POLICY, ...policy };
  const reasons: string[] = [];

  const trend = input.trendScore ?? 0;
  const cov = input.coverageScore ?? 0;

  // Base weighted average
  let raw = p.trendWeight * trend + p.coverageWeight * cov;
  reasons.push(
    `base:${p.trendWeight}*${String(trend)}+${p.coverageWeight}*${String(cov)}=${String(Math.round(raw))}`,
  );

  // Gate penalties
  if (input.gateDecision === "fail") {
    raw *= p.gateFailMultiplier;
    reasons.push(`gate_fail:*${String(p.gateFailMultiplier)}`);
  } else if (input.gateDecision === "missing") {
    raw *= p.gateMissingMultiplier;
    reasons.push(`gate_missing:*${String(p.gateMissingMultiplier)}`);
  }

  // Low coverage penalty
  if (cov < p.lowCoverageThreshold) {
    raw -= p.lowCoveragePenalty;
    reasons.push(`low_cov:-${String(p.lowCoveragePenalty)}`);
  }

  // Low trend penalty
  if (trend < p.lowTrendThreshold) {
    raw -= p.lowTrendPenalty;
    reasons.push(`low_trend:-${String(p.lowTrendPenalty)}`);
  }

  // Strong both bonus
  if (cov >= p.strongCoverageThreshold && trend >= p.strongTrendThreshold) {
    raw += p.strongBothBonus;
    reasons.push(`strong_both:+${String(p.strongBothBonus)}`);
  }

  // Clamp and round
  const finalScore = Math.round(Math.max(0, Math.min(100, raw)));

  return {
    keyword: input.keyword,
    category: input.category,
    trendScore: input.trendScore,
    coverageScore: input.coverageScore,
    gateDecision: input.gateDecision,
    finalScore,
    reasons,
  };
}

// ============================================================================
// Helper: Build FinalScoreInput from merge data
// ============================================================================

/**
 * Build a FinalScoreInput for a picked seed using the snapshot trend scores
 * and gate index.
 */
export function buildFinalScoreInput(params: {
  keyword: string;
  category: "music" | "lifestyle" | "unknown";
  trendScore: number | undefined;
  gateIndex: Map<string, GateItem> | undefined;
}): FinalScoreInput {
  const gateEntry = params.gateIndex?.get(params.keyword);

  let gateDecision: "pass" | "fail" | "missing";
  let coverageScore: number | undefined;

  if (!gateEntry) {
    gateDecision = "missing";
    coverageScore = undefined;
  } else {
    gateDecision = gateEntry.decision;
    coverageScore = gateEntry.coverage.score;
  }

  return {
    keyword: params.keyword,
    category: params.category,
    trendScore: params.trendScore,
    coverageScore,
    gateDecision,
  };
}
