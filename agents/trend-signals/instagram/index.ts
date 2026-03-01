import type { NormalizedArticle } from "../contracts.js";
import { getInstagramToken, getInstagramUserId, LIMITS } from "./config.js";
import { searchHashtagId, getHashtagMedia, type MediaEdge } from "./hashtag.js";
import { normalizeMediaNodes } from "./normalize.js";

// ============================================================================
// Hashtag search counter (in-memory, per-process)
// ============================================================================

let hashtagSearchCount = 0;

export function getHashtagSearchCount(): number {
  return hashtagSearchCount;
}

export function resetHashtagSearchCount(): void {
  hashtagSearchCount = 0;
}

// ============================================================================
// Main pipeline
// ============================================================================

export interface CollectInstagramOptions {
  /** Which edges to pull. Default: ["top_media"] */
  edges?: MediaEdge[];
  /** Override access token (e.g. freshly refreshed). */
  token?: string;
  /** Override user ID. */
  userId?: string;
}

export interface CollectInstagramResult {
  articles: NormalizedArticle[];
  hashtagId: string;
  hashtagSearchesUsed: number;
  errors: string[];
}

/**
 * Full Instagram hashtag collection pipeline:
 *   1. ig_hashtag_search → hashtagId  (counts toward 30/week limit)
 *   2. top_media / recent_media → IgMediaNode[]
 *   3. normalize → NormalizedArticle[]
 */
export async function collectInstagramSignals(
  hashtag: string,
  opts?: CollectInstagramOptions,
): Promise<CollectInstagramResult> {
  const token = opts?.token ?? getInstagramToken();
  const userId = opts?.userId ?? getInstagramUserId();
  const edges: MediaEdge[] = opts?.edges ?? ["top_media"];
  const errors: string[] = [];

  // Warn if approaching weekly limit
  if (hashtagSearchCount >= LIMITS.HASHTAG_SEARCHES_PER_WEEK - 1) {
    errors.push(
      `Hashtag search limit warning: ${String(hashtagSearchCount)}/${String(LIMITS.HASHTAG_SEARCHES_PER_WEEK)} used this process. IG enforces 30/week.`,
    );
  }

  // Step 1: Hashtag ID lookup
  const hashtagId = await searchHashtagId(hashtag, userId, token);
  hashtagSearchCount += 1;

  // Step 2: Fetch media from requested edges
  const allNodes: Awaited<ReturnType<typeof getHashtagMedia>> = [];

  for (const edge of edges) {
    try {
      const nodes = await getHashtagMedia(hashtagId, edge, userId, token);
      allNodes.push(...nodes);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${edge} fetch failed: ${msg}`);
    }
  }

  if (allNodes.length === 0 && errors.length > 0) {
    return {
      articles: [],
      hashtagId,
      hashtagSearchesUsed: hashtagSearchCount,
      errors,
    };
  }

  // Dedupe by media ID (top_media and recent_media may overlap)
  const seen = new Set<string>();
  const deduped = allNodes.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  // Step 3: Normalize
  const articles = normalizeMediaNodes(deduped);

  return {
    articles,
    hashtagId,
    hashtagSearchesUsed: hashtagSearchCount,
    errors,
  };
}
