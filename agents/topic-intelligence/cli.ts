import { buildTopicRequestFromPrompt } from "./interpret/interpret.js";
import { normalizeTopic } from "./utils/normalize.js";
import { makeTopicId } from "./utils/topicId.js";
import { nowIso } from "./utils/time.js";
import {
  getTopicRequestPath,
  getTopicIntelPath,
  getAgent2TopicPath,
  getBatchRunReportPath,
} from "./io/paths.js";
import { loadJson } from "./io/load.js";
import { saveJson } from "./io/save.js";
import { parseTopicRequest, parseTopicIntelPack } from "./schema.js";
import { runPhase1A, runPhase1B, runPhase1C, runPhase1D, runPhase1E, type Phase1Options } from "./phase1/run.js";
import { loadExternalArticles } from "./phase1/feeds/external.js";
import { fetchUrlAsArticle } from "./phase1/feeds/url-fetch.js";
import { toAgent2Topic } from "./bridge/to-agent2-topic.js";
import { runPhase2AAndMaybeSave, runPhase2BPick, runPhase2BRun, runPhase2CPreflight, runPhase2CBuildRunList } from "./phase2/run.js";
import type { PreflightOptions } from "./phase2/gate/preflight.js";
import type { TrendsTimeframe } from "./phase2/trends/client.js";
import type { PickMode, PickOptions } from "./phase2/pick/select.js";
import type { TopicRequest } from "./contracts.js";
import { parseIntent } from "./spotify/intent.js";
import { fetchSpotifyData } from "./spotify/fetcher.js";
import { enrichTopicWithSpotify } from "./spotify/enrich.js";
import { extractKeywordsFromSpotifyData, buildFlatKeywords, type SpotifyPrefetchResult } from "./spotify/keywords.js";

// ============================================================================
// Argv parsing (no external deps)
// ============================================================================

function parseArgs(argv: string[]): {
  command: string;
  flags: Map<string, string>;
} {
  const args = argv.slice(2);
  const command = args[0] ?? "";

  const flags = new Map<string, string>();
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg !== undefined && arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(key, next);
        i++;
      }
    }
  }

  return { command, flags };
}

// ============================================================================
// request command
// ============================================================================

async function handleRequest(flags: Map<string, string>): Promise<void> {
  const prompt = flags.get("prompt");
  const keyword = flags.get("keyword");

  if (!prompt && !keyword) {
    throw new Error(
      "Either --prompt or --keyword is required.\n" +
        'Usage: cli.js request --prompt "이번주 아이브 컴백 소식 정리해줘"\n' +
        '       cli.js request --keyword "콜드플레이 내한"\n' +
        '       cli.js request --keyword "콜드플레이 내한" --category music',
    );
  }

  // Build TopicRequest (with optional --category override)
  const categoryFlag = flags.get("category");
  const overrides: Record<string, unknown> = {};
  if (categoryFlag === "music" || categoryFlag === "lifestyle") {
    overrides.category = categoryFlag;
  }
  const request = buildTopicRequestFromPrompt(prompt ?? keyword!, overrides);

  // Parse optional aligned keywords from Spotify prefetch
  const keywordsFlag = flags.get("keywords");
  const alignedKeywords = keywordsFlag
    ? keywordsFlag.split(",").map((k) => k.trim()).filter(Boolean)
    : undefined;

  // Generate ID
  const createdAt = nowIso();
  const normalizedTopic = normalizeTopic(request.seedKeyword);
  const topicId = makeTopicId(normalizedTopic, request.seedKeyword, createdAt);

  // Save
  const savePath = getTopicRequestPath(topicId);
  const payload = {
    ...request,
    topicId,
    createdAt,
    ...(alignedKeywords ? { alignedKeywords } : {}),
  };
  await saveJson(savePath, payload);

  // Console output
  console.log("--- Topic Request Created ---");
  console.log(`Topic ID    : ${topicId}`);
  console.log(`Seed        : ${request.seedKeyword}`);
  console.log(`Category    : ${request.category ?? "(inferred later)"}`);
  console.log(`Depth       : ${request.depth ?? "explainer"}`);
  if (request.searchEntities && request.searchEntities.length > 0) {
    console.log(`Entities    : ${request.searchEntities.join(", ")}`);
  }
  console.log(`Saved to    : ${savePath}`);
}

// ============================================================================
// intel command (Phase 1-A / 1-B)
// ============================================================================

