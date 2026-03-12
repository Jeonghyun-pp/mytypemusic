/**
 * Instagram Business Discovery API client.
 *
 * Uses our own IG Business account (INSTAGRAM_USER_ID + INSTAGRAM_ACCESS_TOKEN)
 * to query other public Business/Creator accounts via the Business Discovery edge.
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-discovery
 */

import { fetchWithTimeout } from "@/lib/fetch-utils";

const API = "https://graph.facebook.com/v21.0";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveryProfile {
  id: string;
  username: string;
  name: string;
  profilePictureUrl: string;
  followersCount: number;
  mediaCount: number;
}

export interface DiscoveryMedia {
  id: string;
  mediaType: string; // IMAGE, VIDEO, CAROUSEL_ALBUM
  caption?: string;
  permalink: string;
  thumbnailUrl?: string;
  likeCount: number;
  commentsCount: number;
  timestamp: string; // ISO date string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCredentials(): { userId: string; token: string } | null {
  const userId = process.env.INSTAGRAM_USER_ID;
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!userId || !token) return null;
  return { userId, token };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch a public Business/Creator account's profile via Business Discovery.
 */
export async function discoverProfile(
  username: string,
): Promise<DiscoveryProfile | null> {
  const creds = getCredentials();
  if (!creds) return null;

  const fields =
    "business_discovery.fields(id,username,name,profile_picture_url,followers_count,media_count)";
  const url = `${API}/${creds.userId}?fields=${fields}&username=${encodeURIComponent(username)}&access_token=${creds.token}`;

  const res = await fetchWithTimeout(url, { timeout: 10_000 });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error(
      `[instagram-discovery] discoverProfile(${username}) failed: ${res.status} ${err}`,
    );
    return null;
  }

  const data = (await res.json()) as {
    business_discovery?: {
      id?: string;
      username?: string;
      name?: string;
      profile_picture_url?: string;
      followers_count?: number;
      media_count?: number;
    };
  };

  const bd = data.business_discovery;
  if (!bd) return null;

  return {
    id: bd.id ?? "",
    username: bd.username ?? username,
    name: bd.name ?? "",
    profilePictureUrl: bd.profile_picture_url ?? "",
    followersCount: bd.followers_count ?? 0,
    mediaCount: bd.media_count ?? 0,
  };
}

/**
 * Fetch recent media from a public Business/Creator account.
 */
export async function discoverRecentMedia(
  username: string,
  opts?: { limit?: number; after?: string },
): Promise<{ media: DiscoveryMedia[]; nextCursor?: string }> {
  const creds = getCredentials();
  if (!creds) return { media: [] };

  const limit = opts?.limit ?? 25;
  const afterClause = opts?.after ? `.after(${opts.after})` : "";
  const mediaFields = `id,media_type,caption,permalink,thumbnail_url,like_count,comments_count,timestamp`;
  const fields = `business_discovery.fields(media.limit(${limit})${afterClause}{${mediaFields}})`;
  const url = `${API}/${creds.userId}?fields=${fields}&username=${encodeURIComponent(username)}&access_token=${creds.token}`;

  const res = await fetchWithTimeout(url, { timeout: 15_000 });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error(
      `[instagram-discovery] discoverRecentMedia(${username}) failed: ${res.status} ${err}`,
    );
    return { media: [] };
  }

  const data = (await res.json()) as {
    business_discovery?: {
      media?: {
        data?: Array<{
          id: string;
          media_type?: string;
          caption?: string;
          permalink?: string;
          thumbnail_url?: string;
          like_count?: number;
          comments_count?: number;
          timestamp?: string;
        }>;
        paging?: { cursors?: { after?: string } };
      };
    };
  };

  const rawMedia = data.business_discovery?.media?.data ?? [];
  const nextCursor = data.business_discovery?.media?.paging?.cursors?.after;

  const media: DiscoveryMedia[] = rawMedia.map((m) => ({
    id: m.id,
    mediaType: m.media_type ?? "IMAGE",
    caption: m.caption,
    permalink: m.permalink ?? "",
    thumbnailUrl: m.thumbnail_url,
    likeCount: m.like_count ?? 0,
    commentsCount: m.comments_count ?? 0,
    timestamp: m.timestamp ?? new Date().toISOString(),
  }));

  return { media, nextCursor };
}
