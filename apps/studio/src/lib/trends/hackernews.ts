import type { TrendProvider, TrendItem } from "./types";
import { fetchWithTimeout } from "@/lib/fetch-utils";

const HN_API = "https://hacker-news.firebaseio.com/v0";
const HN_SEARCH_API = "https://hn.algolia.com/api/v1";

/**
 * HackerNews top stories + keyword search.
 * - Top stories: free, no auth, unlimited.
 * - Keyword search: Algolia HN API, free, no auth.
 */
export const hackerNewsProvider: TrendProvider = {
  name: "hackernews",
  async fetch(opts) {
    const [topItems, keywordItems] = await Promise.all([
      fetchTopStories(),
      fetchKeywordStories(opts?.keywords ?? []),
    ]);
    return [...topItems, ...keywordItems];
  },
};

async function fetchTopStories(): Promise<TrendItem[]> {
  try {
    const idsRes = await fetchWithTimeout(`${HN_API}/topstories.json`, { timeout: 8_000 });
    if (!idsRes.ok) return [];
    const ids: number[] = await idsRes.json();

    const stories = await Promise.all(
      ids.slice(0, 10).map(async (id) => {
        const res = await fetchWithTimeout(`${HN_API}/item/${id}.json`, { timeout: 8_000 });
        return res.json() as Promise<{
          title: string;
          url?: string;
          score: number;
        }>;
      }),
    );

    return stories.map(
      (s, i): TrendItem => ({
        title: s.title,
        source: "hackernews",
        url: s.url,
        rank: i + 1,
        fetchedAt: new Date(),
      }),
    );
  } catch {
    return [];
  }
}

async function fetchKeywordStories(keywords: string[]): Promise<TrendItem[]> {
  if (keywords.length === 0) return [];

  const results = await Promise.allSettled(
    keywords.slice(0, 3).map(async (kw) => {
      const url = `${HN_SEARCH_API}/search_by_date?query=${encodeURIComponent(kw)}&tags=story&hitsPerPage=5`;
      const res = await fetchWithTimeout(url, { timeout: 8_000 });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        hits?: Array<{
          title: string;
          url?: string;
          objectID: string;
          points: number | null;
          num_comments: number | null;
        }>;
      };

      return (data.hits ?? []).map(
        (hit, i): TrendItem => ({
          title: hit.title,
          source: "hackernews-search",
          url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
          description: `Points: ${hit.points ?? 0} | Comments: ${hit.num_comments ?? 0}`,
          keyword: kw,
          rank: i + 1,
          fetchedAt: new Date(),
        }),
      );
    }),
  );

  const items: TrendItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
  }
  return items;
}
