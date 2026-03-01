import type { NormalizedArticle } from "../contracts.js";
import type { SearchItem } from "./client.js";
import type { VideoStats } from "./stats.js";
import { normalizeYouTubeVideo } from "../shared/normalize.js";

/**
 * Merge search results with statistics and normalize to NormalizedArticle[].
 *
 * If stats are missing for a video (e.g. API error), metrics will be undefined.
 */
export function mergeAndNormalize(
  searchItems: SearchItem[],
  statsMap: Map<string, VideoStats>,
): NormalizedArticle[] {
  return searchItems.map((item) => {
    const stats = statsMap.get(item.videoId);
    return normalizeYouTubeVideo({
      videoId: item.videoId,
      title: item.title,
      description: item.description,
      channelTitle: item.channelTitle,
      publishedAt: item.publishedAt,
      viewCount: stats?.viewCount,
      likeCount: stats?.likeCount,
      commentCount: stats?.commentCount,
    });
  });
}
