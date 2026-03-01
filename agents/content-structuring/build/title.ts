import type { TopicIntelInput } from "../contracts.js";

// ============================================================================
// Constants
// ============================================================================

const MAX_TITLE_LENGTH = 22;

// ============================================================================
// Cover title
// ============================================================================

/**
 * Generate a cover title from normalizedTopic.
 *
 * Rules:
 * - Use normalizedTopic as base
 * - If longer than 22 chars, truncate with "…"
 */
export function buildCoverTitle(intel: TopicIntelInput): string {
  const base = intel.normalizedTopic.trim();

  if (base.length <= MAX_TITLE_LENGTH) {
    return base;
  }

  return base.slice(0, MAX_TITLE_LENGTH - 1) + "…";
}

// ============================================================================
// Subtitle
// ============================================================================

/**
 * Generate a subtitle from riskNotes or sources summary.
 *
 * Rules:
 * - Look for coverage-like info in riskNotes
 * - Fallback: "매체 N개 기반 정리"
 */
export function buildSubtitle(intel: TopicIntelInput): string | undefined {
  // Check riskNotes for coverage summary
  for (const note of intel.riskNotes) {
    const lower = note.toLowerCase();
    if (lower.includes("coverage") || lower.includes("매체") || lower.includes("source")) {
      // Truncate to fit subtitle
      if (note.length <= 30) {
        return note;
      }
      return note.slice(0, 29) + "…";
    }
  }

  // Fallback: source count summary
  const sourceCount = intel.sources.length;
  if (sourceCount > 0) {
    return `매체 ${String(sourceCount)}개 기반 정리`;
  }

  return undefined;
}
