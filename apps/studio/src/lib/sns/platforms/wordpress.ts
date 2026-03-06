import type { SnsOAuthAdapter, OAuthTokenResult } from "../types";

const AUTH_URL = "https://public-api.wordpress.com/oauth2/authorize";
const TOKEN_URL = "https://public-api.wordpress.com/oauth2/token";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

export const wordpressAdapter: SnsOAuthAdapter = {
  platform: "wordpress",

  getAuthUrl(callbackUrl: string, state: string): string {
    const params = new URLSearchParams({
      client_id: env("WORDPRESS_COM_CLIENT_ID"),
      redirect_uri: callbackUrl,
      response_type: "code",
      state,
    });
    return `${AUTH_URL}?${params}`;
  },

  async handleCallback(code: string, callbackUrl: string): Promise<OAuthTokenResult> {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env("WORDPRESS_COM_CLIENT_ID"),
        client_secret: env("WORDPRESS_COM_CLIENT_SECRET"),
        grant_type: "authorization_code",
        redirect_uri: callbackUrl,
        code,
      }),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      blog_id: string;
      blog_url: string;
      token_type: string;
    };
    if (!tokenData.access_token) {
      throw new Error(`WordPress token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    // Get user info
    const profileRes = await fetch("https://public-api.wordpress.com/rest/v1.1/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await profileRes.json()) as {
      ID: number;
      display_name: string;
      avatar_URL?: string;
      username: string;
    };

    return {
      accessToken: tokenData.access_token,
      scopes: ["posts", "media"],
      platformUserId: String(profile.ID),
      displayName: profile.display_name || profile.username,
      profileImageUrl: profile.avatar_URL,
      metadata: {
        blogId: tokenData.blog_id,
        blogUrl: tokenData.blog_url,
        siteType: "com",
      },
    };
  },

  async refreshAccessToken(_refreshToken: string) {
    // WordPress.com tokens don't expire by default
    throw new Error("WordPress.com tokens do not support refresh. Re-authenticate.");
  },
};
