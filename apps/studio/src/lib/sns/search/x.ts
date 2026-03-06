import type { SearchAdapter, PostSearchResult } from "./types";

const API = "https://api.twitter.com/2";

export const xSearchAdapter: SearchAdapter = {
  platform: "x",

  async searchPosts(accessToken, keywords, limit = 10) {
    // Build query: keywords joined with OR, exclude retweets and own replies
    const query = `(${keywords.join(" OR ")}) -is:retweet -is:reply lang:ko`;
    const params = new URLSearchParams({
      query,
      max_results: String(Math.min(limit, 100)),
      "tweet.fields": "id,text,author_id,public_metrics,created_at",
    });

    const res = await fetch(`${API}/tweets/search/recent?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`X search failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      data?: Array<{
        id: string;
        text: string;
        author_id: string;
        public_metrics?: {
          like_count: number;
          reply_count: number;
          retweet_count: number;
        };
      }>;
    };

    return (data.data ?? []).map(
      (t): PostSearchResult => ({
        postId: t.id,
        postUrl: `https://x.com/i/status/${t.id}`,
        authorHandle: t.author_id,
        text: t.text,
        platform: "x",
        engagementScore:
          (t.public_metrics?.like_count ?? 0) +
          (t.public_metrics?.reply_count ?? 0) +
          (t.public_metrics?.retweet_count ?? 0),
      }),
    );
  },
};
