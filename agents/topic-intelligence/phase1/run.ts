import { readFile } from "node:fs/promises";
import { loadJson } from "../io/load.js";
import { saveJson } from "../io/save.js";
import {
  getTopicRequestPath,
  getTopicIntelPath,
  getSourcesRawPath,
  getArticlesIndexPath,
} from "../io/paths.js";
import { parseTopicRequest, parseTopicIntelPack } from "../schema.js";
import type { TopicIntelPack, TopicSource, TopicKeyFact } from "../contracts.js";
import { normalizeTopic } from "../utils/normalize.js";
import { nowIso } from "../utils/time.js";
import { DEFAULTS } from "../interpret/defaults.js";
import { parseIntent } from "../spotify/intent.js";
import { fetchSpotifyData } from "../spotify/fetcher.js";
import { enrichTopicWithSpotify } from "../spotify/enrich.js";
import type { SpotifyDataPack } from "../spotify/types.js";
import { KR_FEEDS, type FeedDef } from "./feeds/feeds.kr.js";
import { fetchFeedXml } from "./feeds/fetch.js";
import {
  parseAndNormalizeFeedXml,
  type NormalizedArticle,
} from "./feeds/normalize.js";
import { fetchGoogleNewsFeed } from "./feeds/dynamic.js";
import { searchNaverNews, naverItemToArticle } from "./feeds/naver.js";
import { buildNaverQueryPlan } from "./feeds/naver-queries.js";
import { scoreArticle, scoreArticleWithEntities, type ScoredArticle } from "./relevance/score.js";
import { selectTopArticles } from "./relevance/filter.js";
import {
  generateKeyFacts,
  type KeyFactCandidate,
} from "./facts/extract.js";
import { generateAngles, generateEvergreenAngles } from "./angles/generate.js";
import { generateAnglesWithLLM, generateEvergreenAnglesWithLLM } from "./angles/generate-llm.js";
import { getRecentAngles, appendHistory } from "./angles/history.js";
import { extractEvergreenFacts } from "./evergreen/extract.js";
import { generateImageQueries } from "./images/queries.js";
import { generateRiskNotes } from "./risk/notes.js";
import {
  clusterSourcesByTitle,
  type CoverageSource,
  type CoverageCluster,
} from "./coverage/cluster.js";
import {
  computeMomentumSignals,
  type MomentumSignals,
} from "./coverage/momentum.js";
import {
  buildAndSaveArticleCache,
  type ArticleCache,
} from "./article/cache.js";

// ============================================================================
// Types
// ============================================================================

export type Phase1Options = {
  /** Pre-loaded external articles (from trend-signals agent). */
  externalArticles?: NormalizedArticle[];
  /** Skip Spotify enrichment even for music category. */
  skipSpotify?: boolean;
  /** Path to spotify-prefetch.json from the prefetch step (pipeline). */
  spotifyPrefetchPath?: string;
};

