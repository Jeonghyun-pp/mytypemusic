import { nowIso } from "../../utils/time.js";
import { getArticleCachePath } from "../../io/paths.js";
import { saveJson } from "../../io/save.js";
import { fetchHtml } from "./fetchHtml.js";
import { extractMainTextFromHtml } from "./extractText.js";
import { sanitizePlainText } from "./sanitize.js";

// ============================================================================
// Types
// ============================================================================

export type ArticleCache = {
  idx: number;
  url: string;
  titleFromFeed?: string;
  fetchedAt: string;
  ok: boolean;
  status: "fetched" | "skipped" | "error";
  error?: { message: string };
  extractor?: {
    method: "readability" | "fallback";
    extractedTitle?: string;
    textLength: number;
  };
  content?: {
    text: string;
    length: number;
  };
};

// ============================================================================
// Main
// ============================================================================

/**
 * Fetch, extract, sanitize, and cache a single article.
 *
 * - fetchHtml → extractMainTextFromHtml → sanitizePlainText
 * - Saves result to articles/article.<idx>.json
 * - Never throws: errors are captured in the returned ArticleCache
 */
export async function buildAndSaveArticleCache(params: {
  topicId: string;
  idx: number;
  url: string;
  titleFromFeed?: string;
}): Promise<ArticleCache> {
  const { topicId, idx, url, titleFromFeed } = params;
  const fetchedAt = nowIso();

  try {
    // 1) Fetch HTML
    const html = await fetchHtml(url);

    // 2) Extract main text
    const extracted = extractMainTextFromHtml(html, url);

    // 3) Sanitize
    const sanitized = sanitizePlainText(extracted.text);

    // 4) Build cache entry
    const cache: ArticleCache = {
      idx,
      url,
      titleFromFeed,
      fetchedAt,
      ok: sanitized.length >= 400,
      status: "fetched",
      extractor: {
        method: extracted.method,
        extractedTitle: extracted.title,
        textLength: sanitized.length,
      },
      content: {
        text: sanitized.text,
        length: sanitized.length,
      },
    };

    // 5) Save
    const cachePath = getArticleCachePath(topicId, idx);
    await saveJson(cachePath, cache);

    return cache;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);

    const cache: ArticleCache = {
      idx,
      url,
      titleFromFeed,
      fetchedAt,
      ok: false,
      status: "error",
      error: { message },
    };

    // Save error cache too
    const cachePath = getArticleCachePath(topicId, idx);
    await saveJson(cachePath, cache);

    return cache;
  }
}
