export interface TrendItem {
  title: string;
  source: string; // "google" | "naver-datalab" | "naver-news" | "naver-blog" | "youtube" | "hackernews"
  url?: string;
  description?: string;
  rank?: number;
  fetchedAt: Date;
}

export interface TrendProvider {
  name: string;
  fetch(opts?: { keywords?: string[]; geo?: string }): Promise<TrendItem[]>;
}
