// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare function require(name: string): any;
import type { TrendProvider, TrendItem } from "./types";

/**
 * Google Trends daily trending searches via google-trends-api npm.
 * Free, no auth, but fragile (breaks 2-3x/year when Google changes frontend).
 * Used as a fallback — gracefully returns [] on failure.
 */
export const googleTrendsProvider: TrendProvider = {
  name: "google",
  async fetch(opts) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const googleTrends = require("google-trends-api");
      const raw = await googleTrends.dailyTrends({ geo: opts?.geo ?? "KR" });
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
  },
};
