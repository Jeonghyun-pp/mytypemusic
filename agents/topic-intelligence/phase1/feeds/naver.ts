import type { NormalizedArticle } from "./normalize.js";

// ============================================================================
// Types
// ============================================================================

export interface NaverSearchOptions {
  query: string;
  display?: number;    // 1-100, default 10
  start?: number;      // pagination offset, 1-based
  sort?: "date" | "sim"; // date=recency, sim=relevance
  timeoutMs?: number;
}

export interface NaverNewsItem {
  title: string;         // HTML-encoded with <b> tags
  originallink: string;  // original publisher URL
  link: string;          // Naver cache URL
  description: string;   // HTML-encoded snippet
  pubDate: string;       // RFC 2822 date string
}

export interface NaverSearchResult {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverNewsItem[];
}

// ============================================================================
// Helpers
// ============================================================================

const DEFAULT_TIMEOUT_MS = 8000;

/** Strip HTML tags from a string. */
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}

/** Decode common HTML entities. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/** Clean Naver API text: strip HTML tags then decode entities. */
function cleanNaverText(s: string): string {
  return decodeEntities(stripHtml(s));
}

/** Parse date string to ISO, returns undefined on failure. */
function toIso(dateStr: string): string | undefined {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Search Naver News API.
 *
 * Requires NAVER_CLIENT_ID and NAVER_CLIENT_SECRET env vars.
 * Docs: https://developers.naver.com/docs/serviceapi/search/news/news.md
 */
export async function searchNaverNews(
  opts: NaverSearchOptions,
): Promise<NaverSearchResult> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "NAVER_CLIENT_ID and NAVER_CLIENT_SECRET must be set in environment",
    );
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const params = new URLSearchParams({
    query: opts.query,
    display: String(opts.display ?? 100),
    start: String(opts.start ?? 1),
    sort: opts.sort ?? "date",
  });

  const url = `https://openapi.naver.com/v1/search/news.json?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Naver API error: HTTP ${String(res.status)} for query "${opts.query}" — ${body}`,
      );
    }

    return (await res.json()) as NaverSearchResult;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `Naver API timed out after ${String(timeoutMs)}ms for query "${opts.query}"`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// Normalizer
// ============================================================================

/**
 * Convert a Naver news item to a NormalizedArticle.
 *
 * Uses `originallink` (publisher URL) instead of `link` (Naver redirect).
 */
export function naverItemToArticle(
  item: NaverNewsItem,
  feedId: string,
  feedTitle: string,
): NormalizedArticle {
  const title = cleanNaverText(item.title);
  // Prefer originallink; fall back to link if empty
  const url = (item.originallink || item.link || "").trim();
  const snippet = cleanNaverText(item.description).slice(0, 300) || undefined;
  const publishedAt = toIso(item.pubDate);

  return {
    title,
    url,
    publishedAt,
    snippet,
    feedId,
    feedTitle,
    sourceType: "naver-news",
  };
}
