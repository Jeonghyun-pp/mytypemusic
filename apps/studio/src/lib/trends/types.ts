export interface TrendItem {
  title: string;
  source: string; // "google" | "google-keyword" | "naver-datalab" | "naver-news" | "naver-blog" | "youtube" | "youtube-search" | "hackernews" | "hackernews-search"
  url?: string;
  description?: string;
  rank?: number;
  keyword?: string; // the keyword that triggered this result (keyword-based search only)
  fetchedAt: Date;
}

export interface TrendProvider {
  name: string;
  fetch(opts?: { keywords?: string[]; geo?: string }): Promise<TrendItem[]>;
}
