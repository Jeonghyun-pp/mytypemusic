import { fetchHtml } from "../article/fetchHtml.js";
import { extractMainTextFromHtml } from "../article/extractText.js";
import { sanitizePlainText } from "../article/sanitize.js";
import { saveJson } from "../../io/save.js";
import type { NormalizedArticle } from "./normalize.js";

// ============================================================================
// Types
// ============================================================================

export type UrlFetchResult = {
  title: string;
  textLength: number;
};

// ============================================================================
// Main
// ============================================================================

/**
 * Fetch a single URL, extract its article text, and save as a signal-format
 * JSON file that can be merged with other signal sources.
 *
 * The output shape matches what `loadExternalArticles()` expects:
 * `{ articles: NormalizedArticle[] }`
 */
export async function fetchUrlAsArticle(params: {
  url: string;
  outPath: string;
}): Promise<UrlFetchResult> {
  const { url, outPath } = params;

  // 1. Fetch HTML
  const html = await fetchHtml(url, { timeoutMs: 15_000 });

  // 2. Extract main text
  const extracted = extractMainTextFromHtml(html, url);
  const title = extracted.title ?? new URL(url).hostname;

  // 3. Sanitize
  const sanitized = sanitizePlainText(extracted.text);

  // 4. Build NormalizedArticle
  const domain = new URL(url).hostname.replace(/^www\./, "");
  const snippet = sanitized.text.slice(0, 300);

  const article: NormalizedArticle = {
    title,
    url,
    publishedAt: new Date().toISOString(),
    publisher: domain,
    snippet,
    feedId: "url-input",
    feedTitle: "User URL Input",
  };

  // 5. Save as signal-format JSON
  await saveJson(outPath, { articles: [article] });

  return { title, textLength: sanitized.length };
}
