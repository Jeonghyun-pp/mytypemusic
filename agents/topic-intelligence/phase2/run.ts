import { fetchTrendsSeeds, type TrendsTimeframe } from "./trends/client.js";
import { normalizeSeedKeyword } from "./trends/normalize.js";
import { categorizeSeed, scoreSeed, type SeedCandidate } from "./trends/score.js";
import { nowIso } from "../utils/time.js";
import { yyyymmdd } from "../utils/time.js";
import {
  getSeedsSnapshotPath,
  getPickedSeedsPath,
  getBatchRunReportPath,
} from "../io/paths.js";
import { saveJson } from "../io/save.js";
import { loadJson } from "../io/load.js";
import { loadSeedsSnapshot } from "./pick/loadSnapshot.js";
import { pickSeeds, type PickMode, type PickOptions } from "./pick/select.js";
import { savePickedSeedsFile, type PickedSeedsFile } from "./pick/savePicked.js";
import { buildBatchPlan, buildBatchPlanFromSource } from "./batch/plan.js";
import {
  runPickedSeedsBatch,
  type BatchRunOptions,
} from "./batch/run.js";
import type { BatchRunReport } from "./batch/report.js";
import type { TopicRequest } from "../contracts.js";
import {
  preflightSeedCoverage,
  type PreflightOptions,
} from "./gate/preflight.js";
import {
  saveCoverageGateReport,
  type CoverageGateReport,
} from "./gate/report.js";
import {
  loadCoverageGateReport,
  buildGateIndex,
  type GateItem,
} from "./gate/loadGateReport.js";
import { getCoverageGateReportPath, getRunListPath } from "../io/paths.js";
import type { GatePolicy } from "./batch/plan.js";
import type { BatchRunReportGate } from "./batch/report.js";
import { loadMergeInputs } from "./merge/loadInputs.js";
import {
  buildRunList,
  saveRunList,
  type RunListFile,
  type RunListPolicy,
} from "./merge/buildRunList.js";
import type { FinalScorePolicy } from "./merge/finalScore.js";

// ============================================================================
// Types
// ============================================================================

export type Phase2AResult = {
  generatedAt: string;
  timeframe: TrendsTimeframe;
  total: number;
  candidates: SeedCandidate[];
};

// ============================================================================
// Main
// ============================================================================

/**
 * Phase 2-A: Fetch Google Trends KR seeds, normalize, categorize, score.
 *
 * Returns scored candidates sorted by score desc, filtered by category,
 * limited to topN.
 */
export async function runPhase2A(params?: {
  timeframe?: TrendsTimeframe;
  topN?: number;
  category?: "music" | "lifestyle" | "all";
}): Promise<Phase2AResult> {
  const timeframe = params?.timeframe ?? "now 7-d";
  const topN = params?.topN ?? 30;
  const categoryFilter = params?.category ?? "all";

  // 1) Fetch raw seeds
  const rawSeeds = await fetchTrendsSeeds({ timeframe });

  // 2) Normalize keywords + dedupe
  const seen = new Set<string>();
  const normalized = [];
  for (const seed of rawSeeds) {
    const kw = normalizeSeedKeyword(seed.keyword);
    if (kw.length === 0) continue;
    if (seen.has(kw)) continue;
    seen.add(kw);
    normalized.push({ ...seed, keyword: kw });
  }

  // 3) Categorize + score
  const candidates: SeedCandidate[] = normalized.map((seed) => {
    const category = categorizeSeed(seed.keyword);
    return scoreSeed({
      keyword: seed.keyword,
      category,
      traffic: seed.traffic,
      source: seed.source,
    });
  });

  // 4) Sort by score desc
  candidates.sort((a, b) => b.score - a.score);

  // 5) Category filter
  const filtered =
    categoryFilter === "all"
      ? candidates
      : candidates.filter((c) => c.category === categoryFilter);

  // 6) TopN
  const result = filtered.slice(0, topN);

  return {
    generatedAt: nowIso(),
    timeframe,
    total: result.length,
    candidates: result,
  };
}

