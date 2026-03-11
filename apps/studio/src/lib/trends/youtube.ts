import type { TrendProvider, TrendItem } from "./types";
import { fetchWithTimeout } from "@/lib/fetch-utils";

const VIDEOS_API = "https://www.googleapis.com/youtube/v3/videos";
const SEARCH_API = "https://www.googleapis.com/youtube/v3/search";

/**
 * YouTube Data API v3 — Korean trending + keyword search.
 * Requires YOUTUBE_API_KEY (free, 10K units/day).
 * - mostPopular: 1 unit per call
 * - search: 100 units per call (max 2 keywords to protect quota)
 */
export const youtubeProvider: TrendProvider = {
  name: "youtube",
  async fetch(opts) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return [];

    const geo = opts?.geo ?? "KR";
    const [popularItems, keywordItems] = await Promise.all([
      fetchMostPopular(apiKey, geo),
      fetchKeywordVideos(apiKey, geo, opts?.keywords ?? []),
    ]);

    return [...popularItems, ...deduplicateByVideoId(keywordItems, popularItems)];
  },
};

async function fetchMostPopular(apiKey: string, regionCode: string): Promise<TrendItem[]> {
  try {
    const url = `${VIDEOS_API}?part=snippet&chart=mostPopular&regionCode=${regionCode}&maxResults=10&key=${apiKey}`;
    const res = await fetchWithTimeout(url, { timeout: 10_000 });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        snippet: { title: string; channelTitle: string };
      }>;
    };

    return (data.items ?? []).map(
      (item, i): TrendItem => ({
        title: item.snippet.title,
        source: "youtube",
        url: `https://www.youtube.com/watch?v=${item.id}`,
        description: `채널: ${item.snippet.channelTitle}`,
        rank: i + 1,
        fetchedAt: new Date(),
      }),
    );
  } catch {
    return [];
  }
}

async function fetchKeywordVideos(
  apiKey: string,
  regionCode: string,
  keywords: string[],
): Promise<TrendItem[]> {
  if (keywords.length === 0) return [];

  const maxKeywords = Number(process.env.YOUTUBE_SEARCH_MAX_KEYWORDS) || 2;

  const results = await Promise.allSettled(
    keywords.slice(0, maxKeywords).map(async (kw) => {
      const url =
        `${SEARCH_API}?part=snippet&q=${encodeURIComponent(kw)}` +
        `&type=video&regionCode=${regionCode}&order=date&maxResults=5&key=${apiKey}`;
      const res = await fetchWithTimeout(url, { timeout: 10_000 });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        items?: Array<{
          id: { videoId: string };
          snippet: { title: string; channelTitle: string };
        }>;
      };

      return (data.items ?? []).map(
        (item, i): TrendItem => ({
          title: item.snippet.title,
          source: "youtube-search",
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          description: `채널: ${item.snippet.channelTitle}`,
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

/** Remove keyword results that duplicate a popular video (by video ID in URL). */
function deduplicateByVideoId(keywordItems: TrendItem[], popularItems: TrendItem[]): TrendItem[] {
  const popularIds = new Set(popularItems.map((item) => item.url));
  return keywordItems.filter((item) => !popularIds.has(item.url));
}
