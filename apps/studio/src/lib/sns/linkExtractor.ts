/**
 * URL content extraction utilities for BulkLinkToPost.
 * Reuses the same Readability + JSDOM approach from agents/topic-intelligence.
 */
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export interface ExtractedContent {
  url: string;
  title: string;
  text: string;
  excerpt: string;
  domain: string;
  success: boolean;
  error?: string;
}

/** Fetch HTML with timeout and size limit. */
async function fetchHtml(url: string, timeoutMs = 15_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "web-magazine-studio/1.0" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return text.slice(0, 2_000_000); // 2MB limit
  } finally {
    clearTimeout(timer);
  }
}

/** Extract main content from a single URL. */
export async function extractFromUrl(url: string): Promise<ExtractedContent> {
  const domain = new URL(url).hostname.replace(/^www\./, "");
  try {
    const html = await fetchHtml(url);
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article?.textContent?.trim()) {
      return {
        url,
        title: article.title || domain,
        text: article.textContent.trim(),
        excerpt: article.textContent.trim().slice(0, 300),
        domain,
        success: true,
      };
    }

    // Fallback: extract title and strip tags
    const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
    const stripped = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      url,
      title: titleMatch?.[1]?.trim() || domain,
      text: stripped.slice(0, 10_000),
      excerpt: stripped.slice(0, 300),
      domain,
      success: true,
    };
  } catch (e) {
    return {
      url,
      title: domain,
      text: "",
      excerpt: "",
      domain,
      success: false,
      error: String(e),
    };
  }
}

/** Extract content from multiple URLs in parallel. */
export async function extractFromUrls(
  urls: string[],
): Promise<ExtractedContent[]> {
  return Promise.all(urls.map(extractFromUrl));
}