// ============================================================================
// Save wrapper
// ============================================================================

export type Phase2ASaveOptions = {
  save?: boolean; // default false
  geo?: "KR"; // default "KR"
};

/**
 * Run Phase 2-A and optionally save the result as a snapshot.
 *
 * When save=true, writes to outputs/seeds/<YYYYMMDD>/seeds.<geo>.json.
 */
export async function runPhase2AAndMaybeSave(
  params?: {
    timeframe?: TrendsTimeframe;
    topN?: number;
    category?: "music" | "lifestyle" | "all";
  },
  saveOpts?: Phase2ASaveOptions,
): Promise<Phase2AResult & { savedPath?: string }> {
  const result = await runPhase2A(params);

  if (!saveOpts?.save) {
    return result;
  }

  const geo = saveOpts.geo ?? "KR";
  const dateStr = yyyymmdd(new Date(result.generatedAt));
  const snapshotPath = getSeedsSnapshotPath(dateStr, geo);
  await saveJson(snapshotPath, result);

  return { ...result, savedPath: snapshotPath };
}

// ============================================================================
// Phase 2-B: Pick seeds from snapshot
// ============================================================================

/**
 * Phase 2-B: Load a seeds snapshot, pick/filter, save picked file.
 */
export async function runPhase2BPick(params: {
  dateYyyymmdd: string;
  geo?: "KR";
  pickMode: PickMode;
  options?: PickOptions;
}): Promise<{ savedPath: string; picked: SeedCandidate[] }> {
  const geo = params.geo ?? "KR";

  // 1) Load snapshot
  const snapshot = await loadSeedsSnapshot({
    dateYyyymmdd: params.dateYyyymmdd,
    geo,
  });

  // 2) Pick seeds
  const picked = pickSeeds(snapshot, params.pickMode, params.options);

  // 3) Build PickedSeedsFile
  const sourceSnapshotPath = getSeedsSnapshotPath(params.dateYyyymmdd, geo);
  const file = {
    pickedAt: nowIso(),
    dateYyyymmdd: params.dateYyyymmdd,
    geo,
    sourceSnapshotPath,
    pickMode: params.pickMode,
    options: params.options ?? {},
    count: picked.length,
    seeds: picked.map((c) => ({
      keyword: c.keyword,
      category: c.category,
      score: c.score,
      source: c.source,
      traffic: c.traffic,
    })),
  };

  // 4) Save
  const savedPath = await savePickedSeedsFile(file);

  return { savedPath, picked };
}

// ============================================================================
// Phase 2-B Run: Execute picked seeds batch
// ============================================================================

export type GateOptions = {
  enabled?: boolean; // default false
  requireReport?: boolean; // default false
  minCoverageScore?: number; // default 0
};

/**
 * Phase 2-B Run: Load picked seeds, build plan, execute batch, save report.
 *
 * When gate options are provided, loads the coverage-gate report and applies
 * it as a filter during plan building.
 *
 * When useRunList=true, loads runlist.<geo>.json instead of picked.<geo>.json
 * and uses buildBatchPlanFromSource with RunListInput. Only action="run"
 * items are executed; action="skip" items are skipped.
 */
