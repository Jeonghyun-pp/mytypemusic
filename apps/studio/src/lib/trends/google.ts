// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare function require(name: string): any;
import type { TrendProvider, TrendItem } from "./types";

const KEYWORD_TIMEOUT = 10_000;
const KEYWORD_DELAY = 500; // ms between sequential keyword calls (rate limit protection)

/**
 * Google Trends — daily trending + keyword related queries.
 * - dailyTrends: free, no auth, fragile (breaks 2-3x/year).
 * - relatedQueries: free, no auth, sequential with delay to avoid blocks.
 */
export const googleTrendsProvider: TrendProvider = {
  name: "google",
  async fetch(opts) {
    const geo = opts?.geo ?? "KR";
    const [dailyItems, keywordItems] = await Promise.all([
      fetchDailyTrends(geo),
      fetchKeywordRelated(opts?.keywords ?? [], geo),
    ]);
    return [...dailyItems, ...keywordItems];
  },
};

async function fetchDailyTrends(geo: string): Promise<TrendItem[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const googleTrends = require("google-trends-api");
    const raw = await Promise.race([
      googleTrends.dailyTrends({ geo }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Google Trends timeout")), 10_000),
      ),
    ]);
    const data = JSON.parse(raw);
    const days = data.default?.trendingSearchesDays ?? [];
    const items: TrendItem[] = [];

    for (const day of days.slice(0, 1)) {
      for (const ts of (day.trendingSearches ?? []).slice(0, 10)) {
        items.push({
          title: ts.title?.query ?? "",
          source: "google",
          url: ts.articles?.[0]?.url,
          description: ts.articles?.[0]?.title ?? "",
          rank: items.length + 1,
          fetchedAt: new Date(),
        });
      }
    }
    return items;
  } catch {
    return []; // graceful fallback
  }
}

async function fetchKeywordRelated(keywords: string[], geo: string): Promise<TrendItem[]> {
  if (keywords.length === 0) return [];

  const items: TrendItem[] = [];

  // Sequential calls with delay to avoid rate limiting (unofficial scraping API)
  for (const kw of keywords.slice(0, 3)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const googleTrends = require("google-trends-api");
      const raw = await Promise.race([
        googleTrends.relatedQueries({ keyword: kw, geo }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("relatedQueries timeout")), KEYWORD_TIMEOUT),
        ),
      ]);
      const data = JSON.parse(raw);
      const queryData = data.default?.rankedList ?? [];

      // Prefer "rising" queries (index 1) over "top" queries (index 0)
      const risingList = queryData[1]?.rankedKeyword ?? [];
      const topList = queryData[0]?.rankedKeyword ?? [];
      const queries = risingList.length > 0 ? risingList : topList;

      for (const q of queries.slice(0, 5)) {
        items.push({
          title: q.query ?? "",
          source: "google-keyword",
          description: `관련 키워드: ${kw} | 관심도: ${q.value ?? "N/A"}`,
          keyword: kw,
          rank: items.length + 1,
          fetchedAt: new Date(),
        });
      }

      // Delay between keywords to avoid rate limiting
      if (keywords.indexOf(kw) < keywords.slice(0, 3).length - 1) {
        await new Promise((resolve) => setTimeout(resolve, KEYWORD_DELAY));
      }
    } catch {
      // Skip this keyword, continue with others
    }
  }

  return items;
}
