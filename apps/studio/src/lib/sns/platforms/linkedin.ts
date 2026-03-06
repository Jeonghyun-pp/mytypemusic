import type { SnsOAuthAdapter, OAuthTokenResult } from "../types";

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const API = "https://api.linkedin.com/v2";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

export const linkedinAdapter: SnsOAuthAdapter = {
  platform: "linkedin",

  getAuthUrl(callbackUrl: string, state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: env("LINKEDIN_CLIENT_ID"),
      redirect_uri: callbackUrl,
      state,
      scope: "openid profile w_member_social",
    });
    return `${AUTH_URL}?${params}`;
  },

  async handleCallback(code: string, callbackUrl: string): Promise<OAuthTokenResult> {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl,
        client_id: env("LINKEDIN_CLIENT_ID"),
        client_secret: env("LINKEDIN_CLIENT_SECRET"),
      }),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      refresh_token_expires_in?: number;
    };
    if (!tokenData.access_token) {
      throw new Error(`LinkedIn token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    // Get profile via OpenID Connect userinfo
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await profileRes.json()) as {
      sub: string;
      name?: string;
      picture?: string;
    };

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scopes: ["openid", "profile", "w_member_social"],
      platformUserId: profile.sub,
      displayName: profile.name ?? profile.sub,
      profileImageUrl: profile.picture,
    };
  },

  async refreshAccessToken(refreshToken: string) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: env("LINKEDIN_CLIENT_ID"),
        client_secret: env("LINKEDIN_CLIENT_SECRET"),
      }),
    });
    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  },
};