export async function runPhase2BRun(params: {
  dateYyyymmdd: string;
  geo?: "KR";
  overrides?: Partial<TopicRequest>;
  batchOpts?: BatchRunOptions;
  gate?: GateOptions;
  useRunList?: boolean;
}): Promise<BatchRunReport> {
  const geo = params.geo ?? "KR";
  const overrides = params.overrides ?? {};
  const concurrency = params.batchOpts?.concurrency ?? 2;
  const dryRun = params.batchOpts?.dryRun ?? false;
  const useRunList = params.useRunList ?? false;

  const gateEnabled = params.gate?.enabled ?? false;
  const requireReport = params.gate?.requireReport ?? false;
  const minCoverageScore = params.gate?.minCoverageScore ?? 0;

  const startedAt = nowIso();

  // ---- RunList mode ----
  if (useRunList) {
    const runListPath = getRunListPath(params.dateYyyymmdd, geo);
    const runList = await loadJson<RunListFile>(runListPath);

    const pickedPath = getPickedSeedsPath(params.dateYyyymmdd, geo);

    const plan = buildBatchPlanFromSource(
      { type: "runlist", runList },
      overrides,
    );

    const items = await runPickedSeedsBatch(plan, { concurrency, dryRun });

    const finishedAt = nowIso();
    const totalMs =
      new Date(finishedAt).getTime() - new Date(startedAt).getTime();

    const willRun = plan.filter((p) => p.willRun).length;
    const ok = items.filter((i) => i.ok).length;
    const failed = items.filter((i) => !i.ok && !i.skipped).length;
    const skipped = items.filter((i) => i.skipped).length;

    const report: BatchRunReport = {
      geo,
      dateYyyymmdd: params.dateYyyymmdd,
      dryRun,
      concurrency,
      pickedPath,
      overrides,
      timing: { startedAt, finishedAt, totalMs },
      totals: { total: items.length, willRun, ok, failed, skipped },
      items,
      executionSource: "runlist",
      runListPath,
    };

    const reportPath = getBatchRunReportPath(params.dateYyyymmdd, geo);
    await saveJson(reportPath, report);

    return report;
  }

  // ---- Picked mode (existing logic) ----

  // 1) Load picked file
  const pickedPath = getPickedSeedsPath(params.dateYyyymmdd, geo);
  const picked = await loadJson<PickedSeedsFile>(pickedPath);

  // 2) Load gate report if enabled
  let gateIndex: Map<string, GateItem> | undefined;
  let gateReportPath: string | undefined;

  if (gateEnabled) {
    try {
      const gateReport = await loadCoverageGateReport({
        dateYyyymmdd: params.dateYyyymmdd,
        geo,
      });
      gateIndex = buildGateIndex(gateReport);
      gateReportPath = getCoverageGateReportPath(params.dateYyyymmdd, geo);
    } catch {
      if (requireReport) {
        throw new Error(
          "Coverage gate report not found. Run `preflight` first.",
        );
      }
      // requireReport=false → proceed without gate
    }
  }

  // 3) Build plan (with gate if available)
  const gatePolicy: GatePolicy = {
    enabled: gateEnabled,
    requireReport,
    minCoverageScore,
  };

  const plan = buildBatchPlan({
    picked,
    overrides,
    gate: gateEnabled ? { policy: gatePolicy, gateIndex } : undefined,
  });

  // 4) Execute batch
  const items = await runPickedSeedsBatch(plan, {
    concurrency,
    dryRun,
  });

  // 5) Compute totals
  const finishedAt = nowIso();
  const totalMs =
    new Date(finishedAt).getTime() - new Date(startedAt).getTime();

  const willRun = plan.filter((p) => p.willRun).length;
  const ok = items.filter((i) => i.ok).length;
  const failed = items.filter((i) => !i.ok && !i.skipped).length;
  const skipped = items.filter((i) => i.skipped).length;

  // 6) Compute gate stats for report
  let gateStats: BatchRunReportGate | undefined;
  if (gateEnabled) {
    const gatePassed = plan.filter(
      (p) => p.gate?.decision === "pass" && p.willRun,
    ).length;
    const gateFailed = plan.filter(
      (p) => p.reason?.startsWith("gate_fail") ||
             p.reason?.startsWith("gate_score_below_min"),
    ).length;
    const gateMissing = plan.filter(
      (p) => p.reason === "gate_no_entry" || p.reason === "gate_report_missing",
    ).length;

    gateStats = {
      enabled: true,
      requireReport,
      minCoverageScore,
      reportPath: gateReportPath,
      passed: gatePassed,
      failed: gateFailed,
      missing: gateMissing,
    };
  }

  // 7) Build report
  const report: BatchRunReport = {
    geo,
    dateYyyymmdd: params.dateYyyymmdd,
    dryRun,
    concurrency,
    pickedPath,
    overrides,
    timing: { startedAt, finishedAt, totalMs },
    totals: {
      total: items.length,
      willRun,
      ok,
      failed,
      skipped,
    },
    items,
    gate: gateStats,
    executionSource: "picked",
  };

  // 8) Save report
  const reportPath = getBatchRunReportPath(params.dateYyyymmdd, geo);
  await saveJson(reportPath, report);

  return report;
}

