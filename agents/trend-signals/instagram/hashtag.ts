import { IG_API_BASE } from "./config.js";

// ============================================================================
// Types
// ============================================================================

/** A single media node from top_media / recent_media edges. */
export interface IgMediaNode {
  id: string;
  caption?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  media_type?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  username?: string;
}

interface IgHashtagSearchResponse {
  data?: Array<{ id: string }>;
}

interface IgMediaEdgeResponse {
  data?: IgMediaNode[];
  paging?: { cursors?: { after?: string }; next?: string };
}

// ============================================================================
// Fields we request for each media node
// ============================================================================

const MEDIA_FIELDS = [
  "id",
  "caption",
  "permalink",
  "timestamp",
  "like_count",
  "comments_count",
  "media_type",
  "media_url",
  "username",
].join(",");

// ============================================================================
// Hashtag ID lookup
// ============================================================================

/**
 * Search for a hashtag and return its IG hashtag ID.
 *
 * Endpoint: GET /ig_hashtag_search
 *   ?user_id={userId}&q={tag}&access_token={token}
 *
 * This counts toward the 30-searches-per-7-days limit.
 */
export async function searchHashtagId(
  tag: string,
  userId: string,
  token: string,
): Promise<string> {
  // Strip leading '#' if present
  const cleanTag = tag.replace(/^#/, "");

  const params = new URLSearchParams({
    user_id: userId,
    q: cleanTag,
    access_token: token,
  });

  const url = `${IG_API_BASE}/ig_hashtag_search?${params.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Instagram hashtag search failed for "${cleanTag}": HTTP ${String(res.status)} — ${body.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as IgHashtagSearchResponse;

  if (!data.data?.[0]?.id) {
    throw new Error(
      `Instagram hashtag search: no result for "${cleanTag}"`,
    );
  }

  return data.data[0].id;
}

// ============================================================================
// Top media / Recent media
// ============================================================================

export type MediaEdge = "top_media" | "recent_media";

/**
 * Fetch media from a hashtag's top_media or recent_media edge.
 *
 * Endpoint: GET /{hashtagId}/{edge}
 *   ?user_id={userId}&fields={fields}&access_token={token}
 *
 * Returns up to 50 media nodes per call (API default).
 */
export async function getHashtagMedia(
  hashtagId: string,
  edge: MediaEdge,
  userId: string,
  token: string,
): Promise<IgMediaNode[]> {
  const params = new URLSearchParams({
    user_id: userId,
    fields: MEDIA_FIELDS,
    access_token: token,
  });

  const url = `${IG_API_BASE}/${hashtagId}/${edge}?${params.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Instagram ${edge} fetch failed: HTTP ${String(res.status)} — ${body.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as IgMediaEdgeResponse;
  return data.data ?? [];
}
