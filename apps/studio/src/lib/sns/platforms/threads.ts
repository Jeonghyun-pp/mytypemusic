import type { SnsOAuthAdapter, OAuthTokenResult } from "../types";

const GRAPH_API = "https://graph.threads.net";
const AUTH_URL = "https://threads.net/oauth/authorize";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

export const threadsAdapter: SnsOAuthAdapter = {
  platform: "threads",

  getAuthUrl(callbackUrl: string, state: string): string {
    const params = new URLSearchParams({
      client_id: env("META_APP_ID"),
      redirect_uri: callbackUrl,
      scope: "threads_basic,threads_content_publish,threads_manage_replies,threads_read_replies",
      response_type: "code",
      state,
    });
    return `${AUTH_URL}?${params}`;
  },

  async handleCallback(
    code: string,
    callbackUrl: string,
  ): Promise<OAuthTokenResult> {
    // 1. Exchange code for short-lived token
    const tokenRes = await fetch(`${GRAPH_API}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env("META_APP_ID"),
        client_secret: env("META_APP_SECRET"),
        grant_type: "authorization_code",
        redirect_uri: callbackUrl,
        code,
      }),
    });
    const tokenData = await tokenRes.json() as {
      access_token: string;
      token_type: string;
      expires_in?: number;
    };
    if (!tokenData.access_token) {
      throw new Error(`Threads token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    // 2. Exchange for long-lived token (60 days)
    const longRes = await fetch(
      `${GRAPH_API}/access_token?` +
        new URLSearchParams({
          grant_type: "th_exchange_token",
          client_secret: env("META_APP_SECRET"),
          access_token: tokenData.access_token,
        }),
    );
    const longData = await longRes.json() as {
      access_token?: string;
      expires_in?: number;
      error?: { message: string };
    };

    if (!longData.access_token) {
      // Don't silently fall back to 1-hour token — fail explicitly
      throw new Error(
        `Threads long-lived token exchange failed: ${longData.error?.message ?? "empty access_token"}. Short-lived token (1h) is not reliable for scheduled publishing.`,
      );
    }

    const accessToken = longData.access_token;
    const expiresIn = longData.expires_in ?? 5184000; // default 60 days

    // 3. Get user profile
    const profileRes = await fetch(
      `${GRAPH_API}/v1.0/me?fields=id,username,threads_profile_picture_url&access_token=${accessToken}`,
    );
    const profile = await profileRes.json() as {
      id: string;
      username?: string;
      threads_profile_picture_url?: string;
    };

    return {
      accessToken,
      expiresIn,
      scopes: ["threads_basic", "threads_content_publish", "threads_manage_replies", "threads_read_replies"],
      platformUserId: profile.id,
      displayName: profile.username ?? profile.id,
      profileImageUrl: profile.threads_profile_picture_url,
    };
  },

  async refreshAccessToken(currentLongLivedToken: string) {
    const res = await fetch(
      `${GRAPH_API}/refresh_access_token?` +
        new URLSearchParams({
          grant_type: "th_refresh_token",
          access_token: currentLongLivedToken,
        }),
    );
    const data = await res.json() as {
      access_token: string;
      expires_in: number;
    };
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  },
};
