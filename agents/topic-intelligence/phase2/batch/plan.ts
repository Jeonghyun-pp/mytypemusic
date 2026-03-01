import type { TopicRequest } from "../../contracts.js";
import { parseTopicRequest } from "../../schema.js";
import { DEFAULTS } from "../../interpret/defaults.js";
import type { PickedSeedsFile } from "../pick/savePicked.js";
import type { GateItem } from "../gate/loadGateReport.js";
import type { RunListFile } from "../merge/buildRunList.js";

// ============================================================================
// Types
// ============================================================================

export type GatePolicy = {
  enabled: boolean; // default false
  requireReport?: boolean; // default false
  minCoverageScore?: number; // default 0
};

export type BatchPlanItem = {
  idx: number;
  keyword: string;
  category: "music" | "lifestyle" | "unknown";
  willRun: boolean;
  reason?: string;
  topicRequest: TopicRequest;
  gate?: { decision: "pass" | "fail"; score: number };
  finalScore?: number;
  gateDecision?: "pass" | "fail" | "missing";
};

export type RunListInput = {
  type: "runlist";
  runList: RunListFile;
};

export type PickedInput = {
  type: "picked";
  picked: PickedSeedsFile;
};

// ============================================================================
// Main
// ============================================================================

/**
 * Build a batch execution plan from picked seeds.
 *
 * For each seed:
 * - Builds a TopicRequest (mode="auto")
 * - Marks willRun=false if category is "unknown" (bridge-agent2 requires it)
 * - Validates via parseTopicRequest; marks willRun=false on validation failure
 * - If gate is enabled, applies coverage gate filter
 */
export function buildBatchPlan(params: {
  picked: PickedSeedsFile;
  overrides?: Partial<TopicRequest>;
  gate?: {
    policy: GatePolicy;
    gateIndex?: Map<string, GateItem>;
  };
}): BatchPlanItem[] {
  const { picked, overrides } = params;
  const gatePolicy = params.gate?.policy;
  const gateIndex = params.gate?.gateIndex;
  const gateEnabled = gatePolicy?.enabled ?? false;
  const requireReport = gatePolicy?.requireReport ?? false;
  const minCoverageScore = gatePolicy?.minCoverageScore ?? 0;

  return picked.seeds.map((seed, idx) => {
    // Build base TopicRequest
    const category =
      seed.category === "music" || seed.category === "lifestyle"
        ? seed.category
        : undefined;

    const requestCandidate = {
      mode: "auto" as const,
      seedKeyword: seed.keyword,
      category,
      depth: overrides?.depth ?? DEFAULTS.depth,
      region: overrides?.region ?? DEFAULTS.region,
      maxArticles: overrides?.maxArticles ?? DEFAULTS.maxArticles,
      recencyDays: overrides?.recencyDays ?? DEFAULTS.recencyDays,
    };

    // Skip unknown category (bridge-agent2 requires music|lifestyle)
    if (seed.category === "unknown") {
      return {
        idx,
        keyword: seed.keyword,
        category: seed.category,
        willRun: false,
        reason: "category=unknown; bridge-agent2 requires music|lifestyle",
        topicRequest: requestCandidate as TopicRequest,
      };
    }

    // Validate via Zod
    let validated: TopicRequest;
    try {
      validated = parseTopicRequest(requestCandidate);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        idx,
        keyword: seed.keyword,
        category: seed.category,
        willRun: false,
        reason: `Validation failed: ${msg}`,
        topicRequest: requestCandidate as TopicRequest,
      };
    }

    // Gate filter (only if enabled)
    if (gateEnabled) {
      // No gate report loaded
      if (!gateIndex) {
        if (requireReport) {
          return {
            idx,
            keyword: seed.keyword,
            category: seed.category,
            willRun: false,
            reason: "gate_report_missing",
            topicRequest: validated,
          };
        }
        // requireReport=false → skip gate, proceed normally
      } else {
        // Lookup keyword in gate index
        const entry = gateIndex.get(seed.keyword);

        if (!entry) {
          return {
            idx,
            keyword: seed.keyword,
            category: seed.category,
            willRun: false,
            reason: "gate_no_entry",
            topicRequest: validated,
          };
        }

        if (entry.decision !== "pass") {
          return {
            idx,
            keyword: seed.keyword,
            category: seed.category,
            willRun: false,
            reason: `gate_fail:${entry.reason ?? "decision=fail"}`,
            topicRequest: validated,
            gate: { decision: entry.decision, score: entry.coverage.score },
          };
        }

        if (entry.coverage.score < minCoverageScore) {
          return {
            idx,
            keyword: seed.keyword,
            category: seed.category,
            willRun: false,
            reason: `gate_score_below_min:${String(entry.coverage.score)}<${String(minCoverageScore)}`,
            topicRequest: validated,
            gate: { decision: entry.decision, score: entry.coverage.score },
          };
        }

        // Gate passed — attach gate metadata and continue
        return {
          idx,
          keyword: seed.keyword,
          category: seed.category,
          willRun: true,
          topicRequest: validated,
          gate: { decision: entry.decision, score: entry.coverage.score },
        };
      }
    }

    // No gate or gate not enabled
    return {
      idx,
      keyword: seed.keyword,
      category: seed.category,
      willRun: true,
      topicRequest: validated,
    };
  });
}

