import type { NormalizedArticle } from "../contracts.js";

// ============================================================================
// YouTube normalization
// ============================================================================

/** Shape of a YouTube search result item (search.list + videos.list merged). */
export interface YouTubeVideoRaw {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string; // ISO datetime
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

export function normalizeYouTubeVideo(raw: YouTubeVideoRaw): NormalizedArticle {
  return {
    title: raw.title,
    url: `https://www.youtube.com/watch?v=${raw.videoId}`,
    publishedAt: raw.publishedAt,
    publisher: raw.channelTitle,
    snippet: raw.description.slice(0, 300) || undefined,
    feedId: "youtube-search",
    feedTitle: "YouTube Search",
    sourceType: "youtube",
    metrics:
      raw.viewCount != null || raw.likeCount != null || raw.commentCount != null
        ? {
            views: raw.viewCount,
            likes: raw.likeCount,
            comments: raw.commentCount,
          }
        : undefined,
  };
}

// ============================================================================
// Instagram normalization
// ============================================================================

/** Shape of an Instagram media object from Graph API. */
export interface InstagramMediaRaw {
  id: string;
  caption?: string;
  permalink: string;
  timestamp: string; // ISO datetime
  username?: string;
  likeCount?: number;
  commentsCount?: number;
}

export function normalizeInstagramMedia(raw: InstagramMediaRaw): NormalizedArticle {
  const captionLines = (raw.caption ?? "").split("\n");
  const title = (captionLines[0] ?? "").slice(0, 100) || `Instagram ${raw.id}`;

  return {
    title,
    url: raw.permalink,
    publishedAt: raw.timestamp,
    publisher: raw.username,
    snippet: (raw.caption ?? "").slice(0, 300) || undefined,
    feedId: "instagram-hashtag",
    feedTitle: "Instagram Hashtag",
    sourceType: "instagram",
    metrics:
      raw.likeCount != null || raw.commentsCount != null
        ? {
            likes: raw.likeCount,
            comments: raw.commentsCount,
          }
        : undefined,
  };
}
