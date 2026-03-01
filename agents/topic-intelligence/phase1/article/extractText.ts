import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

// ============================================================================
// Types
// ============================================================================

export type ExtractTextResult = {
  method: "readability" | "fallback";
  title?: string;
  text: string;
};

// ============================================================================
// Fallback extractor
// ============================================================================

/**
 * Simple tag-stripping fallback extractor.
 * Removes script/style/noscript blocks, then strips all HTML tags.
 */
function fallbackExtract(html: string): string {
  let text = html;

  // Remove script, style, noscript blocks
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

  // Extract body content if present
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(text);
  if (bodyMatch?.[1]) {
    text = bodyMatch[1];
  }

  // Strip all HTML tags
  text = text.replace(/<[^>]*>/g, " ");

  return text;
}

// ============================================================================
// Main
// ============================================================================

/**
 * Extract main text content from raw HTML.
 *
 * 1. Try @mozilla/readability via JSDOM
 * 2. Fallback to tag-stripping if readability fails
 */
export function extractMainTextFromHtml(
  html: string,
  url: string,
): ExtractTextResult {
  // Try Readability
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article && article.textContent && article.textContent.trim().length > 0) {
      return {
        method: "readability",
        title: article.title || undefined,
        text: article.textContent,
      };
    }
  } catch {
    // Readability failed, fall through to fallback
  }

  // Fallback
  const text = fallbackExtract(html);

  // Try to extract title from <title> tag
  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  const title = titleMatch?.[1]?.trim() || undefined;

  return {
    method: "fallback",
    title,
    text,
  };
}
