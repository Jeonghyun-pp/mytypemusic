export interface PublishRequest {
  text: string;
  mediaUrls?: string[];    // URLs to images/videos
  hashtags?: string[];
  replyToId?: string;      // for thread/reply
  metadata?: Record<string, unknown>;
}

export interface PublishResult {
  platformPostId: string;
  platformPostUrl: string;
}

export interface PublishAdapter {
  platform: string;
  publishText(
    accessToken: string,
    userId: string,
    request: PublishRequest,
  ): Promise<PublishResult>;
  publishWithMedia(
    accessToken: string,
    userId: string,
    request: PublishRequest,
  ): Promise<PublishResult>;
}
