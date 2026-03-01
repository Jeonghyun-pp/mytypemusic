/**
 * Normalize a seed keyword into a clean topic string.
 *
 * Rules (in order):
 *  1. trim
 *  2. collapse consecutive whitespace (2+ → 1)
 *  3. strip outer matching quotes: "..." or '...'
 *  4. strip outer matching brackets: (...) or [...] or {...}
 *  5. final trim
 */
export function normalizeTopic(seedKeyword: string): string {
  let s = seedKeyword.trim();

  // Collapse consecutive whitespace
  s = s.replace(/\s{2,}/g, " ");

  // Strip outer quotes
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }

  // Strip outer brackets
  if (
    (s.startsWith("(") && s.endsWith(")")) ||
    (s.startsWith("[") && s.endsWith("]")) ||
    (s.startsWith("{") && s.endsWith("}"))
  ) {
    s = s.slice(1, -1);
  }

  return s.trim();
}

/**
 * Convert a topic string to a URL/ID-safe slug.
 *
 * Rules:
 *  - lowercase
 *  - spaces and underscores → hyphens
 *  - keep only: alphanumeric (a-z0-9), Korean (가-힣), hyphens
 *  - collapse consecutive hyphens → 1
 *  - strip leading/trailing hyphens
 */
export function slugifyTopic(input: string): string {
  let s = input.toLowerCase();

  // Spaces and underscores → hyphens
  s = s.replace(/[\s_]+/g, "-");

  // Remove everything except alphanumeric, Korean, hyphens
  s = s.replace(/[^a-z0-9가-힣-]/g, "");

  // Collapse consecutive hyphens
  s = s.replace(/-{2,}/g, "-");

  // Strip leading/trailing hyphens
  s = s.replace(/^-+|-+$/g, "");

  return s;
}
