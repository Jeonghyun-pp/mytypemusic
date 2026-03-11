/**
 * Web Search module for Research Agent.
 *
 * Supports multiple providers with automatic fallback:
 *   1. Brave Search API (BRAVE_SEARCH_API_KEY) — 2,000 free/month
 *   2. Tavily Search API (TAVILY_API_KEY) — 1,000 free/month
 *   3. Naver Search API (NAVER_CLIENT_ID) — existing, fallback
 *
 * Returns normalized WebSource[] regardless of provider.
 */

import { fetchWithTimeout } from "@/lib/fetch-utils";

export interface WebSource {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  provider: string;
}

/**
 * Search the web for a query. Tries available providers in priority order.
 */
export async function webSearch(
  query: string,
  opts?: { limit?: number; freshness?: "day" | "week" | "month" },
): Promise<WebSource[]> {
  const limit = opts?.limit ?? 5;

  // Try providers in priority order
  const providers = [searchBrave, searchTavily, searchNaver];

  for (const provider of providers) {
    try {
      const results = await provider(query, limit, opts?.freshness);
      if (results.length > 0) return results;
    } catch {
      // Try next provider
    }
  }

  return [];
}

// ── Brave Search ───────────────────────────────────────

async function searchBrave(
  query: string,
  limit: number,
  freshness?: string,
): Promise<WebSource[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    q: query,
    count: String(limit),
    text_decorations: "false",
    search_lang: "ko",
  });
  if (freshness) params.set("freshness", freshness === "day" ? "pd" : freshness === "week" ? "pw" : "pm");

  const res = await fetchWithTimeout(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
    timeout: 15_000,
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    web?: {
      results?: Array<{
        title: string;
        url: string;
        description: string;
        page_age?: string;
      }>;
    };
  };

  return (data.web?.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
    publishedDate: r.page_age,
    provider: "brave",
  }));
}

// ── Tavily Search ──────────────────────────────────────

async function searchTavily(
  query: string,
  limit: number,
  freshness?: string,
): Promise<WebSource[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const days = freshness === "day" ? 1 : freshness === "week" ? 7 : freshness === "month" ? 30 : undefined;

  const res = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: limit,
      search_depth: "basic",
      include_answer: false,
      ...(days ? { days } : {}),
    }),
    timeout: 15_000,
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    results?: Array<{
      title: string;
      url: string;
      content: string;
      published_date?: string;
    }>;
  };

  return (data.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content.slice(0, 300),
    publishedDate: r.published_date,
    provider: "tavily",
  }));
}

// ── Naver Search (fallback, already have keys) ─────────

async function searchNaver(
  query: string,
  limit: number,
): Promise<WebSource[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  const res = await fetchWithTimeout(
    `https://openapi.naver.com/v1/search/webkr.json?query=${encodeURIComponent(query)}&display=${limit}&sort=date`,
    {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
      timeout: 15_000,
    },
  );

  if (!res.ok) return [];

  const data = (await res.json()) as {
    items?: Array<{
      title: string;
      link: string;
      description: string;
    }>;
  };

  return (data.items ?? []).map((r) => ({
    title: stripHtml(r.title),
    url: r.link,
    snippet: stripHtml(r.description),
    provider: "naver",
  }));
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ").trim();
}
