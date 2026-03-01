// ============================================================================
// Instagram Graph API configuration
// ============================================================================

const ENV_TOKEN = "INSTAGRAM_ACCESS_TOKEN";
const ENV_USER_ID = "INSTAGRAM_USER_ID";

/**
 * Read the Instagram long-lived access token from environment.
 */
export function getInstagramToken(): string {
  const token = process.env[ENV_TOKEN];
  if (!token) {
    throw new Error(
      `Missing ${ENV_TOKEN} environment variable.\n` +
        `Obtain a long-lived token via Facebook Developer Portal:\n` +
        `  1. Create a Facebook App → Add Instagram Graph API\n` +
        `  2. Generate token in Graph API Explorer\n` +
        `  3. Exchange for long-lived token (60 days)\n` +
        `  export ${ENV_TOKEN}=IGQV...`,
    );
  }
  return token;
}

/**
 * Read the Instagram Business Account ID from environment.
 * This is the IG user ID linked to the Facebook Page, NOT the username.
 */
export function getInstagramUserId(): string {
  const userId = process.env[ENV_USER_ID];
  if (!userId) {
    throw new Error(
      `Missing ${ENV_USER_ID} environment variable.\n` +
        `Find it via Graph API Explorer:\n` +
        `  GET /me/accounts → page_id → GET /{page_id}?fields=instagram_business_account\n` +
        `  export ${ENV_USER_ID}=17841...`,
    );
  }
  return userId;
}

// ============================================================================
// API constants
// ============================================================================

export const IG_API_BASE = "https://graph.facebook.com/v21.0";

export const LIMITS = {
  /** Max hashtag searches per 7-day window per user. */
  HASHTAG_SEARCHES_PER_WEEK: 30,
  /** Approximate requests per hour for business accounts. */
  REQUESTS_PER_HOUR: 200,
} as const;
