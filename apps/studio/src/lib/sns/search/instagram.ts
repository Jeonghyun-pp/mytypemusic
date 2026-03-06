import type { SearchAdapter, PostSearchResult } from "./types";

const API = "https://graph.facebook.com/v21.0";

export const instagramSearchAdapter: SearchAdapter = {
  platform: "instagram",

  async searchPosts(accessToken, keywords, limit = 10) {
    const results: PostSearchResult[] = [];

    // Instagram hashtag search: look up each keyword as a hashtag
    for (const keyword of keywords) {
      if (results.length >= limit) break;

      // Step 1: Get hashtag ID
      const tag = keyword.replace(/^#/, "").replace(/\s+/g, "");
      const searchRes = await fetch(
        `${API}/ig_hashtag_search?q=${encodeURIComponent(tag)}&access_token=${accessToken}`,
      );
      if (!searchRes.ok) continue;

      const searchData = (await searchRes.json()) as {
        data?: Array<{ id: string }>;
      };
      const hashtagId = searchData.data?.[0]?.id;
      if (!hashtagId) continue;

      // Step 2: Get recent media for this hashtag
      // Requires the user_id of the querying account
      const meRes = await fetch(
        `${API}/me?fields=id&access_token=${accessToken}`,
      );
      if (!meRes.ok) continue;
      const meData = (await meRes.json()) as { id: string };

      const mediaRes = await fetch(
        `${API}/${hashtagId}/recent_media?user_id=${meData.id}&fields=id,caption,permalink,like_count,comments_count&limit=${limit}&access_token=${accessToken}`,
      );
      if (!mediaRes.ok) continue;

      const mediaData = (await mediaRes.json()) as {
        data?: Array<{
          id: string;
          caption?: string;
          permalink?: string;
          like_count?: number;
          comments_count?: number;
        }>;
      };

      for (const m of mediaData.data ?? []) {
        if (results.length >= limit) break;
        results.push({
          postId: m.id,
          postUrl: m.permalink ?? `https://www.instagram.com/p/${m.id}`,
          authorHandle: "",
          text: m.caption ?? "",
          platform: "instagram",
          engagementScore: (m.like_count ?? 0) + (m.comments_count ?? 0),
        });
      }
    }

    return results;
  },
};
