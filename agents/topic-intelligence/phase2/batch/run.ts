import { normalizeTopic } from "../../utils/normalize.js";
import { makeTopicId } from "../../utils/topicId.js";
import { nowIso } from "../../utils/time.js";
import { saveJson } from "../../io/save.js";
import {
  getTopicRequestPath,
  getTopicIntelPath,
  getAgent2TopicPath,
} from "../../io/paths.js";
import { loadJson } from "../../io/load.js";
import { parseTopicRequest, parseTopicIntelPack } from "../../schema.js";
import { runPhase1D } from "../../phase1/run.js";
import { toAgent2Topic } from "../../bridge/to-agent2-topic.js";
import type { BatchPlanItem } from "./plan.js";
import type { BatchRunResultItem } from "./report.js";

// ============================================================================
// Types
// ============================================================================

export type BatchRunOptions = {
  concurrency?: number; // default 2
  dryRun?: boolean; // default false
};

// ============================================================================
// Concurrency limiter
// ============================================================================

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

// ============================================================================
// Single-item runner
// ============================================================================

async function runSingleItem(
  item: BatchPlanItem,
  dryRun: boolean,
): Promise<BatchRunResultItem> {
  // Gate metadata to attach to result
  const gateInfo = item.gate
    ? { decision: item.gate.decision, score: item.gate.score }
    : undefined;

  // Skipped items
  if (!item.willRun) {
    return {
      idx: item.idx,
      keyword: item.keyword,
      category: item.category,
      ok: false,
      skipped: true,
      skipReason: item.reason ?? "willRun=false",
      gate: item.gate
        ? { ...gateInfo, reason: item.reason }
        : undefined,
      finalScore: item.finalScore,
      gateDecision: item.gateDecision,
    };
  }

  // Dry-run: report what would happen, don't execute
  if (dryRun) {
    const createdAt = nowIso();
    const normalizedTopicStr = normalizeTopic(item.topicRequest.seedKeyword);
    const topicId = makeTopicId(
      normalizedTopicStr,
      item.topicRequest.seedKeyword,
      createdAt,
    );
    return {
      idx: item.idx,
      keyword: item.keyword,
      category: item.category,
      ok: true,
      skipped: false,
      topicId,
      summary: { sources: 0, keyFacts: 0, angles: 0 },
      gate: gateInfo,
      finalScore: item.finalScore,
      gateDecision: item.gateDecision,
    };
  }

  const start = Date.now();

  try {
    // Step A: Save TopicRequest
    const createdAt = nowIso();
    const normalizedTopicStr = normalizeTopic(item.topicRequest.seedKeyword);
    const topicId = makeTopicId(
      normalizedTopicStr,
      item.topicRequest.seedKeyword,
      createdAt,
    );

    const reqPath = getTopicRequestPath(topicId);
    const payload = { ...item.topicRequest, topicId, createdAt };
    await saveJson(reqPath, payload);

    // Step B: Run Phase 1-D (A→B→C→D)
    const resultD = await runPhase1D(topicId);

    // Step C: Bridge → Agent2
    let agent2TopicPath: string | undefined;
    try {
      const reqRaw = await loadJson<unknown>(reqPath);
      const request = parseTopicRequest(reqRaw);
      const intelPath = getTopicIntelPath(topicId);
      const rawIntel = await loadJson<unknown>(intelPath);
      const intel = parseTopicIntelPack(rawIntel);
      const agent2Topic = toAgent2Topic(intel, request);
      agent2TopicPath = getAgent2TopicPath(topicId);
      await saveJson(agent2TopicPath, agent2Topic);
    } catch {
      // Bridge failure is non-fatal (e.g. category=unknown).
      // Phase1-D result is still valid.
    }

    // Step D: Summary
    const durationMs = Date.now() - start;
    return {
      idx: item.idx,
      keyword: item.keyword,
      category: item.category,
      ok: true,
      skipped: false,
      topicId,
      paths: {
        topicRequestPath: reqPath,
        topicIntelPath: resultD.savedPaths.topicIntelPath,
        agent2TopicPath,
      },
      summary: {
        sources: resultD.topicIntel.sources.length,
        keyFacts: resultD.topicIntel.keyFacts.length,
        angles: resultD.topicIntel.angleCandidates.length,
      },
      durationMs,
      gate: gateInfo,
      finalScore: item.finalScore,
      gateDecision: item.gateDecision,
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      idx: item.idx,
      keyword: item.keyword,
      category: item.category,
      ok: false,
      skipped: false,
      error: msg,
      durationMs,
      gate: gateInfo,
      finalScore: item.finalScore,
      gateDecision: item.gateDecision,
    };
  }
}

// ============================================================================
// Main: batch runner
// ============================================================================

/**
 * Execute a batch plan with concurrency limiting and failure isolation.
 *
 * Each item runs independently — one failure does not block the others.
 */
export async function runPickedSeedsBatch(
  plan: BatchPlanItem[],
  opts?: BatchRunOptions,
): Promise<BatchRunResultItem[]> {
  const concurrency = opts?.concurrency ?? 2;
  const dryRun = opts?.dryRun ?? false;

  const tasks = plan.map((item) => () => runSingleItem(item, dryRun));

  return withConcurrency(tasks, concurrency);
}
