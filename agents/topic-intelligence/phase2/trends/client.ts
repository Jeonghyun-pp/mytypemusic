// ============================================================================
// Types
// ============================================================================

export type TrendsTimeframe =
  | "now 1-d"
  | "now 7-d"
  | "today 1-m"
  | "today 3-m";

export type TrendsQueryOptions = {
  geo: "KR";
  timeframe: TrendsTimeframe;
};

export type TrendsSeed = {
  keyword: string;
  source: "dailyTrends" | "realTimeTrends" | "relatedQueries";
  traffic?: number;
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse traffic string like "200,000+", "1,000+", "50K+" into a number.
 */
function parseTraffic(raw: string): number | undefined {
  const cleaned = raw.replace(/[+,\s]/g, "").trim();

  // "200K" → 200000
  const kMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*[Kk]$/);
  if (kMatch?.[1]) return Math.round(parseFloat(kMatch[1]) * 1_000);

  // "1M" → 1000000
  const mMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*[Mm]$/);
  if (mMatch?.[1]) return Math.round(parseFloat(mMatch[1]) * 1_000_000);

  // Plain number
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? undefined : num;
}

/** Deduplicate seeds by keyword (case-sensitive exact match). */
function dedupeSeeds(seeds: TrendsSeed[]): TrendsSeed[] {
  const seen = new Set<string>();
  const result: TrendsSeed[] = [];

  for (const s of seeds) {
    if (seen.has(s.keyword)) continue;
    seen.add(s.keyword);
    result.push(s);
  }

  return result;
}

/**
 * Simple XML tag content extractor.
 * Returns the text content of the first occurrence of <tag>...</tag>.
 */
function extractTag(xml: string, tag: string): string | undefined {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = xml.indexOf(open);
  if (start === -1) return undefined;
  const contentStart = start + open.length;
  const end = xml.indexOf(close, contentStart);
  if (end === -1) return undefined;
  return xml.slice(contentStart, end).trim();
}

/**
 * Split XML string into items by <item>...</item> tags.
 */
function splitItems(xml: string): string[] {
  const items: string[] = [];
  let pos = 0;

  while (true) {
    const start = xml.indexOf("<item>", pos);
    if (start === -1) break;
    const end = xml.indexOf("</item>", start);
    if (end === -1) break;
    items.push(xml.slice(start, end + "</item>".length));
    pos = end + "</item>".length;
  }

  return items;
}

// ============================================================================
// Daily Trends (via public RSS endpoint)
// ============================================================================

const DAILY_TRENDS_URL = "https://trends.google.com/trending/rss?geo=KR";

async function fetchDailyTrendsRSS(): Promise<TrendsSeed[]> {
  const response = await fetch(DAILY_TRENDS_URL);

  if (!response.ok) {
    throw new Error(
      `Daily Trends RSS failed: HTTP ${String(response.status)}`,
    );
  }

  const xml = await response.text();

  if (!xml.includes("<item>")) {
    throw new Error("Daily Trends RSS returned no items.");
  }

  const items = splitItems(xml);
  const seeds: TrendsSeed[] = [];

  for (const item of items) {
    const title = extractTag(item, "title");
    if (!title || title.length === 0) continue;

    const trafficStr = extractTag(item, "ht:approx_traffic");
    const traffic = trafficStr ? parseTraffic(trafficStr) : undefined;

    seeds.push({
      keyword: title,
      source: "dailyTrends",
      traffic,
    });
  }

  return seeds;
}

// ============================================================================
// Related Queries (via google-trends-api library)
// ============================================================================

/**
 * Fetch related queries for a set of seed keywords.
 * Uses the google-trends-api library (which works for this endpoint).
 */
async function fetchRelatedQueries(
  seedKeywords: string[],
): Promise<TrendsSeed[]> {
  // Dynamic import for the CJS module
  const googleTrends = await import("google-trends-api");

  const seeds: TrendsSeed[] = [];

  // Limit to first 3 seeds to avoid rate limiting
  const limitedSeeds = seedKeywords.slice(0, 3);

  for (const kw of limitedSeeds) {
    try {
      const raw = await googleTrends.relatedQueries({
        keyword: kw,
        geo: "KR",
      });
      const parsed = JSON.parse(raw) as {
        default?: {
          rankedList?: Array<{
            rankedKeyword?: Array<{
              query?: string;
              value?: number;
            }>;
          }>;
        };
      };

      const lists = parsed.default?.rankedList ?? [];
      for (const list of lists) {
        const keywords = list.rankedKeyword ?? [];
        for (const entry of keywords) {
          if (entry.query && entry.query.trim().length > 0) {
            seeds.push({
              keyword: entry.query.trim(),
              source: "relatedQueries",
              traffic: entry.value,
            });
          }
        }
      }
    } catch {
      // Skip individual keyword failures
      continue;
    }
  }

  return seeds;
}

// ============================================================================
// Main
// ============================================================================

/**
 * Fetch trending seeds from Google Trends KR.
 *
 * Strategy:
 * 1) Fetch daily trends via public RSS (reliable)
 * 2) Use top daily trends as seed for relatedQueries (library)
 * 3) Combine and deduplicate
 *
 * Throws if daily trends fails entirely.
 */
export async function fetchTrendsSeeds(
  _opts?: Partial<TrendsQueryOptions>,
): Promise<TrendsSeed[]> {
  // 1) Fetch daily trends RSS
  const dailySeeds = await fetchDailyTrendsRSS();

  // 2) Try to expand with related queries from top daily seeds
  let relatedSeeds: TrendsSeed[] = [];
  if (dailySeeds.length > 0) {
    const topKeywords = dailySeeds.slice(0, 3).map((s) => s.keyword);
    try {
      relatedSeeds = await fetchRelatedQueries(topKeywords);
    } catch {
      // Related queries are optional enhancement
    }
  }

  // 3) Combine and deduplicate
  return dedupeSeeds([...dailySeeds, ...relatedSeeds]);
}
