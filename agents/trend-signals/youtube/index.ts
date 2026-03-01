import type { NormalizedArticle } from "../contracts.js";
import { searchVideos, type SearchOptions } from "./client.js";
import { fetchVideoStats, type VideoStats } from "./stats.js";
import { mergeAndNormalize } from "./normalize.js";
import { QUOTA } from "./config.js";

// ============================================================================
// Quota tracker (in-memory, per-process)
// ============================================================================

let quotaUsed = 0;

export function getQuotaUsed(): number {
  return quotaUsed;
}

export function resetQuota(): void {
  quotaUsed = 0;
}

// ============================================================================
// Main pipeline
// ============================================================================

export interface CollectYouTubeOptions {
  maxResults?: number;   // default 10
  regionCode?: string;   // default "KR"
  order?: "relevance" | "date" | "viewCount";
  skipStats?: boolean;   // default false; set true to save quota
}

export interface CollectYouTubeResult {
  articles: NormalizedArticle[];
  quotaConsumed: number;
  errors: string[];
}

/**
 * Full YouTube collection pipeline:
 *   1. search.list → videoIds + snippets  (100 units)
 *   2. videos.list → statistics           (1 unit)
 *   3. merge + normalize → NormalizedArticle[]
 */
export async function collectYouTubeSignals(
  keyword: string,
  opts?: CollectYouTubeOptions,
): Promise<CollectYouTubeResult> {
  const errors: string[] = [];
  let consumed = 0;

  // Step 1: Search
  const searchOpts: SearchOptions = {
    maxResults: opts?.maxResults ?? 10,
    regionCode: opts?.regionCode ?? "KR",
    order: opts?.order ?? "relevance",
  };

  const searchItems = await searchVideos(keyword, searchOpts);
  consumed += QUOTA.SEARCH_LIST;

  if (searchItems.length === 0) {
    quotaUsed += consumed;
    return { articles: [], quotaConsumed: consumed, errors: ["No search results"] };
  }

  // Step 2: Stats (optional)
  const statsMap = new Map<string, VideoStats>();

  if (!opts?.skipStats) {
    try {
      const videoIds = searchItems.map((item) => item.videoId);
      const stats = await fetchVideoStats(videoIds);
      consumed += QUOTA.VIDEOS_LIST;

      for (const s of stats) {
        statsMap.set(s.videoId, s);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Stats fetch failed: ${msg}`);
      // Continue without stats — articles will have no metrics
    }
  }

  // Step 3: Merge + normalize
  const articles = mergeAndNormalize(searchItems, statsMap);

  quotaUsed += consumed;

  // Warn if approaching daily limit
  if (quotaUsed > QUOTA.DAILY_LIMIT * 0.8) {
    errors.push(
      `Quota warning: ${String(quotaUsed)}/${String(QUOTA.DAILY_LIMIT)} units used (${String(Math.round((quotaUsed / QUOTA.DAILY_LIMIT) * 100))}%)`,
    );
  }

  return { articles, quotaConsumed: consumed, errors };
}
