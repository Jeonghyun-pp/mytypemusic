// ============================================================================
// Stop words (Korean + English)
// ============================================================================

const STOP_WORDS = new Set([
  // Korean
  "그리고",
  "하지만",
  "또한",
  "이번",
  "오늘",
  "내일",
  "관련",
  "기사",
  "단독",
  "속보",
  // English
  "the",
  "a",
  "an",
  "to",
  "of",
  "in",
  "on",
  "for",
  "and",
  "or",
]);

// ============================================================================
// Main
// ============================================================================

/**
 * Tokenize input text for coverage clustering.
 *
 * Rules:
 * - Lowercase (English only)
 * - Split on whitespace
 * - Remove tokens with length < 2
 * - Remove digit-only tokens (except 4-digit years like "2026")
 * - Remove stop words
 * - Deduplicate
 */
export function tokenizeForCoverage(input: string): string[] {
  const raw = input
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const filtered: string[] = [];
  const seen = new Set<string>();

  for (const token of raw) {
    // Skip stop words
    if (STOP_WORDS.has(token)) continue;

    // Skip digit-only tokens unless 4-digit (year-like)
    if (/^\d+$/.test(token) && token.length !== 4) continue;

    // Deduplicate
    if (seen.has(token)) continue;
    seen.add(token);

    filtered.push(token);
  }

  return filtered;
}