export type Phase1AResult = {
  topicId: string;
  feedsTotal: number;
  feedsOk: number;
  totalRaw: number;
  totalAfterRecency: number;
  articles: NormalizedArticle[];
  errors: Array<{ feedId: string; url: string; message: string }>;
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Select RSS feeds based on category and seed keyword.
 * 
 * Strategy:
 * - If seedKeyword contains specific artist/band name (2+ words), 
 *   search across all music feeds + lifestyle feeds for better coverage
 * - Otherwise, use category-based filtering
 */
function selectFeeds(category?: string, seedKeyword?: string): FeedDef[] {
  // If seedKeyword looks like a specific artist/band name (2+ words),
  // expand search to both music and lifestyle for better coverage
  if (seedKeyword) {
    const words = seedKeyword.trim().split(/\s+/).filter((w) => w.length > 1);
    // If keyword has 2+ meaningful words, likely a specific artist/band name
    if (words.length >= 2) {
      // Search in both music and lifestyle feeds for better coverage
      // This helps find indie bands that might be covered in lifestyle/culture sections
      return KR_FEEDS.filter((f) => 
        f.category === "music" || f.category === "lifestyle"
      );
    }
  }
  
  // Default: category-based filtering
  if (category === "music" || category === "lifestyle") {
    return KR_FEEDS.filter((f) => f.category === category);
  }
  return KR_FEEDS;
}

function isWithinRecency(
  publishedAt: string | undefined,
  recencyDays: number,
): boolean {
  // No date → keep (may flag as risk later)
  if (!publishedAt) return true;

  const pubDate = new Date(publishedAt).getTime();
  if (isNaN(pubDate)) return true;

  const cutoff = Date.now() - recencyDays * 24 * 60 * 60 * 1000;
  return pubDate >= cutoff;
}

function dedupeByUrl(articles: NormalizedArticle[]): NormalizedArticle[] {
  const seen = new Set<string>();
  const result: NormalizedArticle[] = [];

  for (const a of articles) {
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    result.push(a);
  }

  return result;
}

// ============================================================================
// Main runner
// ============================================================================

/**
 * Phase 1-A: Fetch news articles, filter by recency, dedupe.
 *
 * Uses Naver Search API when NAVER_CLIENT_ID is set,
 * falls back to RSS + Google News otherwise.
 *
 * Does NOT score, extract facts, or produce topic-intel.json.
 */
export async function runPhase1A(topicId: string, opts?: Phase1Options): Promise<Phase1AResult> {
  // 1) Load and validate topic request
  const reqPath = getTopicRequestPath(topicId);
  const rawReq = await loadJson<unknown>(reqPath);
  const request = parseTopicRequest(rawReq);

  const useNaver = !!process.env.NAVER_CLIENT_ID;

  let totalRaw = 0;
  let allArticles: NormalizedArticle[] = [];
  const errors: Phase1AResult["errors"] = [];
  let queriesTotal = 0;

  if (useNaver) {
    // ── Naver Search API path ──────────────────────────────────
    console.log("[Phase 1-A] Using Naver Search API");

    const alignedKeywords: string[] | undefined =
      (rawReq as Record<string, unknown>).alignedKeywords as string[] | undefined;

    const plan = buildNaverQueryPlan({
      seedKeyword: request.seedKeyword,
      searchEntities: request.searchEntities,
      alignedKeywords,
      category: request.category,
    });

    queriesTotal = plan.queries.length;

    // Execute queries with concurrency limit of 3
    const CONCURRENCY = 3;
    let nextIdx = 0;

    async function worker(): Promise<void> {
      while (nextIdx < plan.queries.length) {
        const idx = nextIdx++;
        const q = plan.queries[idx]!;
        try {
          const result = await searchNaverNews({
            query: q.query,
            display: q.display,
            sort: q.sort,
          });
          const articles = result.items.map((item) =>
            naverItemToArticle(item, q.feedId, q.feedTitle),
          );
          totalRaw += result.items.length;
          allArticles = allArticles.concat(articles);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push({ feedId: q.feedId, url: `naver:${q.query}`, message: msg });
        }
      }
    }

    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(CONCURRENCY, plan.queries.length); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
  } else {
    // ── RSS + Google News fallback path ────────────────────────
    console.log("[Phase 1-A] Naver credentials not set — falling back to RSS");

    // Select feeds by category and seed keyword
    const feeds = selectFeeds(request.category, request.seedKeyword);
    queriesTotal = feeds.length;

    // Fetch + parse all feeds in parallel
    const results = await Promise.allSettled(
      feeds.map(async (feed) => {
        const xml = await fetchFeedXml(feed.url);
        return parseAndNormalizeFeedXml(xml, feed);
      }),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      const feed = feeds[i]!;
      if (result.status === "fulfilled") {
        totalRaw += result.value.rawCount;
        allArticles = allArticles.concat(result.value.items);
      } else {
        const msg =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        errors.push({ feedId: feed.id, url: feed.url, message: msg });
      }
    }

    // Google News: entity-based multi-query
    const searchEntities: string[] | undefined = request.searchEntities;
    const region = (request.region ?? DEFAULTS.region) as "KR" | "GLOBAL";
    const gnRegion = region === "GLOBAL" ? "US" : region;

    if (searchEntities && searchEntities.length > 0) {
      for (const entity of searchEntities) {
        try {
          const gnResult = await fetchGoogleNewsFeed(entity, gnRegion);
          totalRaw += gnResult.rawCount;
          allArticles = allArticles.concat(gnResult.articles);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push({ feedId: `google-news:${entity}`, url: "(dynamic)", message: msg });
        }
      }
      try {
        const gnResult = await fetchGoogleNewsFeed(request.seedKeyword, gnRegion);
        totalRaw += gnResult.rawCount;
        allArticles = allArticles.concat(gnResult.articles);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ feedId: "google-news-seed", url: "(dynamic)", message: msg });
      }
    } else {
      try {
        const gnResult = await fetchGoogleNewsFeed(request.seedKeyword, gnRegion);
        totalRaw += gnResult.rawCount;
        allArticles = allArticles.concat(gnResult.articles);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ feedId: "google-news-dynamic", url: "(dynamic)", message: msg });
      }
    }

    // Additional Google News queries for aligned keywords
    const alignedKeywords: string[] | undefined =
      (rawReq as Record<string, unknown>).alignedKeywords as string[] | undefined;
    if (alignedKeywords && alignedKeywords.length > 0) {
      const extraKeywords = alignedKeywords
        .filter((kw) => kw.toLowerCase() !== request.seedKeyword.toLowerCase())
        .slice(0, 3);
      for (const kw of extraKeywords) {
        try {
          const gnResult = await fetchGoogleNewsFeed(kw, gnRegion);
          totalRaw += gnResult.rawCount;
          allArticles = allArticles.concat(gnResult.articles);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push({ feedId: `google-news-aligned:${kw}`, url: "(dynamic)", message: msg });
        }
      }
    }
  }

  // External signal articles (from trend-signals agent)
  const external = opts?.externalArticles ?? [];
  if (external.length > 0) {
    totalRaw += external.length;
    allArticles = allArticles.concat(external);
  }

  // Recency filter
  const recencyDays = request.recencyDays ?? DEFAULTS.recencyDays;
  const afterRecency = allArticles.filter((a) =>
    isWithinRecency(a.publishedAt, recencyDays),
  );

  // URL dedupe
  const deduped = dedupeByUrl(afterRecency);

  const externalCount = external.length > 0 ? 1 : 0;
  return {
    topicId,
    feedsTotal: queriesTotal + externalCount,
    feedsOk: queriesTotal + externalCount - errors.length,
    totalRaw,
    totalAfterRecency: deduped.length,
    articles: deduped,
    errors,
  };
}