// ============================================================================
// Phase 2-C Preflight: RSS coverage gate
// ============================================================================

/** Simple concurrency limiter. */
async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const idx = next++;
      results[idx] = await tasks[idx]!();
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, tasks.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return results;
}

/**
 * Phase 2-C Preflight: Check RSS coverage for picked seeds.
 *
 * Loads picked seeds, runs preflight coverage check per keyword
 * (concurrency 2), sorts by coverage score, and saves the report.
 */
export async function runPhase2CPreflight(
  params: {
    dateYyyymmdd: string;
    geo?: "KR";
  },
  opts?: PreflightOptions,
): Promise<{ report: CoverageGateReport; savedPath: string }> {
  const geo = params.geo ?? "KR";

  // 1) Load picked file
  const pickedPath = getPickedSeedsPath(params.dateYyyymmdd, geo);
  const picked = await loadJson<PickedSeedsFile>(pickedPath);

  // 2) Run preflight for each seed (keyword-level concurrency = 2)
  const tasks = picked.seeds.map(
    (seed) => () =>
      preflightSeedCoverage(
        {
          keyword: seed.keyword,
          category:
            seed.category === "music" || seed.category === "lifestyle"
              ? seed.category
              : undefined,
          seedScore: seed.score,
        },
        opts,
      ),
  );

  const items = await withConcurrency(tasks, 2);

  // 3) Sort by coverage.score desc, then seedScore desc
  items.sort((a, b) => {
    if (b.coverage.score !== a.coverage.score) {
      return b.coverage.score - a.coverage.score;
    }
    return (b.seedScore ?? 0) - (a.seedScore ?? 0);
  });

  // 4) Build report
  const passCount = items.filter((i) => i.decision === "pass").length;
  const failCount = items.filter((i) => i.decision === "fail").length;

  const report: CoverageGateReport = {
    geo,
    dateYyyymmdd: params.dateYyyymmdd,
    generatedAt: nowIso(),
    sourcePickedPath: pickedPath,
    options: opts ?? {},
    total: items.length,
    pass: passCount,
    fail: failCount,
    items,
  };

  // 5) Save report
  const savedPath = await saveCoverageGateReport(report);

  return { report, savedPath };
}

// ============================================================================
// Phase 2-C Build Run List: FinalSeedScore + Ranked Run List
// ============================================================================

/**
 * Phase 2-C Build Run List: Load inputs, compute final scores, build ranked
 * run list, and optionally save.
 *
 * Loads the seeds snapshot, picked seeds, and coverage gate report
 * (optional), then computes a weighted final score for each picked seed
 * combining trend score (0.45) and coverage score (0.55) with gate
 * penalties/bonuses.
 */
export async function runPhase2CBuildRunList(params: {
  dateYyyymmdd: string;
  geo?: "KR";
  policy?: Partial<RunListPolicy>;
  scorePolicy?: FinalScorePolicy;
  save?: boolean;
}): Promise<{ runList: RunListFile; savedPath?: string }> {
  const geo = params.geo ?? "KR";

  // 1) Load all inputs
  const inputs = await loadMergeInputs({
    dateYyyymmdd: params.dateYyyymmdd,
    geo,
  });

  // 2) Build run list
  const runList = buildRunList(inputs, params.policy, params.scorePolicy);

  // 3) Optionally save
  let savedPath: string | undefined;
  if (params.save !== false) {
    savedPath = await saveRunList(runList);
  }

  return { runList, savedPath };
}