// ============================================================================
// buildBatchPlanFromSource (RunList or Picked)
// ============================================================================

/**
 * Build a batch execution plan from either a RunListFile or a PickedSeedsFile.
 *
 * - RunListInput: uses runList.items, action="run" → willRun=true,
 *   action="skip" → willRun=false with reason="runlist_skip".
 *   Records finalScore and gateDecision per item.
 *
 * - PickedInput: delegates to existing buildBatchPlan (no gate).
 */
export function buildBatchPlanFromSource(
  source: RunListInput | PickedInput,
  overrides?: Partial<TopicRequest>,
): BatchPlanItem[] {
  if (source.type === "picked") {
    return buildBatchPlan({ picked: source.picked, overrides });
  }

  // RunList source
  const { runList } = source;

  return runList.items.map((item, idx) => {
    const category =
      item.category === "music" || item.category === "lifestyle"
        ? item.category
        : undefined;

    const requestCandidate = {
      mode: "auto" as const,
      seedKeyword: item.keyword,
      category,
      depth: overrides?.depth ?? DEFAULTS.depth,
      region: overrides?.region ?? DEFAULTS.region,
      maxArticles: overrides?.maxArticles ?? DEFAULTS.maxArticles,
      recencyDays: overrides?.recencyDays ?? DEFAULTS.recencyDays,
    };

    // Skip items
    if (item.action === "skip") {
      return {
        idx,
        keyword: item.keyword,
        category: item.category,
        willRun: false,
        reason: `runlist_skip:${item.skipReason ?? "action=skip"}`,
        topicRequest: requestCandidate as TopicRequest,
        finalScore: item.finalScore,
        gateDecision: item.gateDecision,
      };
    }

    // Unknown category → skip (bridge-agent2 requires music|lifestyle)
    if (item.category === "unknown") {
      return {
        idx,
        keyword: item.keyword,
        category: item.category,
        willRun: false,
        reason: "category=unknown; bridge-agent2 requires music|lifestyle",
        topicRequest: requestCandidate as TopicRequest,
        finalScore: item.finalScore,
        gateDecision: item.gateDecision,
      };
    }

    // Validate via Zod
    let validated: TopicRequest;
    try {
      validated = parseTopicRequest(requestCandidate);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        idx,
        keyword: item.keyword,
        category: item.category,
        willRun: false,
        reason: `Validation failed: ${msg}`,
        topicRequest: requestCandidate as TopicRequest,
        finalScore: item.finalScore,
        gateDecision: item.gateDecision,
      };
    }

    // Run item
    return {
      idx,
      keyword: item.keyword,
      category: item.category,
      willRun: true,
      topicRequest: validated,
      finalScore: item.finalScore,
      gateDecision: item.gateDecision,
    };
  });
}
