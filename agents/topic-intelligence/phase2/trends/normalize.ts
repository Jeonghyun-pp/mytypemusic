// ============================================================================
// Main
// ============================================================================

const MAX_KEYWORD_LEN = 40;

/**
 * Normalize a seed keyword from Google Trends.
 *
 * Rules:
 * - Trim whitespace
 * - Collapse consecutive whitespace to single space
 * - Remove quotes (" ' " " ' ')
 * - Truncate to 40 characters
 */
export function normalizeSeedKeyword(input: string): string {
  let s = input.trim();
  s = s.replace(/\s{2,}/g, " ");
  s = s.replace(/["'""'']/g, "");
  if (s.length > MAX_KEYWORD_LEN) {
    s = s.slice(0, MAX_KEYWORD_LEN);
  }
  return s;
}
