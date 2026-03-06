import type { TrendProvider, TrendItem } from "./types";

const HN_API = "https://hacker-news.firebaseio.com/v0";

/**
 * HackerNews top stories — free, no auth, unlimited.
 * Good for global tech/startup trends.
 */
export const hackerNewsProvider: TrendProvider = {
  name: "hackernews",
  async fetch() {
    try {
      const idsRes = await fetch(`${HN_API}/topstories.json`);
      if (!idsRes.ok) return [];
      const ids: number[] = await idsRes.json();

      const stories = await Promise.all(
        ids.slice(0, 10).map(async (id) => {
          const res = await fetch(`${HN_API}/item/${id}.json`);
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
  },
};