async function handleIntel(flags: Map<string, string>): Promise<void> {
  const topicId = flags.get("topicId");
  const phase = flags.get("phase");

  if (!topicId) {
    throw new Error(
      "Missing --topicId.\n" +
        'Usage: cli.js intel --topicId "<id>" --phase A|B',
    );
  }

  if (phase !== "A" && phase !== "B" && phase !== "C" && phase !== "D" && phase !== "E") {
    throw new Error(
      `Unsupported phase "${phase ?? "(none)"}". Available: A, B, C, D, E`,
    );
  }

  // Load external signal articles if --signals flag is provided
  const signalsPath = flags.get("signals");
  const phase1Opts: Phase1Options = {};
  if (signalsPath) {
    console.log(`Loading external signals from: ${signalsPath}`);
    phase1Opts.externalArticles = await loadExternalArticles(signalsPath);
    console.log(`  Loaded ${String(phase1Opts.externalArticles.length)} external articles\n`);
  }

  // Spotify prefetch path if provided
  const spotifyPrefetchPath = flags.get("spotifyPrefetch");
  if (spotifyPrefetchPath) {
    phase1Opts.spotifyPrefetchPath = spotifyPrefetchPath;
    console.log(`Spotify prefetch: ${spotifyPrefetchPath}`);
  }

  // ---- Phase A ----
  if (phase === "A") {
    console.log("--- Phase 1-A: RSS Fetch & Filter ---");
    console.log(`Topic ID : ${topicId}\n`);

    const result = await runPhase1A(topicId, phase1Opts);

    console.log(`Feeds OK     : ${String(result.feedsOk)}/${String(result.feedsTotal)} succeeded, ${String(result.errors.length)} failed`);
    console.log(`Total raw    : ${String(result.totalRaw)} items`);
    console.log(`After filter : ${String(result.totalAfterRecency)} items (recency + dedupe)`);

    if (result.errors.length > 0) {
      console.log("\nFailed feeds:");
      for (const e of result.errors) {
        console.log(`  [${e.feedId}] ${e.message}`);
      }
    }

    if (result.articles.length > 0) {
      console.log("\nTop articles (up to 5):");
      for (const a of result.articles.slice(0, 5)) {
        console.log(`  - ${a.title}`);
        console.log(`    ${a.url}`);
      }
    } else {
      console.log("\nNo articles found after filtering.");
    }

    console.log("\n--- Phase 1-A Complete ---");
    return;
  }

  // ---- Phase B ----
  if (phase === "B") {
    console.log("--- Phase 1-B: Relevance Scoring + TopK ---");
    console.log(`Topic ID : ${topicId}\n`);

    const result = await runPhase1B(topicId, phase1Opts);

    // A-stage summary
    console.log(`[A] Feeds    : ${String(result.feedsOk)}/${String(result.feedsTotal)} OK`);
    console.log(`[A] Raw      : ${String(result.totalRaw)} → ${String(result.totalAfterRecency)} after recency+dedupe`);
    if (result.errors.length > 0) {
      console.log(`[A] Errors   : ${String(result.errors.length)} feeds failed`);
    }

    // B-stage summary
    console.log(`\n[B] Selected : ${String(result.selected.length)} articles\n`);

    if (result.selected.length > 0) {
      const display = result.selected.slice(0, 10);
      for (let i = 0; i < display.length; i++) {
        const a = display[i]!;
        console.log(`  ${String(i + 1).padStart(2)}. [score ${String(a.score).padStart(2)}] ${a.title}`);
        console.log(`      ${a.url}`);
        if (a.signals.length > 0) {
          console.log(`      signals: ${a.signals.join(", ")}`);
        }
      }
    } else {
      console.log("  No articles passed scoring threshold.");
    }

    console.log("\n--- Phase 1-B Complete ---");
    return;
  }

  // ---- Phase C ----
  if (phase === "C") {
    console.log("--- Phase 1-C: Content Fields (keyFacts / angles / images / risk) ---");
    console.log(`Topic ID : ${topicId}\n`);

    const resultC = await runPhase1C(topicId, phase1Opts);

    // A/B stage summary
    console.log(`[A] Feeds    : ${String(resultC.feedsOk)}/${String(resultC.feedsTotal)} OK`);
    console.log(`[A] Raw      : ${String(resultC.totalRaw)} → ${String(resultC.totalAfterRecency)} after recency+dedupe`);
    console.log(`[B] Selected : ${String(resultC.selected.length)} articles`);
    console.log(`    Missing publishedAt: ${String(resultC.generated.missingPublishedAtCount)}`)
    console.log(`    Facts used: ${resultC.generated.factsUsed}`);

    // Coverage summary
    const g = resultC.generated;
    const m = g.momentum;
    console.log(`\n[C] Coverage Clusters (${String(g.clusters.length)}):`);
    for (const cl of g.clusters) {
      console.log(`  ${cl.clusterId}: "${cl.label}" (${String(cl.sources.length)} sources)`);
    }
    console.log(`\n[C] Momentum: score=${String(m.score)}/100, sources=${String(m.totalSources)}, publishers=${String(m.uniquePublishers)}, 24h=${String(m.sourcesLast24h)}, 72h=${String(m.sourcesLast72h)}`);

    // Key Facts
    console.log(`\n[C] Key Facts (${String(g.keyFacts.length)}):`);
    for (let i = 0; i < g.keyFacts.length; i++) {
      const f = g.keyFacts[i]!;
      console.log(`  ${String(i + 1).padStart(2)}. ${f.text}`);
      console.log(`      evidence: ${String(f.evidenceUrls.length)} url(s)`);
    }

    // Angles
    console.log(`\n[C] Angle Candidates (${String(g.angleCandidates.length)}):`);
    for (let i = 0; i < g.angleCandidates.length; i++) {
      console.log(`  ${String(i + 1).padStart(2)}. ${g.angleCandidates[i]!}`);
    }

    // Image Queries
    console.log(`\n[C] Image Queries (${String(g.imageQueries.length)}):`);
    for (let i = 0; i < g.imageQueries.length; i++) {
      console.log(`  ${String(i + 1).padStart(2)}. ${g.imageQueries[i]!}`);
    }

    // Risk Notes
    console.log(`\n[C] Risk Notes (${String(g.riskNotes.length)}):`);
    if (g.riskNotes.length === 0) {
      console.log("  (none)");
    } else {
      for (const note of g.riskNotes) {
        console.log(`  - ${note}`);
      }
    }

    console.log("\n--- Phase 1-C Complete ---");
    return;
  }

  // ---- Phase D ----
  if (phase === "D") {
    const writeRaw = flags.get("writeRaw") === "true";

    console.log("--- Phase 1-D: Assemble + Validate + Save TopicIntelPack ---");
    console.log(`Topic ID  : ${topicId}`);
    console.log(`Write raw : ${String(writeRaw)}\n`);

    const resultD = await runPhase1D(topicId, { ...phase1Opts, writeRaw });

    const ti = resultD.topicIntel;
    console.log(`Saved     : ${resultD.savedPaths.topicIntelPath}`);
    if (resultD.savedPaths.sourcesRawPath) {
      console.log(`Saved     : ${resultD.savedPaths.sourcesRawPath}`);
    }

    console.log(`\nTopic Intel Summary:`);
    console.log(`  normalizedTopic : ${ti.normalizedTopic}`);
    console.log(`  category        : ${ti.category}`);
    console.log(`  sources         : ${String(ti.sources.length)}`);
    console.log(`  keyFacts        : ${String(ti.keyFacts.length)}`);
    console.log(`  angleCandidates : ${String(ti.angleCandidates.length)}`);
    console.log(`  imageQueries    : ${String(ti.imageQueries.length)}`);
    console.log(`  riskNotes       : ${String(ti.riskNotes.length)}`)
    console.log(`  factsUsed       : ${resultD.generated.factsUsed}`);

    console.log("\n--- Phase 1-D Complete ---");
    return;
  }

  // ---- Phase E ----
  console.log("--- Phase 1-E: Article Body Fetch + Text Cache ---");
  console.log(`Topic ID : ${topicId}\n`);

  const resultE = await runPhase1E(topicId, phase1Opts);

  const okCount = resultE.articleCaches.filter((c) => c.ok).length;
  const errCount = resultE.articleCaches.filter((c) => c.status === "error").length;

  console.log(`Index     : ${resultE.articleIndexPath}`);
  console.log(`Articles  : ${String(resultE.articleCaches.length)} total, ${String(okCount)} ok, ${String(errCount)} errors\n`);

  const display = resultE.articleCaches.slice(0, 10);
  for (const c of display) {
    const method = c.extractor?.method ?? "-";
    const textLen = c.extractor?.textLength ?? 0;
    const status = c.ok ? "OK" : c.status === "error" ? "ERR" : "LOW";
    console.log(`  [${String(c.idx).padStart(2)}] ${status.padEnd(3)} | ${method.padEnd(13)} | ${String(textLen).padStart(6)} chars | ${c.url}`);
  }
  if (resultE.articleCaches.length > 10) {
    console.log(`  ... and ${String(resultE.articleCaches.length - 10)} more`);
  }

  console.log("\n--- Phase 1-E Complete ---");
}

