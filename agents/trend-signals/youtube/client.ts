import { getYouTubeApiKey, YT_API_BASE } from "./config.js";

// ============================================================================
// Types — raw API response shapes
// ============================================================================

export interface SearchItem {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
}

interface YouTubeSearchResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      publishedAt?: string;
    };
  }>;
  pageInfo?: { totalResults?: number };
}

// ============================================================================
// search.list — keyword search for videos
// ============================================================================

export interface SearchOptions {
  maxResults?: number;   // 1-50, default 10
  regionCode?: string;   // e.g. "KR"
  order?: "relevance" | "date" | "viewCount";
}

/**
 * Search YouTube for videos matching a keyword.
 *
 * Quota cost: 100 units per call.
 * Returns: array of SearchItem (videoId + snippet fields).
 */
export async function searchVideos(
  keyword: string,
  opts?: SearchOptions,
): Promise<SearchItem[]> {
  const apiKey = getYouTubeApiKey();
  const maxResults = opts?.maxResults ?? 10;
  const regionCode = opts?.regionCode ?? "KR";
  const order = opts?.order ?? "relevance";

  const params = new URLSearchParams({
    part: "snippet",
    q: keyword,
    type: "video",
    maxResults: String(maxResults),
    regionCode,
    order,
    key: apiKey,
  });

  const url = `${YT_API_BASE}/search?${params.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `YouTube search.list failed: HTTP ${String(res.status)} — ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as YouTubeSearchResponse;
  const items: SearchItem[] = [];

  for (const item of data.items ?? []) {
    const videoId = item.id?.videoId;
    const snippet = item.snippet;
    if (!videoId || !snippet?.title) continue;

    items.push({
      videoId,
      title: snippet.title,
      description: snippet.description ?? "",
      channelTitle: snippet.channelTitle ?? "",
      publishedAt: snippet.publishedAt ?? "",
    });
  }

  return items;
}
