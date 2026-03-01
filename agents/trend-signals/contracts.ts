import type {
  NormalizedArticle,
  SourceType,
  MetricsBlock,
} from "../topic-intelligence/phase1/feeds/normalize.js";

// Re-export shared types for convenience
export type { NormalizedArticle, SourceType, MetricsBlock };

// ============================================================================
// Signal source enum
// ============================================================================

export type SignalSourceId = "youtube" | "instagram";

// ============================================================================
// Input: SignalRequest
// ============================================================================

export interface SignalRequest {
  seedKeyword: string;
  sources: SignalSourceId[];
  region?: "KR" | "US" | "GLOBAL";
  maxResults?: number; // per source, default 10
}

// ============================================================================
// Output: SignalResult
// ============================================================================

export interface SourceSummary {
  sourceId: SignalSourceId;
  count: number;
  errors: string[];
}

export interface SignalResult {
  seedKeyword: string;
  articles: NormalizedArticle[];
  sourceSummaries: SourceSummary[];
  collectedAt: string; // ISO datetime
}
