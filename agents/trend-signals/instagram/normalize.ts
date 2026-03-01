import type { NormalizedArticle } from "../contracts.js";
import {
  normalizeInstagramMedia,
  type InstagramMediaRaw,
} from "../shared/normalize.js";
import type { IgMediaNode } from "./hashtag.js";

/**
 * Convert Graph API media nodes into the shared NormalizedArticle format.
 *
 * - Skips nodes that lack both permalink and id (unusable).
 * - Maps IgMediaNode fields to InstagramMediaRaw expected by shared normalizer.
 */
export function normalizeMediaNodes(
  nodes: IgMediaNode[],
): NormalizedArticle[] {
  return nodes
    .filter((n) => n.permalink ?? n.id)
    .map((n): InstagramMediaRaw => ({
      id: n.id,
      caption: n.caption,
      permalink: n.permalink ?? `https://www.instagram.com/p/${n.id}`,
      timestamp: n.timestamp ?? new Date().toISOString(),
      username: n.username,
      likeCount: n.like_count,
      commentsCount: n.comments_count,
    }))
    .map(normalizeInstagramMedia);
}
