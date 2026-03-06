import type { SnsOAuthAdapter, OAuthTokenResult } from "../types";

const GRAPH_API = "https://graph.facebook.com/v21.0";
const AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

export const instagramAdapter: SnsOAuthAdapter = {
  platform: "instagram",

  getAuthUrl(callbackUrl: string, state: string): string {
    const params = new URLSearchParams({
      client_id: env("META_APP_ID"),
      redirect_uri: callbackUrl,
      scope:
        "instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights,pages_show_list,pages_read_engagement",
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
    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      token_type: string;
      expires_in?: number;
    };
    if (!tokenData.access_token) {
      throw new Error(
        `Instagram token exchange failed: ${JSON.stringify(tokenData)}`,
      );
    }

    // 2. Exchange for long-lived token (60 days)
    const longRes = await fetch(
      `${GRAPH_API}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: env("META_APP_ID"),
          client_secret: env("META_APP_SECRET"),
          fb_exchange_token: tokenData.access_token,
        }),
    );
    const longData = (await longRes.json()) as {
      access_token: string;
      expires_in: number;
    };

    const accessToken = longData.access_token || tokenData.access_token;
    const expiresIn = longData.expires_in || tokenData.expires_in;

    // 3. Get Facebook Pages to find connected Instagram account
    const pagesRes = await fetch(
      `${GRAPH_API}/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`,
    );
    const pagesData = (await pagesRes.json()) as {
      data: Array<{
        id: string;
        name: string;
        instagram_business_account?: { id: string };
      }>;
    };

    const page = pagesData.data?.find((p) => p.instagram_business_account);
    if (!page?.instagram_business_account) {
      throw new Error(
        "No Instagram Business/Creator account found linked to your Facebook Pages. " +
          "Please connect an Instagram Professional account to a Facebook Page first.",
      );
    }

    const igUserId = page.instagram_business_account.id;

    // 4. Get Instagram profile
    const profileRes = await fetch(
      `${GRAPH_API}/${igUserId}?fields=id,username,profile_picture_url&access_token=${accessToken}`,
    );
    const profile = (await profileRes.json()) as {
      id: string;
      username?: string;
      profile_picture_url?: string;
    };

    return {
      accessToken,
      expiresIn,
      scopes: [
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_comments",
        "instagram_manage_insights",
      ],
      platformUserId: igUserId,
      displayName: profile.username ?? igUserId,
      profileImageUrl: profile.profile_picture_url,
      metadata: { facebookPageId: page.id, facebookPageName: page.name },
    };
  },

  async refreshAccessToken(currentLongLivedToken: string) {
    const res = await fetch(
      `${GRAPH_API}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: env("META_APP_ID"),
          client_secret: env("META_APP_SECRET"),
          fb_exchange_token: currentLongLivedToken,
        }),
    );
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
