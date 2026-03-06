import type { SnsOAuthAdapter, OAuthTokenResult } from "../types";

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const API = "https://open.tiktokapis.com/v2";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

export const tiktokAdapter: SnsOAuthAdapter = {
  platform: "tiktok",

  getAuthUrl(callbackUrl: string, state: string): string {
    const params = new URLSearchParams({
      client_key: env("TIKTOK_CLIENT_KEY"),
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "user.info.basic,video.publish,video.upload",
      state,
    });
    return `${AUTH_URL}?${params}`;
  },

  async handleCallback(code: string, callbackUrl: string): Promise<OAuthTokenResult> {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: env("TIKTOK_CLIENT_KEY"),
        client_secret: env("TIKTOK_CLIENT_SECRET"),
        code,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl,
      }),
    });
    const tokenData = (await tokenRes.json()) as {
      data: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        open_id: string;
        scope: string;
      };
      error?: { code: string; message: string };
    };
    if (tokenData.error) {
      throw new Error(`TikTok token exchange failed: ${tokenData.error.message}`);
    }

    const { access_token, refresh_token, expires_in, open_id, scope } = tokenData.data;

    // Get user info
    const profileRes = await fetch(`${API}/user/info/?fields=open_id,display_name,avatar_url`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const profileData = (await profileRes.json()) as {
      data: { user: { open_id: string; display_name: string; avatar_url: string } };
    };
    const user = profileData.data.user;

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      scopes: scope.split(","),
      platformUserId: open_id,
      displayName: user.display_name || open_id,
      profileImageUrl: user.avatar_url,
    };
  },

  async refreshAccessToken(refreshToken: string) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: env("TIKTOK_CLIENT_KEY"),
        client_secret: env("TIKTOK_CLIENT_SECRET"),
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    const data = (await res.json()) as {
      data: { access_token: string; refresh_token: string; expires_in: number };
    };
    return {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresIn: data.data.expires_in,
    };
  },
};
