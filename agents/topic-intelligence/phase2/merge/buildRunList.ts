import { nowIso } from "../../utils/time.js";
import { getRunListPath } from "../../io/paths.js";
import { saveJson } from "../../io/save.js";
import type { MergeInputs } from "./loadInputs.js";
import {
  computeFinalScore,
  buildFinalScoreInput,
  type FinalScorePolicy,
  type FinalScoreResult,
} from "./finalScore.js";

// ============================================================================
// Types
// ============================================================================

export type RunListItem = {
  keyword: string;
  category: "music" | "lifestyle" | "unknown";
  trendScore: number | undefined;
  coverageScore: number | undefined;
  gateDecision: "pass" | "fail" | "missing";
  finalScore: number;
  reasons: string[];
  action: "run" | "skip";
  skipReason?: string;
};

export type RunListPolicy = {
  minFinalScore: number; // default 60
  requireGatePass: boolean; // default true
};

export type RunListFile = {
  geo: "KR";
  dateYyyymmdd: string;
  generatedAt: string;
  inputs: {
    snapshotPath: string;
    pickedPath: string;
    gateReportPath: string | undefined;
  };
  policy: RunListPolicy;
  scorePolicy: FinalScorePolicy;
  total: number;
  run: number;
  skip: number;
  items: RunListItem[];
};

// ============================================================================
// Main
// ============================================================================

/**
 * Build a ranked run list from merge inputs.
 *
 * For each picked seed:
 * 1. Look up trendScore from snapshot (by keyword match)
 * 2. Look up coverageScore + gateDecision from gate index
 * 3. Compute finalScore
 * 4. Decide action: "run" if finalScore >= minFinalScore AND
 *    (requireGatePass=false OR gateDecision="pass")
 * 5. Sort by finalScore desc
 */
export function buildRunList(
  inputs: MergeInputs,
  policy?: Partial<RunListPolicy>,
  scorePolicy?: FinalScorePolicy,
): RunListFile {
  const minFinalScore = policy?.minFinalScore ?? 60;
  const requireGatePass = policy?.requireGatePass ?? true;

  // Build a keyword → trendScore lookup from snapshot
  const trendScoreMap = new Map<string, number>();
  for (const c of inputs.snapshot.candidates) {
    trendScoreMap.set(c.keyword, c.score);
  }

  // Score each picked seed
  const scored: Array<FinalScoreResult & { seedCategory: "music" | "lifestyle" | "unknown" }> = [];

  for (const seed of inputs.picked.seeds) {
    const trendScore = trendScoreMap.get(seed.keyword) ?? seed.score;

    const input = buildFinalScoreInput({
      keyword: seed.keyword,
      category: seed.category,
      trendScore,
      gateIndex: inputs.gateIndex,
    });

    const result = computeFinalScore(input, scorePolicy);
    scored.push({ ...result, seedCategory: seed.category });
  }

  // Sort by finalScore desc
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // Build items with action decision
  const items: RunListItem[] = scored.map((s) => {
    let action: "run" | "skip" = "run";
    let skipReason: string | undefined;

    // Check minimum final score
    if (s.finalScore < minFinalScore) {
      action = "skip";
      skipReason = `finalScore=${String(s.finalScore)}<${String(minFinalScore)}`;
    }

    // Check gate pass requirement
    if (action === "run" && requireGatePass && s.gateDecision !== "pass") {
      action = "skip";
      skipReason = `gate=${s.gateDecision}; requireGatePass=true`;
    }

    // Unknown category → skip
    if (action === "run" && s.category === "unknown") {
      action = "skip";
      skipReason = "category=unknown";
    }

    return {
      keyword: s.keyword,
      category: s.category,
      trendScore: s.trendScore,
      coverageScore: s.coverageScore,
      gateDecision: s.gateDecision,
      finalScore: s.finalScore,
      reasons: s.reasons,
      action,
      skipReason,
    };
  });

  const runCount = items.filter((i) => i.action === "run").length;
  const skipCount = items.filter((i) => i.action === "skip").length;

  return {
    geo: inputs.picked.geo,
    dateYyyymmdd: inputs.picked.dateYyyymmdd,
    generatedAt: nowIso(),
    inputs: inputs.paths,
    policy: { minFinalScore, requireGatePass },
    scorePolicy: scorePolicy ?? {},
    total: items.length,
    run: runCount,
    skip: skipCount,
    items,
  };
}

// ============================================================================
// Save
// ============================================================================

/**
 * Save a run list file to disk.
 *
 * Returns the saved file path.
 */
export async function saveRunList(file: RunListFile): Promise<string> {
  const filePath = getRunListPath(file.dateYyyymmdd, file.geo);
  await saveJson(filePath, file);
  return filePath;
}
