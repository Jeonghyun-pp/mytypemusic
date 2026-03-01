import { IG_API_BASE } from "./config.js";

// ============================================================================
// Token refresh
// ============================================================================

interface RefreshTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number; // seconds
}

/**
 * Exchange a valid long-lived token for a new long-lived token.
 *
 * Long-lived tokens are valid for 60 days. This endpoint refreshes them
 * as long as the current token hasn't expired. Call periodically (e.g. every 50 days).
 *
 * Endpoint: GET /oauth/access_token?grant_type=ig_exchange_token
 *   &client_secret={app_secret}&access_token={current_token}
 *
 * Note: Requires the Facebook App Secret (INSTAGRAM_APP_SECRET env var).
 */
export async function refreshLongLivedToken(
  currentToken: string,
): Promise<{ token: string; expiresInSeconds: number }> {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: currentToken,
  });

  const url = `${IG_API_BASE}/oauth/access_token?${params.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Instagram token refresh failed: HTTP ${String(res.status)} — ${body.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as RefreshTokenResponse;

  if (!data.access_token) {
    throw new Error("Instagram token refresh: no access_token in response");
  }

  return {
    token: data.access_token,
    expiresInSeconds: data.expires_in ?? 5_184_000, // default 60 days
  };
}
