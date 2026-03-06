export interface PostInsights {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface AccountInsights {
  followersCount: number;
  demographics?: {
    age?: Array<{ range: string; percentage: number }>;
    gender?: Array<{ type: string; percentage: number }>;
    topCities?: Array<{ name: string; percentage: number }>;
    topCountries?: Array<{ name: string; percentage: number }>;
  };
}

export interface InsightsAdapter {
  platform: string;
  fetchPostInsights(
    accessToken: string,
    platformPostId: string,
    userId: string,
  ): Promise<PostInsights>;
  fetchAccountInsights?(
    accessToken: string,
    userId: string,
  ): Promise<AccountInsights>;
}
