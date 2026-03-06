import type { TrendItem } from "./types";
import { naverDatalabProvider } from "./naver-datalab";
import { naverSearchProvider } from "./naver-search";
import { youtubeProvider } from "./youtube";
import { hackerNewsProvider } from "./hackernews";
import { googleTrendsProvider } from "./google";

export type { TrendItem } from "./types";

// ---------------------------------------------------------------------------
// In-memory cache — 15 minute TTL
// ---------------------------------------------------------------------------

interface CacheEntry {
  items: TrendItem[];
  nicheItems: TrendItem[];
  fetchedAt: number;
  keyHash: string;
}

const CACHE_TTL = 15 * 60 * 1000;
let cache: CacheEntry | null = null;

function keyHash(kws: string[]): string {
  return kws.sort().join("|");
}

// ---------------------------------------------------------------------------
// Global trend providers (no keywords needed)
// ---------------------------------------------------------------------------

const globalProviders = [
  googleTrendsProvider,
  youtubeProvider,
  hackerNewsProvider,
];

// ---------------------------------------------------------------------------
// Niche trend providers (keyword-dependent)
// ---------------------------------------------------------------------------

const nicheProviders = [naverDatalabProvider, naverSearchProvider];

/**
 * Fetch trends from all providers.
 * - Global trends: Google Trends, YouTube KR, HackerNews
 * - Niche trends (if keywords provided): Naver DataLab + Naver News/Blog search
 *
 * Results are cached for 15 minutes.
 */
export async function fetchTrends(
  topicKeywords?: string[],
): Promise<{ global: TrendItem[]; niche: TrendItem[] }> {
  const kws = topicKeywords ?? [];
  const kh = keyHash(kws);

  if (cache && cache.keyHash === kh && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return { global: cache.items, niche: cache.nicheItems };
  }

  // Fetch global + niche in parallel
  const [globalResults, nicheResults] = await Promise.all([
    Promise.allSettled(
      globalProviders.map((p) => p.fetch({ geo: "KR" })),
    ),
    kws.length > 0
      ? Promise.allSettled(
          nicheProviders.map((p) => p.fetch({ keywords: kws, geo: "KR" })),
        )
      : Promise.resolve([]),
  ]);

  const globalItems: TrendItem[] = [];
  for (const r of globalResults) {
    if (r.status === "fulfilled") globalItems.push(...r.value);
  }

  const nicheItems: TrendItem[] = [];
  for (const r of nicheResults) {
    if (r.status === "fulfilled") nicheItems.push(...r.value);
  }

  cache = { items: globalItems, nicheItems, fetchedAt: Date.now(), keyHash: kh };
  return { global: globalItems, niche: nicheItems };
}

/**
 * Format trends into a text block suitable for LLM prompt injection.
 */
export function formatTrendsForPrompt(
  global: TrendItem[],
  niche: TrendItem[],
  maxPerSection = 10,
): string {
  const parts: string[] = [];

  if (global.length > 0) {
    parts.push("## 오늘의 트렌드 (실시간 데이터)");
    parts.push(
      ...global.slice(0, maxPerSection).map(
        (t, i) =>
          `${i + 1}. [${t.source}] ${t.title}${t.description ? ` — ${t.description}` : ""}`,
      ),
    );
  }

  if (niche.length > 0) {
    parts.push("\n## 내 분야 최신 동향 (뉴스/블로그)");
    parts.push(
      ...niche.slice(0, maxPerSection).map(
        (t, i) =>
          `${i + 1}. [${t.source}] ${t.title}${t.description ? ` — ${t.description}` : ""}`,
      ),
    );
  }

  return parts.length > 0 ? parts.join("\n") : "(트렌드 데이터 없음)";
}