// ============================================================================
// bridge-agent2 command
// ============================================================================

async function handleBridgeAgent2(flags: Map<string, string>): Promise<void> {
  const topicId = flags.get("topicId");

  if (!topicId) {
    throw new Error(
      "Missing --topicId.\n" +
        'Usage: cli.js bridge-agent2 --topicId "<id>"',
    );
  }

  console.log("--- Bridge: TopicIntelPack → Agent2 Topic ---");
  console.log(`Topic ID : ${topicId}\n`);

  // 1) Load + validate topic-request.json
  const reqPath = getTopicRequestPath(topicId);
  const rawReq = await loadJson<unknown>(reqPath);
  const request = parseTopicRequest(rawReq);

  // 2) Load + validate topic-intel.json
  const intelPath = getTopicIntelPath(topicId);
  const rawIntel = await loadJson<unknown>(intelPath);
  const intel = parseTopicIntelPack(rawIntel);

  // 3) Convert
  const agent2Topic = toAgent2Topic(intel, request);

  // 4) Save
  const savePath = getAgent2TopicPath(topicId);
  await saveJson(savePath, agent2Topic);

  // 5) Output
  console.log(`Saved     : ${savePath}`);
  console.log(`\nAgent2 Topic Summary:`);
  console.log(`  title    : ${agent2Topic.title}`);
  console.log(`  category : ${agent2Topic.category}`);
  console.log(`  facts    : ${String(agent2Topic.facts.length)}`);
  console.log(`  angles   : ${String(agent2Topic.angles.length)}`);
  console.log(`  sources  : ${String(agent2Topic.sources.length)}`);

  console.log("\n--- Bridge Complete ---");
}

// ============================================================================
// seeds command (Phase 2-A)
// ============================================================================

const VALID_TIMEFRAMES = new Set<TrendsTimeframe>([
  "now 1-d",
  "now 7-d",
  "today 1-m",
  "today 3-m",
]);

async function handleSeeds(flags: Map<string, string>): Promise<void> {
  const timeframeFlag = flags.get("timeframe") ?? "now 7-d";
  const topNFlag = flags.get("topN");
  const categoryFlag = flags.get("category") ?? "all";
  const saveFlag = flags.get("save") === "true";

  // Validate timeframe
  if (!VALID_TIMEFRAMES.has(timeframeFlag as TrendsTimeframe)) {
    throw new Error(
      `Invalid timeframe "${timeframeFlag}". ` +
        `Available: ${[...VALID_TIMEFRAMES].join(", ")}`,
    );
  }
  const timeframe = timeframeFlag as TrendsTimeframe;

  // Validate topN
  const topN = topNFlag ? parseInt(topNFlag, 10) : 30;
  if (isNaN(topN) || topN < 1) {
    throw new Error("--topN must be a positive integer.");
  }

  // Validate category
  if (
    categoryFlag !== "all" &&
    categoryFlag !== "music" &&
    categoryFlag !== "lifestyle"
  ) {
    throw new Error(
      `Invalid category "${categoryFlag}". Available: all, music, lifestyle`,
    );
  }
  const category = categoryFlag as "music" | "lifestyle" | "all";

  console.log("--- Phase 2-A: Google Trends KR Seed Candidates ---");
  console.log(`Timeframe : ${timeframe}`);
  console.log(`Top N     : ${String(topN)}`);
  console.log(`Category  : ${category}`);
  console.log(`Save      : ${String(saveFlag)}\n`);

  const result = await runPhase2AAndMaybeSave(
    { timeframe, topN, category },
    { save: saveFlag },
  );

  console.log(`Generated : ${result.generatedAt}`);
  console.log(`Total     : ${String(result.total)} candidates\n`);

  if (result.candidates.length === 0) {
    console.log("  No candidates found.");
  } else {
    for (let i = 0; i < result.candidates.length; i++) {
      const c = result.candidates[i]!;
      const trafficStr = c.traffic != null ? String(c.traffic) : "-";
      console.log(
        `  ${String(i + 1).padStart(3)}. [${String(c.score).padStart(3)}] ${c.category.padEnd(9)} | ${c.keyword}`,
      );
      console.log(
        `       source: ${c.source} | traffic: ${trafficStr} | ${c.reasons.join(", ")}`,
      );
    }
  }

  if (result.savedPath) {
    console.log(`\nSaved: ${result.savedPath}`);
  }

  console.log("\n--- Phase 2-A Complete ---");
}

