import type { InsightsAdapter, PostInsights, AccountInsights } from "./types";

const API = "https://api.twitter.com/2";

export const xInsightsAdapter: InsightsAdapter = {
  platform: "x",

  async fetchAccountInsights(accessToken, userId) {
    const res = await fetch(
      `${API}/users/${userId}?user.fields=public_metrics`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return { followersCount: 0 };
    const data = (await res.json()) as {
      data?: { public_metrics?: { followers_count?: number } };
    };
    return { followersCount: data.data?.public_metrics?.followers_count ?? 0 };
  },

  async fetchPostInsights(accessToken, platformPostId) {
    const res = await fetch(
      `${API}/tweets/${platformPostId}?tweet.fields=public_metrics`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) throw new Error(`X insights ${res.status}`);

    const data = (await res.json()) as {
      data?: {
        public_metrics?: {
          impression_count?: number;
          like_count?: number;
          reply_count?: number;
          retweet_count?: number;
          quote_count?: number;
          bookmark_count?: number;
        };
      };
    };
    const m = data.data?.public_metrics;

    return {
      views: m?.impression_count ?? 0,
      likes: m?.like_count ?? 0,
      comments: m?.reply_count ?? 0,
      shares: (m?.retweet_count ?? 0) + (m?.quote_count ?? 0),
      saves: m?.bookmark_count ?? 0,
    };
  },
};
