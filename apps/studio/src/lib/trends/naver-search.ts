import type { TrendProvider, TrendItem } from "./types";
import { fetchWithTimeout } from "@/lib/fetch-utils";

const NEWS_API = "https://openapi.naver.com/v1/search/news.json";
const BLOG_API = "https://openapi.naver.com/v1/search/blog.json";

interface NaverSearchResult {
  title: string;
  link: string;
  description: string;
}

/**
 * Naver News + Blog Search API.
 * Searches for recent news and blog posts matching the user's topicKeywords.
 * This is the "niche trend" layer — finding what's being discussed in the user's field.
 */
export const naverSearchProvider: TrendProvider = {
  name: "naver-search",
  async fetch(opts) {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    if (!clientId || !clientSecret) return [];

    const keywords = opts?.keywords ?? [];
    if (keywords.length === 0) return [];

    const headers = {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    };

    const items: TrendItem[] = [];
    const seen = new Set<string>();

    // Search news and blogs for each keyword
    for (const kw of keywords.slice(0, 3)) {
      const query = encodeURIComponent(kw);

      // News search — sorted by date, top 5
      try {
        const newsRes = await fetchWithTimeout(
          `${NEWS_API}?query=${query}&display=5&sort=date`,
          { headers, timeout: 8_000 },
        );
        if (newsRes.ok) {
          const data = (await newsRes.json()) as {
            items?: NaverSearchResult[];
          };
          for (const item of data.items ?? []) {
            const clean = stripHtml(item.title);
            if (seen.has(clean)) continue;
            seen.add(clean);
            items.push({
              title: clean,
              source: "naver-news",
              url: item.link,
              description: stripHtml(item.description).slice(0, 100),
              fetchedAt: new Date(),
            });
          }
        }
      } catch {
        /* skip */
      }

      // Blog search — sorted by date, top 3
      try {
        const blogRes = await fetchWithTimeout(
          `${BLOG_API}?query=${query}&display=3&sort=date`,
          { headers, timeout: 8_000 },
        );
        if (blogRes.ok) {
          const data = (await blogRes.json()) as {
            items?: NaverSearchResult[];
          };
          for (const item of data.items ?? []) {
            const clean = stripHtml(item.title);
            if (seen.has(clean)) continue;
            seen.add(clean);
            items.push({
              title: clean,
              source: "naver-blog",
              url: item.link,
              description: stripHtml(item.description).slice(0, 100),
              fetchedAt: new Date(),
            });
          }
        }
      } catch {
        /* skip */
      }
    }

    return items;
  },
};

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ").trim();
}
