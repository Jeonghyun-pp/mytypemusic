import type { InsightsAdapter, PostInsights, AccountInsights } from "./types";

const API = "https://graph.threads.net/v1.0";

export const threadsInsightsAdapter: InsightsAdapter = {
  platform: "threads",

  async fetchAccountInsights(accessToken, _userId) {
    const res = await fetch(
      `${API}/me?fields=followers_count&access_token=${accessToken}`,
    );
    if (!res.ok) return { followersCount: 0 };
    const data = (await res.json()) as { followers_count?: number };
    return { followersCount: data.followers_count ?? 0 };
  },

  async fetchPostInsights(accessToken, platformPostId) {
    const res = await fetch(
      `${API}/${platformPostId}?fields=views,likes,replies,reposts,quotes&access_token=${accessToken}`,
    );
    if (!res.ok) throw new Error(`Threads insights ${res.status}`);

    const data = (await res.json()) as {
      views?: number;
      likes?: number;
      replies?: number;
      reposts?: number;
      quotes?: number;
    };

    return {
      views: data.views ?? 0,
      likes: data.likes ?? 0,
      comments: data.replies ?? 0,
      shares: (data.reposts ?? 0) + (data.quotes ?? 0),
      saves: 0,
    };
  },
};
