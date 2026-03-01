import { fetchFeedXml, type FetchFeedOptions } from "./fetch.js";
import {
  parseAndNormalizeFeedXml,
  type NormalizedArticle,
} from "./normalize.js";
import type { FeedDef } from "./feeds.kr.js";

// ============================================================================
// Google News RSS — dynamic feed URL builder
// ============================================================================

export type GoogleNewsRegion = "KR" | "US" | "GLOBAL";

const REGION_PARAMS: Record<GoogleNewsRegion, { hl: string; gl: string; ceid: string }> = {
  KR: { hl: "ko", gl: "KR", ceid: "KR:ko" },
  US: { hl: "en", gl: "US", ceid: "US:en" },
  GLOBAL: { hl: "en", gl: "US", ceid: "US:en" },
};

/**
 * Build a Google News RSS search URL for a given keyword and region.
 *
 * Example output:
 *   https://news.google.com/rss/search?q=%EC%9D%B8%EB%94%94%EC%9D%8C%EC%95%85&hl=ko&gl=KR&ceid=KR:ko
 */
export function buildGoogleNewsUrl(keyword: string, region: GoogleNewsRegion = "KR"): string {
  const params = REGION_PARAMS[region];
  const q = encodeURIComponent(keyword.trim());
  return `https://news.google.com/rss/search?q=${q}&hl=${params.hl}&gl=${params.gl}&ceid=${params.ceid}`;
}

// ============================================================================
// Fetch + normalize
// ============================================================================

/**
 * Fetch Google News RSS for a keyword, normalize to NormalizedArticle[].
 *
 * Reuses the existing RSS fetch/parse pipeline.
 * All articles are tagged with sourceType: "news-rss".
 */
export async function fetchGoogleNewsFeed(
  keyword: string,
  region: GoogleNewsRegion = "KR",
  fetchOpts?: FetchFeedOptions,
): Promise<{ articles: NormalizedArticle[]; rawCount: number }> {
  const url = buildGoogleNewsUrl(keyword, region);

  const feedDef: FeedDef = {
    id: "google-news-dynamic",
    category: "music", // placeholder; will be overridden by caller's category context
    title: `Google News: ${keyword}`,
    url,
    publisher: "Google News",
  };

  const xml = await fetchFeedXml(url, fetchOpts);
  const result = parseAndNormalizeFeedXml(xml, feedDef);

  // Tag all articles with sourceType: "news-rss"
  const articles = result.items.map((a) => ({
    ...a,
    sourceType: "news-rss" as const,
  }));

  return { articles, rawCount: result.rawCount };
}
