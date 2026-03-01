// ============================================================================
// YouTube Data API v3 configuration
// ============================================================================

const ENV_KEY = "YOUTUBE_API_KEY";

/**
 * Read the YouTube API key from environment.
 * Throws with a clear message if not set.
 */
export function getYouTubeApiKey(): string {
  const key = process.env[ENV_KEY];
  if (!key) {
    throw new Error(
      `Missing ${ENV_KEY} environment variable.\n` +
        `Set it in your .env file or export it:\n` +
        `  export ${ENV_KEY}=AIza...`,
    );
  }
  return key;
}

// ============================================================================
// Quota constants (YouTube Data API v3)
// https://developers.google.com/youtube/v3/determine_quota_cost
// ============================================================================

export const QUOTA = {
  /** Daily quota for a default project. */
  DAILY_LIMIT: 10_000,
  /** Cost of search.list (per call, regardless of maxResults). */
  SEARCH_LIST: 100,
  /** Cost of videos.list (per call). */
  VIDEOS_LIST: 1,
} as const;

// ============================================================================
// API base URL
// ============================================================================

export const YT_API_BASE = "https://www.googleapis.com/youtube/v3";
