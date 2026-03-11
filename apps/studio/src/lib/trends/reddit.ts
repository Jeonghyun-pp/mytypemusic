import type { TrendProvider, TrendItem } from "./types";
import { fetchWithTimeout } from "@/lib/fetch-utils";

const REDDIT_BASE = "https://www.reddit.com";

// Music/culture subreddits relevant to a Korean music web magazine
const DEFAULT_SUBREDDITS = ["kpop", "khiphop", "koreanmusic", "indieheads", "hiphopheads"];

const USER_AGENT = "web-magazine-studio/1.0 (trend aggregator)";

interface RedditPost {
  data: {
    title: string;
    url: string;
    permalink: string;
    subreddit: string;
    score: number;
    num_comments: number;
    created_utc: number;
    link_flair_text?: string;
  };
}

/**
 * Reddit trend provider — subreddit hot posts + keyword search.
 * Uses Reddit's public JSON API (no auth required, rate-limited to ~60 req/min).
 * Subreddits: kpop, khiphop, koreanmusic, indieheads, hiphopheads
 */
export const redditProvider: TrendProvider = {
  name: "reddit",
  async fetch(opts) {
    const [hotItems, keywordItems] = await Promise.all([
      fetchHotPosts(),
      fetchKeywordPosts(opts?.keywords ?? []),
    ]);
    return [...hotItems, ...keywordItems];
  },
};

/**
 * Fetch hot posts from music subreddits (top 3 per subreddit).
 * Sequential with small delay to respect Reddit rate limits.
 */
async function fetchHotPosts(): Promise<TrendItem[]> {
  const items: TrendItem[] = [];

  for (const sub of DEFAULT_SUBREDDITS) {
    try {
      const url = `${REDDIT_BASE}/r/${sub}/hot.json?limit=3&raw_json=1`;
      const res = await fetchWithTimeout(url, {
        timeout: 8_000,
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) continue;

      const data = (await res.json()) as { data: { children: RedditPost[] } };

      for (const post of data.data?.children ?? []) {
        // Skip stickied/pinned posts
        if ((post.data as Record<string, unknown>).stickied) continue;

        items.push({
          title: post.data.title,
          source: "reddit",
          url: `https://www.reddit.com${post.data.permalink}`,
          description: `r/${post.data.subreddit} | ↑${post.data.score} | 💬${post.data.num_comments}`,
          rank: items.length + 1,
          fetchedAt: new Date(),
        });
      }

      // Small delay between subreddit requests
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch {
      // Skip this subreddit, continue with others
    }
  }

  return items;
}

/**
 * Search Reddit for posts matching keywords.
 * Max 3 keywords, sequential with delay.
 * Endpoint: /search.json?q={keyword}&sort=new&limit=5
 */
async function fetchKeywordPosts(keywords: string[]): Promise<TrendItem[]> {
  if (keywords.length === 0) return [];

  const items: TrendItem[] = [];
  const musicSubs = DEFAULT_SUBREDDITS.join("+");

  for (const kw of keywords.slice(0, 3)) {
    try {
      const url =
        `${REDDIT_BASE}/r/${musicSubs}/search.json` +
        `?q=${encodeURIComponent(kw)}&sort=new&restrict_sr=on&limit=5&raw_json=1`;
      const res = await fetchWithTimeout(url, {
        timeout: 8_000,
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) continue;

      const data = (await res.json()) as { data: { children: RedditPost[] } };

      for (const post of data.data?.children ?? []) {
        items.push({
          title: post.data.title,
          source: "reddit-search",
          url: `https://www.reddit.com${post.data.permalink}`,
          description: `r/${post.data.subreddit} | ↑${post.data.score} | 💬${post.data.num_comments}`,
          keyword: kw,
          rank: items.length + 1,
          fetchedAt: new Date(),
        });
      }

      // Delay between keyword searches
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch {
      // Skip this keyword
    }
  }

  return items;
}
