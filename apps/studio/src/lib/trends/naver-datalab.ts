import type { TrendProvider, TrendItem } from "./types";

const API = "https://openapi.naver.com/v1/datalab/search";

/**
 * Naver DataLab Search Trend API.
 * Returns relative search interest for given keywords over the last 7 days.
 * Requires NAVER_CLIENT_ID and NAVER_CLIENT_SECRET.
 */
export const naverDatalabProvider: TrendProvider = {
  name: "naver-datalab",
  async fetch(opts) {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    if (!clientId || !clientSecret) return [];

    const keywords = opts?.keywords ?? [];
    if (keywords.length === 0) return [];

    // DataLab requires keyword groups (max 5 groups, max 20 keywords each)
    const groups = keywords.slice(0, 5).map((kw) => ({
      groupName: kw,
      keywords: [kw],
    }));

    const endDate = new Date();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
        body: JSON.stringify({
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          timeUnit: "date",
          keywordGroups: groups,
        }),
      });

      if (!res.ok) return [];
      const data = (await res.json()) as {
        results?: Array<{
          title: string;
          data?: Array<{ period: string; ratio: number }>;
        }>;
      };

      const items: TrendItem[] = [];
      for (const result of data.results ?? []) {
        // Get the latest ratio as a proxy for current interest
        const latest = result.data?.at(-1);
        items.push({
          title: result.title,
          source: "naver-datalab",
          description: latest ? `검색 관심도: ${latest.ratio.toFixed(0)}` : undefined,
          rank: items.length + 1,
          fetchedAt: new Date(),
        });
      }
      return items;
    } catch {
      return [];
    }
  },
};

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