// ============================================================================
// pick-seeds command (Phase 2-B)
// ============================================================================

function parsePickMode(flags: Map<string, string>): PickMode {
  const pickFlag = flags.get("pick");
  const autoPickFlag = flags.get("autoPick");
  const filterFlag = flags.get("filter");

  // Ensure exactly one mode
  const modeCount =
    (pickFlag != null ? 1 : 0) +
    (autoPickFlag != null ? 1 : 0) +
    (filterFlag != null ? 1 : 0);

  if (modeCount === 0) {
    throw new Error(
      "One pick mode is required: --pick, --autoPick, or --filter.",
    );
  }
  if (modeCount > 1) {
    throw new Error(
      "Only one pick mode allowed: --pick, --autoPick, or --filter.",
    );
  }

  if (pickFlag != null) {
    const indexes = pickFlag
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    return { mode: "pick", indexes };
  }

  if (autoPickFlag != null) {
    const topN = parseInt(autoPickFlag, 10);
    if (isNaN(topN) || topN < 1) {
      throw new Error("--autoPick must be a positive integer.");
    }
    return { mode: "autoPick", topN };
  }

  // filter mode
  const topNFlag = flags.get("topN");
  const topN = topNFlag ? parseInt(topNFlag, 10) : undefined;
  return { mode: "filter", regex: filterFlag!, topN };
}