// ============================================================================
// Phase 1-B: Relevance scoring + topK selection
// ============================================================================

export type Phase1BResult = Phase1AResult & {
  selected: ScoredArticle[];
  spotifyData?: SpotifyDataPack;
};

/**
 * Phase 1-B: Run Phase1-A then score and select top articles.
 * Phase 1-B2: If category is "music", fetch Spotify data (soft-fail).
 *
 * Does NOT extract facts, angles, or produce topic-intel.json.
 */
export async function runPhase1B(topicId: string, opts?: Phase1Options): Promise<Phase1BResult> {
  // 1) Run Phase 1-A
  const phaseA = await runPhase1A(topicId, opts);

  // 2) Load request for scoring params
  const reqPath = getTopicRequestPath(topicId);
  const rawReq = await loadJson<unknown>(reqPath);
  const request = parseTopicRequest(rawReq);

  const category = request.category as "music" | "lifestyle" | undefined;
  const maxArticles = request.maxArticles ?? DEFAULTS.maxArticles;

  // 3) Score all articles — entity-aware if entities available
  const entityList = request.searchEntities;
  const scored = phaseA.articles.map((a) =>
    entityList && entityList.length > 0
      ? scoreArticleWithEntities(a, request.seedKeyword, entityList, category)
      : scoreArticle(a, request.seedKeyword, category),
  );

  // 4) Select topK — raise minScore when entities are present
  const minScore = (entityList && entityList.length > 0) ? 3 : 1;
  const selected = selectTopArticles(scored, { maxArticles, minScore });

  // 5) Phase 1-B2: Spotify enrichment (music category only, soft-fail)
  //    Skip if spotifyPrefetchPath is set (data already fetched by spotify_prefetch step)
  let spotifyData: SpotifyDataPack | undefined;
  if (category === "music" && !opts?.skipSpotify && !opts?.spotifyPrefetchPath) {
    try {
      const intent = await parseIntent(request.seedKeyword);
      spotifyData = await fetchSpotifyData(intent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Phase 1-B2] Spotify enrichment failed (soft-fail): ${msg}`);
    }
  } else if (opts?.spotifyPrefetchPath) {
    console.log("[Phase 1-B2] Spotify fetch skipped — data from prefetch step");
  }

  return { ...phaseA, selected, spotifyData };
}

// ============================================================================
// Phase 1-C: Generate MVP content fields
// ============================================================================

export type Phase1CResult = Phase1BResult & {
  generated: {
    keyFacts: KeyFactCandidate[];
    angleCandidates: string[];
    imageQueries: string[];
    riskNotes: string[];
    missingPublishedAtCount: number;
    factsUsed: "body" | "title";
    clusters: CoverageCluster[];
    momentum: MomentumSignals;
  };
};

/**
 * Phase 1-C: Run Phase1-B then generate keyFacts, angles, imageQueries, riskNotes.
 *
 * Does NOT save topic-intel.json (that is Task 6).
 */
export async function runPhase1C(topicId: string, opts?: Phase1Options): Promise<Phase1CResult> {
  // 1) Run Phase 1-B
  const phaseB = await runPhase1B(topicId, opts);

  // 2) Load request for params
  const reqPath = getTopicRequestPath(topicId);
  const rawReq = await loadJson<unknown>(reqPath);
  const request = parseTopicRequest(rawReq);

  const normalizedTopicStr = normalizeTopic(request.seedKeyword);
  const category = request.category as "music" | "lifestyle" | undefined;
  const depth = request.depth ?? DEFAULTS.depth;

  // 3) Count missing publishedAt
  const missingPublishedAtCount = phaseB.selected.filter(
    (a) => !a.publishedAt,
  ).length;

  // 4) Coverage clustering
  const coverageSources: CoverageSource[] = phaseB.selected.map((a, idx) => ({
    idx,
    title: a.title,
    url: a.url,
    publisher: a.publisher,
    publishedAt: a.publishedAt,
  }));
  const clusters = clusterSourcesByTitle(coverageSources);

  // 5) Momentum signals
  const currentIso = nowIso();
  const momentum = computeMomentumSignals({
    nowIso: currentIso,
    sources: coverageSources,
    clusters,
  });

  // 6) Generate keyFacts (body-based with title fallback)
  const factsResult = await generateKeyFacts({
    topicId,
    seedKeyword: request.seedKeyword,
    normalizedTopic: normalizedTopicStr,
    category,
    selected: phaseB.selected,
    clusters,
  });
  const keyFacts = factsResult.keyFacts;
  const factsUsed = factsResult.used;

  // 7) Generate angles (LLM with template reference + history avoidance)
  const coverageHint = `최근 24시간 기사 ${String(momentum.sourcesLast24h)}개 / 매체 ${String(momentum.uniquePublishers)}곳`;
  const templateAngles = generateAngles(normalizedTopicStr, category, depth, {
    coverageHint,
  });
  const recentAngles = await getRecentAngles(7);
  const angleCandidates = await generateAnglesWithLLM({
    normalizedTopic: normalizedTopicStr,
    category,
    depth,
    keyFacts: keyFacts.map((f) => f.text),
    coverageHint,
    templateExamples: templateAngles,
    recentAngles,
  });

  // 8) Generate image queries
  const imageQueries = generateImageQueries(
    request.seedKeyword,
    normalizedTopicStr,
    category,
  );

  // 9) Generate risk notes
  const riskNotes = generateRiskNotes({
    seedKeyword: request.seedKeyword,
    category,
    selectedCount: phaseB.selected.length,
    missingPublishedAtCount,
  });

  // 10) Prepend coverage summary to riskNotes
  const coverageNote = `Coverage: sources=${String(momentum.totalSources)}, publishers=${String(momentum.uniquePublishers)}, 24h=${String(momentum.sourcesLast24h)}, score=${String(momentum.score)}/100`;
  riskNotes.unshift(coverageNote);

  return {
    ...phaseB,
    generated: {
      keyFacts,
      angleCandidates,
      imageQueries,
      riskNotes,
      missingPublishedAtCount,
      factsUsed,
      clusters,
      momentum,
    },
  };
}

// ============================================================================
// Phase 1-D: Assemble + Validate + Save TopicIntelPack
// ============================================================================

export type Phase1DOptions = Phase1Options & {
  writeRaw?: boolean; // default false
};

export type Phase1DResult = Phase1CResult & {
  topicIntel: TopicIntelPack;
  savedPaths: { topicIntelPath: string; sourcesRawPath?: string };
};

/**
 * Phase 1-D: Run Phase1-C, assemble TopicIntelPack, validate via Zod, save.
 */
export async function runPhase1D(
  topicId: string,
  opts?: Phase1DOptions,
): Promise<Phase1DResult> {
  // 1) Run Phase 1-C
  const phaseC = await runPhase1C(topicId, opts);

  // 2) Load request for metadata
  const reqPath = getTopicRequestPath(topicId);
  const rawReq = await loadJson<Record<string, unknown>>(reqPath);
  const request = parseTopicRequest(rawReq);

  // 3) createdAt
  const createdAt =
    typeof rawReq.createdAt === "string" ? rawReq.createdAt : nowIso();

  // 4) normalizedTopic
  const normalizedTopicStr = normalizeTopic(request.seedKeyword);

  // 5) category — fallback to "unknown"
  const riskNotes = [...phaseC.generated.riskNotes];
  let category: string;
  if (request.category) {
    category = request.category;
  } else {
    category = "unknown";
    riskNotes.push("Category missing; downstream may fail.");
  }

  // 6) sources: ScoredArticle → TopicSource
  const sources: TopicSource[] = phaseC.selected.map((a) => ({
    title: a.title,
    publisher: a.publisher,
    url: a.url,
    publishedAt: a.publishedAt,
  }));

  // 7) keyFacts: filter text < 20 chars, ensure evidenceUrls ≥ 1
  const keyFacts: TopicKeyFact[] = phaseC.generated.keyFacts
    .filter((f) => f.text.length >= 20 && f.evidenceUrls.length >= 1)
    .map((f) => ({ text: f.text, evidenceUrls: f.evidenceUrls }));

  // 8-9) Assemble TopicIntelPack
  const pack: TopicIntelPack = {
    topicId,
    normalizedTopic: normalizedTopicStr,
    category,
    angleCandidates: phaseC.generated.angleCandidates,
    sources,
    keyFacts,
    imageQueries: phaseC.generated.imageQueries,
    riskNotes,
    createdAt,
  };

  // 10) Spotify enrichment (if available from Phase 1-B2 or prefetch file)
  let spotifyDataForEnrich: SpotifyDataPack | undefined = phaseC.spotifyData;

  // If no spotifyData from Phase 1-B2, try loading from prefetch file
  if (!spotifyDataForEnrich && opts?.spotifyPrefetchPath && category === "music") {
    try {
      const prefetchRaw = JSON.parse(await readFile(opts.spotifyPrefetchPath, "utf-8")) as {
        spotifyData?: SpotifyDataPack;
      };
      if (prefetchRaw.spotifyData) {
        spotifyDataForEnrich = prefetchRaw.spotifyData;
        console.log("[Phase 1-D] Loaded spotifyData from prefetch file");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Phase 1-D] Failed to load spotify-prefetch.json (soft-fail): ${msg}`);
    }
  }

  let finalPack: TopicIntelPack = pack;
  if (spotifyDataForEnrich) {
    try {
      finalPack = await enrichTopicWithSpotify(pack, spotifyDataForEnrich);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Phase 1-D] Spotify enrichment merge failed (soft-fail): ${msg}`);
    }
  }

  // 11) Validate via Zod
  const validated = parseTopicIntelPack(finalPack);

  // 12) Save
  const topicIntelPath = getTopicIntelPath(topicId);
  await saveJson(topicIntelPath, validated);

  // 13) Append to angle history for future diversity
  await appendHistory({
    topicId,
    normalizedTopic: normalizedTopicStr,
    category,
    angles: validated.angleCandidates,
    createdAt: validated.createdAt,
  });

  let sourcesRawPath: string | undefined;
  if (opts?.writeRaw) {
    sourcesRawPath = getSourcesRawPath(topicId);
    await saveJson(sourcesRawPath, phaseC.articles);
  }

  return {
    ...phaseC,
    topicIntel: validated,
    savedPaths: { topicIntelPath, sourcesRawPath },
  };
}

// ============================================================================
// Phase 1-D Evergreen: Wikipedia + Spotify based pipeline
// ============================================================================

/**
 * Evergreen pipeline: skips RSS/Google News, uses Wikipedia + Spotify instead.
 *
 * Differences from trending:
 *  - Sources: Wikipedia API + Spotify (not RSS/Google News)
 *  - Scoring: entity salience only (no freshness)
 *  - keyFacts: from Wikipedia sections + Spotify data
 *  - angles: evergreen templates (timeline, discography, guide)
 */
export async function runPhase1DEvergreen(
  topicId: string,
  opts?: Phase1DOptions,
): Promise<Phase1DResult> {
  // 1) Load request
  const reqPath = getTopicRequestPath(topicId);
  const rawReq = await loadJson<Record<string, unknown>>(reqPath);
  const request = parseTopicRequest(rawReq);

  const normalizedTopicStr = normalizeTopic(request.seedKeyword);
  const category = (request.category ?? "unknown") as string;
  const categoryTyped = request.category as "music" | "lifestyle" | undefined;
  const createdAt =
    typeof rawReq.createdAt === "string" ? rawReq.createdAt : nowIso();

  const entities = request.searchEntities ?? [];

  // 2) Extract evergreen facts from Wikipedia + Spotify
  console.log("[Phase 1-D Evergreen] Fetching Wikipedia + Spotify data...");

  const evergreenResult = await extractEvergreenFacts({
    prompt: rawReq.prompt as string ?? request.seedKeyword,
    seedKeyword: request.seedKeyword,
    entities,
    category,
    spotifyPrefetchPath: opts?.spotifyPrefetchPath,
  });

  // 3) Build sources
  const sources: TopicSource[] = evergreenResult.sources;

  // 4) Build keyFacts (filter by min length)
  const keyFacts: TopicKeyFact[] = evergreenResult.keyFacts
    .filter((f) => f.text.length >= 20 && f.evidenceUrls.length >= 1)
    .map((f) => ({ text: f.text, evidenceUrls: f.evidenceUrls }));

  // 5) Generate evergreen angles (LLM with template reference + history avoidance)
  const templateAngles = generateEvergreenAngles(normalizedTopicStr, categoryTyped);
  const recentAngles = await getRecentAngles(7);
  const angleCandidates = await generateEvergreenAnglesWithLLM({
    normalizedTopic: normalizedTopicStr,
    category: categoryTyped,
    keyFacts: keyFacts.map((f) => f.text),
    templateExamples: templateAngles,
    recentAngles,
  });

  // 6) Image queries (artist/album focused)
  const imageQueries = generateImageQueries(
    request.seedKeyword,
    normalizedTopicStr,
    categoryTyped,
  );

  // 7) Risk notes
  const riskNotes: string[] = [];
  riskNotes.push(`TopicType: evergreen (Wikipedia + Spotify pipeline)`);

  if (keyFacts.length === 0) {
    riskNotes.push("No entity-matched facts from Wikipedia/Spotify");
  }
  if (evergreenResult.wikiArticle) {
    riskNotes.push(`Wikipedia: "${evergreenResult.wikiArticle.title}" (${String(evergreenResult.wikiArticle.sections.length)} sections)`);
  } else {
    riskNotes.push("Wikipedia article not found — facts may be limited");
  }
  if (!request.category) {
    riskNotes.push("Category missing; downstream may fail.");
  }

  // 8) Spotify enrichment (if available)
  let spotifyDataForEnrich: SpotifyDataPack | undefined = evergreenResult.spotifyData;

  if (!spotifyDataForEnrich && opts?.spotifyPrefetchPath && category === "music") {
    try {
      const prefetchRaw = JSON.parse(await readFile(opts.spotifyPrefetchPath, "utf-8")) as {
        spotifyData?: SpotifyDataPack;
      };
      spotifyDataForEnrich = prefetchRaw.spotifyData;
    } catch {
      // soft-fail
    }
  }

  // 9) Assemble pack
  const pack: TopicIntelPack = {
    topicId,
    normalizedTopic: normalizedTopicStr,
    category,
    angleCandidates,
    sources,
    keyFacts,
    imageQueries,
    riskNotes,
    createdAt,
  };

  let finalPack: TopicIntelPack = pack;
  if (spotifyDataForEnrich) {
    try {
      finalPack = await enrichTopicWithSpotify(pack, spotifyDataForEnrich);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Phase 1-D Evergreen] Spotify enrichment failed (soft-fail): ${msg}`);
    }
  }

  // 10) Validate + save
  const validated = parseTopicIntelPack(finalPack);
  const topicIntelPath = getTopicIntelPath(topicId);
  await saveJson(topicIntelPath, validated);

  // 11) Append to angle history for future diversity
  await appendHistory({
    topicId,
    normalizedTopic: normalizedTopicStr,
    category,
    angles: validated.angleCandidates,
    createdAt: validated.createdAt,
  });

  let sourcesRawPath: string | undefined;
  if (opts?.writeRaw) {
    sourcesRawPath = getSourcesRawPath(topicId);
    await saveJson(sourcesRawPath, []);
  }

  // Build a minimal Phase1CResult-compatible shape
  const emptyPhaseC: Phase1CResult = {
    topicId,
    feedsTotal: 0,
    feedsOk: 0,
    totalRaw: 0,
    totalAfterRecency: 0,
    articles: [],
    errors: [],
    selected: [],
    generated: {
      keyFacts: evergreenResult.keyFacts,
      angleCandidates,
      imageQueries,
      riskNotes,
      missingPublishedAtCount: 0,
      factsUsed: "body",
      clusters: [],
      momentum: {
        totalSources: sources.length,
        uniquePublishers: new Set(sources.map((s) => s.publisher ?? "")).size,
        sourcesLast24h: 0,
        sourcesLast72h: 0,
        topClusterSize: 0,
        score: 0,
      },
    },
  };

  return {
    ...emptyPhaseC,
    topicIntel: validated,
    savedPaths: { topicIntelPath, sourcesRawPath },
  };
}

