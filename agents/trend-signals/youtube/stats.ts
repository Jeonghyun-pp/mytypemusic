import { getYouTubeApiKey, YT_API_BASE } from "./config.js";

// ============================================================================
// Types
// ============================================================================

export interface VideoStats {
  videoId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

interface YouTubeVideosResponse {
  items?: Array<{
    id?: string;
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
}

// ============================================================================
// videos.list — fetch statistics for a batch of video IDs
// ============================================================================

/**
 * Fetch statistics for up to 50 video IDs in a single API call.
 *
 * Quota cost: 1 unit per call (regardless of how many IDs).
 */
export async function fetchVideoStats(videoIds: string[]): Promise<VideoStats[]> {
  if (videoIds.length === 0) return [];
  if (videoIds.length > 50) {
    throw new Error(`fetchVideoStats: max 50 IDs per call, got ${String(videoIds.length)}`);
  }

  const apiKey = getYouTubeApiKey();
  const params = new URLSearchParams({
    part: "statistics",
    id: videoIds.join(","),
    key: apiKey,
  });

  const url = `${YT_API_BASE}/videos?${params.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `YouTube videos.list failed: HTTP ${String(res.status)} — ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as YouTubeVideosResponse;
  const results: VideoStats[] = [];

  for (const item of data.items ?? []) {
    if (!item.id || !item.statistics) continue;

    results.push({
      videoId: item.id,
      viewCount: parseInt(item.statistics.viewCount ?? "0", 10),
      likeCount: parseInt(item.statistics.likeCount ?? "0", 10),
      commentCount: parseInt(item.statistics.commentCount ?? "0", 10),
    });
  }

  return results;
}
