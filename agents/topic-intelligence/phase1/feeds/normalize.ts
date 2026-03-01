import { XMLParser } from "fast-xml-parser";
import type { FeedDef } from "./feeds.kr.js";

// ============================================================================
// Types
// ============================================================================

export type SourceType = "rss" | "news-rss" | "naver-news" | "youtube" | "instagram";

export type MetricsBlock = {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
};

export type NormalizedArticle = {
  title: string;
  url: string;
  publishedAt?: string;
  publisher?: string;
  snippet?: string;
  feedId: string;
  feedTitle: string;
  sourceType?: SourceType;
  metrics?: MetricsBlock;
};

export type ParseFeedResult = {
  feedId: string;
  items: NormalizedArticle[];
  rawCount: number;
};

// ============================================================================
// Helpers
// ============================================================================

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (_name, jpath) => {
    // Ensure item/entry are always arrays
    return jpath === "rss.channel.item" || jpath === "feed.entry";
  },
});

/** Strip HTML tags from a string. */
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}

/** Safely coerce a value to a trimmed string, or return undefined. */
function str(val: unknown): string | undefined {
  if (val == null) return undefined;
  if (typeof val === "string") return val.trim() || undefined;
  if (typeof val === "object" && "#text" in (val as Record<string, unknown>)) {
    const t = (val as Record<string, unknown>)["#text"];
    return typeof t === "string" ? t.trim() || undefined : undefined;
  }
  return String(val).trim() || undefined;
}

/** Extract a usable link URL from various RSS/Atom link shapes. */
function extractLink(link: unknown): string | undefined {
  if (typeof link === "string") return link.trim() || undefined;

  // Atom: link as object with @_href
  if (link && typeof link === "object") {
    const obj = link as Record<string, unknown>;
    if (typeof obj["@_href"] === "string") return obj["@_href"].trim() || undefined;
    if (typeof obj.href === "string") return obj.href.trim() || undefined;

    // Array of link objects (Atom can have multiple)
    if (Array.isArray(link)) {
      for (const l of link) {
        const href = extractLink(l);
        if (href) return href;
      }
    }
  }

  return undefined;
}

/** Try to parse a date string to ISO. Returns undefined on failure. */
function toIso(val: unknown): string | undefined {
  const s = str(val);
  if (!s) return undefined;
  const d = new Date(s);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/** Extract publisher/author from an item. */
function extractPublisher(item: Record<string, unknown>, fallback?: string): string | undefined {
  // dc:creator (common in RSS)
  const dc = str(item["dc:creator"]);
  if (dc) return dc;

  // author (Atom or RSS extensions)
  const author = item.author;
  if (typeof author === "string") return author.trim() || undefined;
  if (author && typeof author === "object") {
    const name = str((author as Record<string, unknown>).name);
    if (name) return name;
  }

  return fallback;
}

/** Extract snippet from description/summary/content. */
function extractSnippet(item: Record<string, unknown>): string | undefined {
  const raw = str(item.description) ?? str(item.summary) ?? str(item.content);
  if (!raw) return undefined;
  return stripHtml(raw).slice(0, 300) || undefined;
}

// ============================================================================
// Main parser
// ============================================================================

/**
 * Parse an RSS/Atom XML string and normalize items to NormalizedArticle[].
 *
 * Handles:
 *  - RSS 2.0: rss.channel.item[]
 *  - Atom:    feed.entry[]
 */
export function parseAndNormalizeFeedXml(
  xml: string,
  feed: FeedDef,
): ParseFeedResult {
  const doc = parser.parse(xml) as Record<string, unknown>;

  let rawItems: unknown[];

  // RSS path
  const rss = doc.rss as Record<string, unknown> | undefined;
  if (rss) {
    const channel = rss.channel as Record<string, unknown> | undefined;
    const items = channel?.item;
    rawItems = Array.isArray(items) ? items : items ? [items] : [];
  }
  // Atom path
  else if (doc.feed) {
    const atomFeed = doc.feed as Record<string, unknown>;
    const entries = atomFeed.entry;
    rawItems = Array.isArray(entries) ? entries : entries ? [entries] : [];
  }
  // RDF/RSS 1.0 path
  else if (doc["rdf:RDF"] || doc["RDF"]) {
    const rdf = (doc["rdf:RDF"] ?? doc["RDF"]) as Record<string, unknown>;
    const items = rdf.item;
    rawItems = Array.isArray(items) ? items : items ? [items] : [];
  } else {
    rawItems = [];
  }

  const rawCount = rawItems.length;
  const articles: NormalizedArticle[] = [];

  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;

    const title = str(item.title);
    if (!title) continue;

    const url = extractLink(item.link) ?? extractLink(item.guid);
    if (!url) continue;

    articles.push({
      title,
      url,
      publishedAt: toIso(item.pubDate) ?? toIso(item.updated) ?? toIso(item.published),
      publisher: extractPublisher(item, feed.publisher),
      snippet: extractSnippet(item),
      feedId: feed.id,
      feedTitle: feed.title,
      sourceType: "rss",
    });
  }

  return { feedId: feed.id, items: articles, rawCount };
}
