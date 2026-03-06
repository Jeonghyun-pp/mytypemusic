export type SnsPlatform =
  | "threads"
  | "instagram"
  | "x"
  | "youtube"
  | "tiktok"
  | "linkedin"
  | "wordpress"
  | "facebook"
  | "pinterest"
  | "telegram";

export interface OAuthStartResult {
  authUrl: string;
  state: string;
}

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number; // seconds
  scopes: string[];
  platformUserId: string;
  displayName: string;
  profileImageUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface SnsOAuthAdapter {
  platform: SnsPlatform;
  /** Build the OAuth authorization URL */
  getAuthUrl(callbackUrl: string, state: string): string;
  /** Exchange the callback code for tokens + profile info */
  handleCallback(
    code: string,
    callbackUrl: string,
  ): Promise<OAuthTokenResult>;
  /** Refresh an expired access token */
  refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }>;
}

export interface SnsPublishAdapter {
  platform: SnsPlatform;
  /** Publish a text post */
  publishText(
    accessToken: string,
    userId: string,
    text: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ platformPostId: string; platformPostUrl: string }>;
  /** Publish a post with media */
  publishMedia(
    accessToken: string,
    userId: string,
    text: string,
    mediaUrls: string[],
    metadata?: Record<string, unknown>,
  ): Promise<{ platformPostId: string; platformPostUrl: string }>;
}

export const PLATFORM_LABELS: Record<SnsPlatform, string> = {
  threads: "Threads",
  instagram: "Instagram",
  x: "X (Twitter)",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  wordpress: "WordPress",
  facebook: "Facebook",
  pinterest: "Pinterest",
  telegram: "Telegram",
};

export const PLATFORM_COLORS: Record<SnsPlatform, string> = {
  threads: "#000000",
  instagram: "#E1306C",
  x: "#1DA1F2",
  youtube: "#FF0000",
  tiktok: "#010101",
  linkedin: "#0A66C2",
  wordpress: "#21759B",
  facebook: "#1877F2",
  pinterest: "#BD081C",
  telegram: "#0088CC",
};
