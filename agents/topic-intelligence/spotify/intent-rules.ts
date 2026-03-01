import type { SpotifyIntentType, ParsedIntent } from "./types.js";

// ============================================================================
// Rule-based Intent Parser
//
// Keyword patterns are intentionally left empty — users fill them in.
// When patterns are populated, this parser runs first (fast + free).
// If no match, the LLM fallback in intent-llm.ts handles it.
// ============================================================================

export const INTENT_PATTERNS: Record<SpotifyIntentType, string[]> = {
  album_detail:    [],  // 예: ["앨범", "album", "트랙리스트", "수록곡"]
  new_releases:    [],  // 예: ["신보", "새 앨범", "컴백", "발매"]
  top_tracks:      [],  // 예: ["인기곡", "히트곡", "대표곡"]
  artist_compare:  [],  // 예: ["비교", "vs", "대"]
  related_artists: [],  // 예: ["비슷한", "관련", "similar"]
  mood_playlist:   [],  // 예: ["분위기", "무드", "감성"]
  discography:     [],  // 예: ["디스코", "전체 앨범", "역대"]
  track_analysis:  [],  // 예: ["분석", "특성", "BPM", "템포"]
  artist_profile:  [],  // 예: ["프로필", "소개", "정보"]
};

/**
 * Attempt to parse intent from text using keyword matching.
 * Returns null if no patterns match (triggers LLM fallback).
 */
export function parseIntentByRules(text: string): ParsedIntent | null {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return null;

  let bestIntent: SpotifyIntentType | null = null;
  let bestMatchCount = 0;
  let matchedKeywords: string[] = [];

  for (const [intentType, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (patterns.length === 0) continue;

    const hits = patterns.filter((p) => normalized.includes(p.toLowerCase()));
    if (hits.length > bestMatchCount) {
      bestMatchCount = hits.length;
      bestIntent = intentType as SpotifyIntentType;
      matchedKeywords = hits;
    }
  }

  if (!bestIntent) return null;

  const artistName = extractArtistName(normalized, matchedKeywords);
  const confidence = Math.min(0.5 + bestMatchCount * 0.15, 0.95);

  return {
    intentType: bestIntent,
    artistName,
    confidence,
    source: "rule",
  };
}

/**
 * Extract artist name by removing matched keywords from the text.
 * The remaining meaningful text is assumed to be the artist name.
 */
function extractArtistName(
  text: string,
  matchedKeywords: string[],
): string | undefined {
  let remaining = text;

  for (const kw of matchedKeywords) {
    remaining = remaining.replace(new RegExp(escapeRegex(kw), "gi"), "");
  }

  // Clean up whitespace and common filler words
  remaining = remaining
    .replace(/\s+/g, " ")
    .trim();

  return remaining.length >= 2 ? remaining : undefined;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
