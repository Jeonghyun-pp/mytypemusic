import type { TrendProvider, TrendItem } from "./types";

const API = "https://www.googleapis.com/youtube/v3/videos";

/**
 * YouTube Data API v3 — Korean trending videos.
 * Requires YOUTUBE_API_KEY (free, 10K units/day).
 * Each call costs 1 quota unit.
 */
export const youtubeProvider: TrendProvider = {
  name: "youtube",
  async fetch(opts) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return [];

    const regionCode = opts?.geo ?? "KR";

    try {
      const url = `${API}?part=snippet&chart=mostPopular&regionCode=${regionCode}&maxResults=10&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return [];

      const data = (await res.json()) as {
        items?: Array<{
          id: string;
          snippet: {
            title: string;
            channelTitle: string;
            categoryId?: string;
          };
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
  },
};
