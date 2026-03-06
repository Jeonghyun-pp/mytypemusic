// Lazy-load jose to avoid Turbopack "Module not found" at build time
async function getJose() {
  const pkg = "jose";
  return await import(/* webpackIgnore: true */ pkg);
}
import type { SnsOAuthAdapter, OAuthTokenResult } from "../types";

const AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const API_URL = "https://api.twitter.com/2";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

/** X uses PKCE — we generate code_verifier / code_challenge on auth start. */
export async function generatePKCE() {
  const jose = await getJose();
  const verifier = jose.base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = jose.base64url.encode(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
  );
  return { verifier, challenge };
}

export const xAdapter: SnsOAuthAdapter = {
  platform: "x",

  getAuthUrl(callbackUrl: string, state: string): string {
    // NOTE: codeChallenge must be passed externally via state or session store.
    // This returns a template URL — the caller must replace CODE_CHALLENGE.
    const params = new URLSearchParams({
      response_type: "code",
      client_id: env("X_CLIENT_ID"),
      redirect_uri: callbackUrl,
      scope: "tweet.read tweet.write users.read offline.access",
      state,
      code_challenge: "CODE_CHALLENGE_PLACEHOLDER",
      code_challenge_method: "S256",
    });
    return `${AUTH_URL}?${params}`;
  },

  async handleCallback(
    code: string,
    callbackUrl: string,
    // X requires PKCE code_verifier, passed via extra arg
  ): Promise<OAuthTokenResult> {
    // This adapter expects codeVerifier in callbackUrl query param for simplicity.
    // In production, retrieve from session/DB.
    const url = new URL(callbackUrl);
    const codeVerifier = url.searchParams.get("code_verifier") ?? "";

    const clientId = env("X_CLIENT_ID");
    const clientSecret = env("X_CLIENT_SECRET");
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl.split("?")[0] ?? callbackUrl,
        code_verifier: codeVerifier,
      }),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };
    if (!tokenData.access_token) {
      throw new Error(`X token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    // Get user profile
    const profileRes = await fetch(`${API_URL}/users/me?user.fields=profile_image_url`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profileData = (await profileRes.json()) as {
      data: { id: string; name: string; username: string; profile_image_url?: string };
    };

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scopes: tokenData.scope.split(" "),
      platformUserId: profileData.data.id,
      displayName: `@${profileData.data.username}`,
      profileImageUrl: profileData.data.profile_image_url,
    };
  },

  async refreshAccessToken(refreshToken: string) {
    const clientId = env("X_CLIENT_ID");
    const clientSecret = env("X_CLIENT_SECRET");
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  },
};