async function handlePickSeeds(flags: Map<string, string>): Promise<void> {
  const dateFlag = flags.get("date");
  if (!dateFlag) {
    throw new Error(
      "Missing --date.\n" +
        'Usage: cli.js pick-seeds --date 20260215 --autoPick 5',
    );
  }

  const categoryFlag = flags.get("category") ?? "all";
  if (
    categoryFlag !== "all" &&
    categoryFlag !== "music" &&
    categoryFlag !== "lifestyle"
  ) {
    throw new Error(
      `Invalid category "${categoryFlag}". Available: all, music, lifestyle`,
    );
  }

  const minScoreFlag = flags.get("minScore");
  const minScore = minScoreFlag ? parseInt(minScoreFlag, 10) : 40;

  const pickMode = parsePickMode(flags);
  const options: PickOptions = {
    category: categoryFlag as "music" | "lifestyle" | "all",
    minScore,
  };

  console.log("--- Phase 2-B: Pick Seeds from Snapshot ---");
  console.log(`Date      : ${dateFlag}`);
  console.log(`Pick mode : ${pickMode.mode}`);
  console.log(`Category  : ${categoryFlag}`);
  console.log(`Min score : ${String(minScore)}\n`);

  let result;
  try {
    result = await runPhase2BPick({
      dateYyyymmdd: dateFlag,
      pickMode,
      options,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("File not found")) {
      console.error(
        "Snapshot not found. Run `seeds --save true` first.",
      );
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  console.log(`Picked    : ${String(result.picked.length)} seeds`);
  console.log(`Saved     : ${result.savedPath}\n`);

  const display = result.picked.slice(0, 20);
  for (let i = 0; i < display.length; i++) {
    const c = display[i]!;
    const trafficStr = c.traffic != null ? String(c.traffic) : "-";
    console.log(
      `  ${String(i + 1).padStart(3)}. [${String(c.score).padStart(3)}] ${c.category.padEnd(9)} | ${c.keyword}`,
    );
    console.log(
      `       source: ${c.source} | traffic: ${trafficStr}`,
    );
  }
  if (result.picked.length > 20) {
    console.log(`  ... and ${String(result.picked.length - 20)} more`);
  }

  console.log("\n--- Phase 2-B Complete ---");
}

// ============================================================================
// run-picked command (Phase 2-B Run)
// ============================================================================

async function handleRunPicked(flags: Map<string, string>): Promise<void> {
  const dateFlag = flags.get("date");
  if (!dateFlag) {
    throw new Error(
      "Missing --date.\n" +
        'Usage: cli.js run-picked --date 20260215 [--dryRun true] [--concurrency 2] [--useRunList true]',
    );
  }

  const dryRunFlag = flags.get("dryRun") === "true";
  const useRunList = flags.get("useRunList") === "true";
  const concurrencyFlag = flags.get("concurrency");
  const concurrency = concurrencyFlag ? parseInt(concurrencyFlag, 10) : 2;
  if (isNaN(concurrency) || concurrency < 1) {
    throw new Error("--concurrency must be a positive integer.");
  }

  // Optional overrides
  const overrides: Partial<TopicRequest> = {};
  const depthFlag = flags.get("depth");
  if (depthFlag === "news" || depthFlag === "explainer" || depthFlag === "analysis") {
    overrides.depth = depthFlag;
  }
  const regionFlag = flags.get("region");
  if (regionFlag === "KR" || regionFlag === "GLOBAL") {
    overrides.region = regionFlag;
  }
  const maxArticlesFlag = flags.get("maxArticles");
  if (maxArticlesFlag) {
    const n = parseInt(maxArticlesFlag, 10);
    if (!isNaN(n) && n > 0) overrides.maxArticles = n;
  }
  const recencyDaysFlag = flags.get("recencyDays");
  if (recencyDaysFlag) {
    const n = parseInt(recencyDaysFlag, 10);
    if (!isNaN(n) && n > 0) overrides.recencyDays = n;
  }

  // Gate options (only relevant in picked mode)
  const useGate = flags.get("useGate") === "true";
  const requireGate = flags.get("requireGate") === "true";
  const minCoverageScoreFlag = flags.get("minCoverageScore");
  const minCoverageScore = minCoverageScoreFlag
    ? parseInt(minCoverageScoreFlag, 10)
    : 0;

  console.log("--- Phase 2-B Run: Execute Picked Seeds Batch ---");
  console.log(`Date        : ${dateFlag}`);
  console.log(`Dry run     : ${String(dryRunFlag)}`);
  console.log(`Concurrency : ${String(concurrency)}`);
  console.log(`Source      : ${useRunList ? "runlist" : "picked"}`);
  if (Object.keys(overrides).length > 0) {
    console.log(`Overrides   : ${JSON.stringify(overrides)}`);
  }
  if (!useRunList && useGate) {
    console.log(`Gate        : enabled`);
    console.log(`  require   : ${String(requireGate)}`);
    console.log(`  minScore  : ${String(minCoverageScore)}`);
  }
  console.log("");

  let report;
  try {
    report = await runPhase2BRun({
      dateYyyymmdd: dateFlag,
      overrides,
      batchOpts: { concurrency, dryRun: dryRunFlag },
      useRunList,
      gate: !useRunList && useGate
        ? {
            enabled: true,
            requireReport: requireGate,
            minCoverageScore,
          }
        : undefined,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("File not found")) {
      if (useRunList) {
        console.error(
          "Run list file not found. Run `runlist --save true` first.",
        );
      } else {
        console.error(
          "Picked seeds file not found. Run `pick-seeds` first.",
        );
      }
      process.exitCode = 1;
      return;
    }
    if (
      err instanceof Error &&
      err.message.includes("gate report not found")
    ) {
      console.error(err.message);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  // Execution source
  console.log(`Exec source : ${report.executionSource ?? "picked"}`);
  if (report.runListPath) {
    console.log(`Run list    : ${report.runListPath}`);
  }

  // Gate summary (picked mode only)
  if (report.gate) {
    const g = report.gate;
    console.log(`Gate        : passed=${String(g.passed)}, failed=${String(g.failed)}, missing=${String(g.missing)}`);
    if (g.reportPath) {
      console.log(`Gate report : ${g.reportPath}`);
    }
  }
  console.log("");

  // Summary
  const t = report.totals;
  console.log(`Total       : ${String(t.total)}`);
  console.log(`Will run    : ${String(t.willRun)}`);
  console.log(`OK          : ${String(t.ok)}`);
  console.log(`Failed      : ${String(t.failed)}`);
  console.log(`Skipped     : ${String(t.skipped)}`);
  console.log(`Duration    : ${String(report.timing.totalMs)}ms\n`);

  // Per-item results
  for (const item of report.items) {
    const fsTag = item.finalScore != null ? ` [fs=${String(item.finalScore)}]` : "";

    if (item.skipped) {
      const gateTag = item.gate ? ` [gate:${item.gate.decision ?? "-"}=${String(item.gate.score ?? 0)}]` : "";
      console.log(
        `  [${String(item.idx).padStart(2)}] SKIP  ${item.keyword} — ${item.skipReason ?? ""}${gateTag}${fsTag}`,
      );
    } else if (item.ok) {
      const s = item.summary;
      const dur = item.durationMs != null ? `${String(item.durationMs)}ms` : "-";
      const gateTag = item.gate ? ` [gate:${String(item.gate.score ?? 0)}]` : "";
      console.log(
        `  [${String(item.idx).padStart(2)}] OK    ${item.keyword} → ${item.topicId ?? "-"} (sources=${String(s?.sources ?? 0)}, facts=${String(s?.keyFacts ?? 0)}, angles=${String(s?.angles ?? 0)}) [${dur}]${gateTag}${fsTag}`,
      );
    } else {
      const dur = item.durationMs != null ? `${String(item.durationMs)}ms` : "-";
      console.log(
        `  [${String(item.idx).padStart(2)}] FAIL  ${item.keyword} — ${item.error ?? "unknown"} [${dur}]${fsTag}`,
      );
    }
  }

  console.log(`\nReport saved: ${getBatchRunReportPath(dateFlag, "KR")}`);
  console.log("\n--- Phase 2-B Run Complete ---");
}

// ============================================================================
// preflight command (Phase 2-C)
// ============================================================================

async function handlePreflight(flags: Map<string, string>): Promise<void> {
  const dateFlag = flags.get("date");
  if (!dateFlag) {
    throw new Error(
      "Missing --date.\n" +
        "Usage: cli.js preflight --date 20260215 [--geo KR]",
    );
  }

  // Parse PreflightOptions from flags
  const opts: PreflightOptions = {};
  const recencyDaysFlag = flags.get("recencyDays");
  if (recencyDaysFlag) {
    const n = parseInt(recencyDaysFlag, 10);
    if (!isNaN(n) && n > 0) opts.recencyDays = n;
  }
  const maxArticlesFlag = flags.get("maxArticles");
  if (maxArticlesFlag) {
    const n = parseInt(maxArticlesFlag, 10);
    if (!isNaN(n) && n > 0) opts.maxArticles = n;
  }
  const minTopScoreFlag = flags.get("minTopScore");
  if (minTopScoreFlag) {
    const n = parseInt(minTopScoreFlag, 10);
    if (!isNaN(n) && n >= 0) opts.minTopScore = n;
  }
  const minMatchedTopKFlag = flags.get("minMatchedTopK");
  if (minMatchedTopKFlag) {
    const n = parseInt(minMatchedTopKFlag, 10);
    if (!isNaN(n) && n >= 0) opts.minMatchedTopK = n;
  }
  const minUniquePubFlag = flags.get("minUniquePublishers");
  if (minUniquePubFlag) {
    const n = parseInt(minUniquePubFlag, 10);
    if (!isNaN(n) && n >= 0) opts.minUniquePublishers = n;
  }
  const concurrencyFlag = flags.get("concurrency");
  if (concurrencyFlag) {
    const n = parseInt(concurrencyFlag, 10);
    if (!isNaN(n) && n > 0) opts.concurrency = n;
  }

  console.log("--- Phase 2-C Preflight: RSS Coverage Gate ---");
  console.log(`Date        : ${dateFlag}`);
  if (Object.keys(opts).length > 0) {
    console.log(`Options     : ${JSON.stringify(opts)}`);
  }
  console.log("");

  let result;
  try {
    result = await runPhase2CPreflight(
      { dateYyyymmdd: dateFlag },
      opts,
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("File not found")) {
      console.error(
        "Picked seeds not found. Run `pick-seeds` first.",
      );
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const { report } = result;

  // Summary
  console.log(`Total       : ${String(report.total)}`);
  console.log(`Pass        : ${String(report.pass)}`);
  console.log(`Fail        : ${String(report.fail)}\n`);

  // Pass items (top 10)
  const passItems = report.items.filter((i) => i.decision === "pass");
  if (passItems.length > 0) {
    console.log(`PASS (top ${String(Math.min(passItems.length, 10))}):`);
    for (const item of passItems.slice(0, 10)) {
      const c = item.coverage;
      const seedStr = item.seedScore != null ? `seed=${String(item.seedScore)}` : "";
      console.log(
        `  [${String(c.score).padStart(3)}] ${item.keyword} — topK=${String(c.matchedTopK)}, pubs=${String(c.uniquePublishers)}, 24h=${String(c.last24h)}, top=${String(c.topScore)} ${seedStr}`,
      );
    }
    console.log("");
  }

  // Fail items (top 10)
  const failItems = report.items.filter((i) => i.decision === "fail");
  if (failItems.length > 0) {
    console.log(`FAIL (top ${String(Math.min(failItems.length, 10))}):`);
    for (const item of failItems.slice(0, 10)) {
      console.log(
        `  ${item.keyword} — ${item.reason ?? "unknown"}`,
      );
    }
    console.log("");
  }

  console.log(`Saved: ${result.savedPath}`);
  console.log("\n--- Phase 2-C Preflight Complete ---");
}

// ============================================================================
// runlist command (Phase 2-C Build Run List)
// ============================================================================

async function handleRunList(flags: Map<string, string>): Promise<void> {
  const dateFlag = flags.get("date");
  if (!dateFlag) {
    throw new Error(
      "Missing --date.\n" +
        "Usage: cli.js runlist --date 20260215 [--minFinalScore 60] [--requireGatePass true] [--save true]",
    );
  }

  const minFinalScoreFlag = flags.get("minFinalScore");
  const minFinalScore = minFinalScoreFlag
    ? parseInt(minFinalScoreFlag, 10)
    : 60;
  if (isNaN(minFinalScore) || minFinalScore < 0) {
    throw new Error("--minFinalScore must be a non-negative integer.");
  }

  const requireGatePass = flags.get("requireGatePass") !== "false";
  const saveFlag = flags.get("save") !== "false";

  console.log("--- Phase 2-C: Build Run List (FinalSeedScore) ---");
  console.log(`Date            : ${dateFlag}`);
  console.log(`Min final score : ${String(minFinalScore)}`);
  console.log(`Require gate    : ${String(requireGatePass)}`);
  console.log(`Save            : ${String(saveFlag)}\n`);

  let result;
  try {
    result = await runPhase2CBuildRunList({
      dateYyyymmdd: dateFlag,
      policy: { minFinalScore, requireGatePass },
      save: saveFlag,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("File not found")) {
      console.error(
        "Required input file not found. Ensure `seeds --save true`, `pick-seeds`, and optionally `preflight` have been run.",
      );
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const rl = result.runList;

  // Summary
  console.log(`Total  : ${String(rl.total)}`);
  console.log(`Run    : ${String(rl.run)}`);
  console.log(`Skip   : ${String(rl.skip)}\n`);

  // Inputs
  console.log(`Inputs:`);
  console.log(`  snapshot : ${rl.inputs.snapshotPath}`);
  console.log(`  picked   : ${rl.inputs.pickedPath}`);
  console.log(`  gate     : ${rl.inputs.gateReportPath ?? "(not available)"}\n`);

  // Run items
  const runItems = rl.items.filter((i) => i.action === "run");
  if (runItems.length > 0) {
    console.log(`RUN (${String(runItems.length)}):`);
    for (let i = 0; i < runItems.length; i++) {
      const item = runItems[i]!;
      const trendStr = item.trendScore != null ? String(item.trendScore) : "-";
      const covStr = item.coverageScore != null ? String(item.coverageScore) : "-";
      console.log(
        `  ${String(i + 1).padStart(3)}. [${String(item.finalScore).padStart(3)}] ${item.category.padEnd(9)} | ${item.keyword}`,
      );
      console.log(
        `       trend=${trendStr}, cov=${covStr}, gate=${item.gateDecision}`,
      );
    }
    console.log("");
  }

  // Skip items (top 10)
  const skipItems = rl.items.filter((i) => i.action === "skip");
  if (skipItems.length > 0) {
    const showN = Math.min(skipItems.length, 10);
    console.log(`SKIP (top ${String(showN)} of ${String(skipItems.length)}):`);
    for (const item of skipItems.slice(0, 10)) {
      console.log(
        `  [${String(item.finalScore).padStart(3)}] ${item.keyword} — ${item.skipReason ?? "unknown"}`,
      );
    }
    console.log("");
  }

  if (result.savedPath) {
    console.log(`Saved: ${result.savedPath}`);
  }

  console.log("\n--- Phase 2-C Run List Complete ---");
}

// ============================================================================
// fetch-url command
// ============================================================================

async function handleFetchUrl(flags: Map<string, string>): Promise<void> {
  const url = flags.get("url")?.trim();
  const out = flags.get("out")?.trim();

  if (!url) {
    throw new Error(
      "Missing --url.\n" +
        'Usage: cli.js fetch-url --url "https://..." --out "/path/signal-url.json"',
    );
  }
  if (!out) {
    throw new Error(
      "Missing --out.\n" +
        'Usage: cli.js fetch-url --url "https://..." --out "/path/signal-url.json"',
    );
  }

  console.log("--- URL Fetch: Single URL → Signal JSON ---");
  console.log(`URL  : ${url}`);
  console.log(`Out  : ${out}\n`);

  const result = await fetchUrlAsArticle({ url, outPath: out });

  console.log(`Title       : ${result.title}`);
  console.log(`Text length : ${String(result.textLength)} chars`);
  console.log(`Saved       : ${out}`);

  console.log("\n--- URL Fetch Complete ---");
}

// ============================================================================
// spotify command
// ============================================================================

async function handleSpotify(flags: Map<string, string>): Promise<void> {
  const args = process.argv.slice(2);
  // "spotify" is args[0], subcommand is args[1], rest is text or flags
  const subcommand = args[1] ?? "";

  if (subcommand === "parse") {
    const text = args.slice(2).filter((a) => !a.startsWith("--")).join(" ");
    if (!text) {
      throw new Error(
        'Usage: cli.js spotify parse "데이식스 새 앨범 소개"',
      );
    }

    console.log("--- Spotify Intent Parse ---");
    console.log(`Text: ${text}\n`);

    const intent = await parseIntent(text);

    console.log(`Intent Type : ${intent.intentType}`);
    console.log(`Source      : ${intent.source}`);
    console.log(`Confidence  : ${String(intent.confidence)}`);
    if (intent.artistName) console.log(`Artist      : ${intent.artistName}`);
    if (intent.albumName) console.log(`Album       : ${intent.albumName}`);
    if (intent.trackName) console.log(`Track       : ${intent.trackName}`);
    if (intent.compareWith) console.log(`Compare     : ${intent.compareWith}`);
    if (intent.mood) console.log(`Mood        : ${intent.mood}`);
    if (intent.limit) console.log(`Limit       : ${String(intent.limit)}`);

    console.log("\n--- Parse Complete ---");
    return;
  }

  if (subcommand === "fetch") {
    const text = args.slice(2).filter((a) => !a.startsWith("--")).join(" ");
    if (!text) {
      throw new Error(
        'Usage: cli.js spotify fetch "아이유 인기곡 TOP 5"',
      );
    }

    console.log("--- Spotify Data Fetch ---");
    console.log(`Text: ${text}\n`);

    const intent = await parseIntent(text);
    console.log(`Intent: ${intent.intentType} (${intent.source}, conf=${String(intent.confidence)})`);
    if (intent.artistName) console.log(`Artist: ${intent.artistName}`);
    console.log("");

    const data = await fetchSpotifyData(intent);

    if (data.albums && data.albums.length > 0) {
      console.log(`Albums (${String(data.albums.length)}):`);
      for (const a of data.albums.slice(0, 5)) {
        const artists = a.artists.map((ar) => ar.name).join(", ");
        console.log(`  - ${a.name} — ${artists} (${a.release_date ?? "?"})`);
      }
      console.log("");
    }

    if (data.artists && data.artists.length > 0) {
      console.log(`Artists (${String(data.artists.length)}):`);
      for (const a of data.artists.slice(0, 5)) {
        const genres = a.genres.slice(0, 3).join(", ") || "(no genres)";
        console.log(`  - ${a.name} | pop=${String(a.popularity)} | ${genres}`);
      }
      console.log("");
    }

    if (data.tracks && data.tracks.length > 0) {
      console.log(`Tracks (${String(data.tracks.length)}):`);
      for (const t of data.tracks.slice(0, 10)) {
        const artists = t.artists.map((ar) => ar.name).join(", ");
        console.log(`  - ${t.name} — ${artists} | pop=${String(t.popularity)}`);
      }
      console.log("");
    }

    if (data.audioFeatures && data.audioFeatures.length > 0) {
      console.log(`Audio Features (${String(data.audioFeatures.length)}):`);
      for (const af of data.audioFeatures.slice(0, 5)) {
        console.log(
          `  - id=${af.id} | bpm=${String(Math.round(af.tempo))} | energy=${String(af.energy)} | valence=${String(af.valence)}`,
        );
      }
      console.log("");
    }

    console.log(`Fetched at: ${data.fetchedAt}`);
    console.log("\n--- Fetch Complete ---");
    return;
  }

  if (subcommand === "enrich") {
    const topicId = flags.get("topicId");
    if (!topicId) {
      throw new Error(
        'Usage: cli.js spotify enrich --topicId <id>',
      );
    }

    console.log("--- Spotify Enrich TopicIntelPack ---");
    console.log(`Topic ID: ${topicId}\n`);

    // 1. Load topic-request for seedKeyword
    const reqPath = getTopicRequestPath(topicId);
    const rawReq = await loadJson<unknown>(reqPath);
    const request = parseTopicRequest(rawReq);

    // 2. Load existing topic-intel
    const intelPath = getTopicIntelPath(topicId);
    const rawIntel = await loadJson<unknown>(intelPath);
    const intel = parseTopicIntelPack(rawIntel);

    // 3. Parse intent + fetch Spotify data
    console.log(`Seed keyword: ${request.seedKeyword}`);
    const intent = await parseIntent(request.seedKeyword);
    console.log(`Intent: ${intent.intentType} (${intent.source})`);

    const spotifyData = await fetchSpotifyData(intent);
    console.log(
      `Fetched: albums=${String(spotifyData.albums?.length ?? 0)}, artists=${String(spotifyData.artists?.length ?? 0)}, tracks=${String(spotifyData.tracks?.length ?? 0)}`,
    );

    // 4. Enrich
    const enriched = await enrichTopicWithSpotify(intel, spotifyData);

    // 5. Save enriched pack
    await saveJson(intelPath, enriched);
    console.log(`\nEnriched topic-intel saved: ${intelPath}`);
    console.log(`  sources: ${String(intel.sources.length)} → ${String(enriched.sources.length)}`);
    console.log(`  keyFacts: ${String(intel.keyFacts.length)} → ${String(enriched.keyFacts.length)}`);
    console.log(`  imageQueries: ${String(intel.imageQueries.length)} → ${String(enriched.imageQueries.length)}`);
    console.log(`  angleCandidates: ${String(intel.angleCandidates.length)} → ${String(enriched.angleCandidates.length)}`);

    console.log("\n--- Enrich Complete ---");
    return;
  }

  throw new Error(
    `Unknown spotify subcommand "${subcommand}".\n` +
      "Available: parse, fetch, enrich\n" +
      'Usage:\n' +
      '  cli.js spotify parse "데이식스 새 앨범 소개"\n' +
      '  cli.js spotify fetch "아이유 인기곡 TOP 5"\n' +
      '  cli.js spotify enrich --topicId <id>',
  );
}

// ============================================================================
// spotify-prefetch command
// ============================================================================

async function handleSpotifyPrefetch(flags: Map<string, string>): Promise<void> {
  const prompt = flags.get("prompt");
  const out = flags.get("out");

  if (!prompt) {
    throw new Error(
      "Missing --prompt.\n" +
        'Usage: cli.js spotify-prefetch --prompt "아이브 컴백" --out /path/to/spotify-prefetch.json',
    );
  }
  if (!out) {
    throw new Error(
      "Missing --out.\n" +
        'Usage: cli.js spotify-prefetch --prompt "아이브 컴백" --out /path/to/spotify-prefetch.json',
    );
  }

  console.log("--- Spotify Prefetch ---");
  console.log(`Prompt: ${prompt}`);
  console.log(`Out   : ${out}\n`);

  // 1. Parse intent
  const intent = await parseIntent(prompt);
  console.log(`Intent: ${intent.intentType} (${intent.source}, conf=${String(intent.confidence)})`);
  if (intent.artistName) console.log(`Artist: ${intent.artistName}`);

  // 2. Fetch Spotify data
  const spotifyData = await fetchSpotifyData(intent);
  console.log(
    `Fetched: albums=${String(spotifyData.albums?.length ?? 0)}, artists=${String(spotifyData.artists?.length ?? 0)}, tracks=${String(spotifyData.tracks?.length ?? 0)}`,
  );

  // 3. Extract keywords
  const keywords = extractKeywordsFromSpotifyData(spotifyData);
  const flatKeywords = buildFlatKeywords(keywords);

  console.log(`\nKeywords (${String(flatKeywords.length)}):`);
  for (const kw of flatKeywords) {
    console.log(`  - ${kw}`);
  }

  // 4. Assemble result
  const result: SpotifyPrefetchResult = {
    prompt,
    intent,
    keywords,
    spotifyData,
    flatKeywords,
    createdAt: new Date().toISOString(),
  };

  // 5. Save
  await saveJson(out, result);
  console.log(`\nSaved: ${out}`);
  console.log("\n--- Spotify Prefetch Complete ---");
}

// ============================================================================
// main
// ============================================================================

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv);

  if (command === "request") {
    await handleRequest(flags);
    return;
  }

  if (command === "intel") {
    await handleIntel(flags);
    return;
  }

  if (command === "bridge-agent2") {
    await handleBridgeAgent2(flags);
    return;
  }

  if (command === "seeds") {
    await handleSeeds(flags);
    return;
  }

  if (command === "pick-seeds") {
    await handlePickSeeds(flags);
    return;
  }

  if (command === "run-picked") {
    await handleRunPicked(flags);
    return;
  }

  if (command === "preflight") {
    await handlePreflight(flags);
    return;
  }

  if (command === "runlist") {
    await handleRunList(flags);
    return;
  }

  if (command === "fetch-url") {
    await handleFetchUrl(flags);
    return;
  }

  if (command === "spotify") {
    await handleSpotify(flags);
    return;
  }

  if (command === "spotify-prefetch") {
    await handleSpotifyPrefetch(flags);
    return;
  }

  console.error(
    `Unknown command "${command}".\n` +
      "Available commands: request, intel, bridge-agent2, seeds, pick-seeds, run-picked, preflight, runlist, fetch-url, spotify, spotify-prefetch",
  );
  process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error("--- Error ---");
  if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
