export interface PostSearchResult {
  postId: string;
  postUrl: string;
  authorHandle: string;
  text: string;
  platform: string;
  engagementScore?: number;
}

export interface SearchAdapter {
  platform: string;
  searchPosts(
    accessToken: string,
    keywords: string[],
    limit?: number,
  ): Promise<PostSearchResult[]>;
}