// ============================================================================
// Phase 1-E: Article Body Fetch + Text Extraction Cache
// ============================================================================

export type Phase1EResult = Phase1DResult & {
  articleCaches: ArticleCache[];
  articleIndexPath: string;
};

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
 * Phase 1-E: Fetch article bodies, extract text, cache results.
 *
 * Runs Phase1-D first to ensure topic-intel.json exists, then fetches
 * each source's HTML body with concurrency=3.
 */
export async function runPhase1E(topicId: string, opts?: Phase1DOptions): Promise<Phase1EResult> {
  // 1) Run Phase 1-D
  const phaseD = await runPhase1D(topicId, opts);

  // 2) Build tasks from sources
  const sources = phaseD.topicIntel.sources;

  const tasks = sources.map((source, idx) => {
    return () =>
      buildAndSaveArticleCache({
        topicId,
        idx,
        url: source.url,
        titleFromFeed: source.title,
      });
  });

  // 3) Execute with concurrency limit
  const articleCaches = await withConcurrency(tasks, 3);

  // 4) Build and save index.json
  const indexPath = getArticlesIndexPath(topicId);
  const indexData = {
    topicId,
    count: articleCaches.length,
    items: articleCaches.map((c) => ({
      idx: c.idx,
      url: c.url,
      title: c.titleFromFeed,
      cachePath: `article.${String(c.idx)}.json`,
      ok: c.ok,
      error: c.error?.message ?? null,
    })),
  };
  await saveJson(indexPath, indexData);

  return {
    ...phaseD,
    articleCaches,
    articleIndexPath: indexPath,
  };
}
