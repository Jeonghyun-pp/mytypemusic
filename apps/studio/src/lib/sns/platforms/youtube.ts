import type { SnsOAuthAdapter, OAuthTokenResult } from "../types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

export const youtubeAdapter: SnsOAuthAdapter = {
  platform: "youtube",

  getAuthUrl(callbackUrl: string, state: string): string {
    const params = new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      redirect_uri: callbackUrl,
      response_type: "code",
      state,
      scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
      access_type: "offline",
      prompt: "consent",
    });
    return `${AUTH_URL}?${params}`;
  },

  async handleCallback(code: string, callbackUrl: string): Promise<OAuthTokenResult> {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env("GOOGLE_CLIENT_ID"),
        client_secret: env("GOOGLE_CLIENT_SECRET"),
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };
    if (!tokenData.access_token) {
      throw new Error(`YouTube token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    // Get channel info
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );
    const channelData = (await channelRes.json()) as {
      items?: Array<{
        id: string;
        snippet: { title: string; thumbnails?: { default?: { url: string } } };
      }>;
    };
    const channel = channelData.items?.[0];

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scopes: tokenData.scope.split(" "),
      platformUserId: channel?.id ?? "",
      displayName: channel?.snippet.title ?? "YouTube Channel",
      profileImageUrl: channel?.snippet.thumbnails?.default?.url,
    };
  },

  async refreshAccessToken(refreshToken: string) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env("GOOGLE_CLIENT_ID"),
        client_secret: env("GOOGLE_CLIENT_SECRET"),
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  },
};
