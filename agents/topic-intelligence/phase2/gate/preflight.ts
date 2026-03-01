import { KR_FEEDS, type FeedDef } from "../../phase1/feeds/feeds.kr.js";
import { fetchFeedXml } from "../../phase1/feeds/fetch.js";
import {
  parseAndNormalizeFeedXml,
  type NormalizedArticle,
} from "../../phase1/feeds/normalize.js";
import { scoreArticle } from "../../phase1/relevance/score.js";
import { selectTopArticles } from "../../phase1/relevance/filter.js";

// ============================================================================
// Types
// ============================================================================

export type SeedCoverage = {
  keyword: string;
  category?: "music" | "lifestyle";
  seedScore?: number;
  coverage: {
    totalFetched: number;
    afterRecency: number;
    matchedTopK: number;
    uniquePublishers: number;
    last24h: number;
    topScore: number;
    score: number; // 0~100
  };
  sample: Array<{
    score: number;
    title: string;
    url: string;
    publisher?: string;
    publishedAt?: string;
  }>;
  decision: "pass" | "fail";
  reason?: string;
};

export type PreflightOptions = {
  recencyDays?: number; // default 7
  maxArticles?: number; // default 10 (topK)
  minTopScore?: number; // default 6
  minMatchedTopK?: number; // default 3
  minUniquePublishers?: number; // default 2
  concurrency?: number; // default 3 (feed fetch concurrency)
};

// ============================================================================
// Helpers
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

function selectFeeds(category?: "music" | "lifestyle"): FeedDef[] {
  if (category === "music" || category === "lifestyle") {
    return KR_FEEDS.filter((f) => f.category === category);
  }
  return KR_FEEDS;
}

function isWithinRecency(
  publishedAt: string | undefined,
  recencyDays: number,
): boolean {
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

const FRESH_24H_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Main
// ============================================================================

/**
 * Run a lightweight RSS coverage check for a single seed keyword.
 *
 * Reuses Phase1-A (feed fetch/parse) and Phase1-B (scoring/selection)
 * without creating topicId, saving files, or calling LLMs.
 */
export async function preflightSeedCoverage(
  params: {
    keyword: string;
    category?: "music" | "lifestyle";
    seedScore?: number;
  },
  opts?: PreflightOptions,
): Promise<SeedCoverage> {
  const recencyDays = opts?.recencyDays ?? 7;
  const maxArticles = opts?.maxArticles ?? 10;
  const minTopScore = opts?.minTopScore ?? 6;
  const minMatchedTopK = opts?.minMatchedTopK ?? 3;
  const minUniquePublishers = opts?.minUniquePublishers ?? 2;
  const concurrency = opts?.concurrency ?? 3;

  // 1) Select feeds by category
  const feeds = selectFeeds(params.category);

  // 2) Fetch + parse all feeds with concurrency limit
  const feedTasks = feeds.map(
    (feed) => async (): Promise<{
      items: NormalizedArticle[];
      rawCount: number;
    }> => {
      try {
        const xml = await fetchFeedXml(feed.url);
        const parsed = parseAndNormalizeFeedXml(xml, feed);
        return { items: parsed.items, rawCount: parsed.rawCount };
      } catch {
        return { items: [], rawCount: 0 };
      }
    },
  );

  const feedResults = await withConcurrency(feedTasks, concurrency);

  // 3) Collect all articles
  let totalFetched = 0;
  let allArticles: NormalizedArticle[] = [];
  for (const result of feedResults) {
    totalFetched += result.rawCount;
    allArticles = allArticles.concat(result.items);
  }

  // 4) Recency filter
  const afterRecencyList = allArticles.filter((a) =>
    isWithinRecency(a.publishedAt, recencyDays),
  );

  // 5) URL dedupe
  const deduped = dedupeByUrl(afterRecencyList);

  // 6) Score articles
  const scored = deduped.map((a) =>
    scoreArticle(a, params.keyword, params.category),
  );

  // 7) Select topK (minScore=1 to keep as many relevant as possible)
  const selected = selectTopArticles(scored, { maxArticles, minScore: 1 });

  // 8) Compute coverage metrics
  const matchedTopK = selected.length;

  const publisherSet = new Set<string>();
  for (const a of selected) {
    publisherSet.add(a.publisher ?? "unknown");
  }
  const uniquePublishers = publisherSet.size;

  const now = Date.now();
  let last24h = 0;
  for (const a of selected) {
    if (a.publishedAt) {
      const pub = new Date(a.publishedAt).getTime();
      if (!isNaN(pub) && now - pub < FRESH_24H_MS) {
        last24h++;
      }
    }
  }

  const topScore =
    selected.length > 0 ? Math.max(...selected.map((a) => a.score)) : 0;

  // Coverage score (0~100)
  let coverageScore =
    Math.min(matchedTopK * 10, 40) +
    Math.min(uniquePublishers * 15, 30) +
    Math.min(last24h * 10, 20) +
    Math.min(topScore * 3, 30);
  coverageScore = Math.max(0, Math.min(100, coverageScore));

  // 9) Pass/fail
  const failReasons: string[] = [];
  if (matchedTopK < minMatchedTopK) {
    failReasons.push(
      `matchedTopK=${String(matchedTopK)} < ${String(minMatchedTopK)}`,
    );
  }
  if (topScore < minTopScore) {
    failReasons.push(
      `topScore=${String(topScore)} < ${String(minTopScore)}`,
    );
  }
  if (uniquePublishers < minUniquePublishers) {
    failReasons.push(
      `uniquePublishers=${String(uniquePublishers)} < ${String(minUniquePublishers)}`,
    );
  }

  const decision = failReasons.length > 0 ? "fail" : "pass";
  const reason = failReasons.length > 0 ? failReasons.join("; ") : undefined;

  // 10) Sample: top 5 selected articles
  const sample = selected.slice(0, 5).map((a) => ({
    score: a.score,
    title: a.title,
    url: a.url,
    publisher: a.publisher,
    publishedAt: a.publishedAt,
  }));

  return {
    keyword: params.keyword,
    category: params.category,
    seedScore: params.seedScore,
    coverage: {
      totalFetched,
      afterRecency: deduped.length,
      matchedTopK,
      uniquePublishers,
      last24h,
      topScore,
      score: coverageScore,
    },
    sample,
    decision,
    reason,
  };
}
