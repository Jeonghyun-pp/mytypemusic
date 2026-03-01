/**
 * Text fitting utilities for template slot constraints.
 *
 * Phase A1: simple heuristic truncation (no actual text measurement).
 * Goal: prevent text from overflowing slot boundaries.
 */

/**
 * Truncate text to maxChars, appending "…" if truncated.
 *
 * - If maxChars <= 0: returns ""
 * - If maxChars === 1: returns "…"
 * - If text.length > maxChars: returns first (maxChars-1) chars + "…"
 */
export function truncateByChars(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (maxChars <= 0) return "";
  if (maxChars === 1) return "\u2026";
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars - 1) + "\u2026";
}

/**
 * Normalize whitespace in text:
 * - Trim leading/trailing whitespace
 * - Replace newlines with spaces
 * - Collapse consecutive spaces to one
 */
export function normalizeText(text: string): string {
  return text.trim().replace(/\n/g, " ").replace(/ {2,}/g, " ");
}

/**
 * Apply slot text constraints (maxChars / maxLines) to text.
 *
 * 1) Normalize whitespace
 * 2) If maxLines is set, compute a char budget:
 *    lineBudgetChars = maxChars ?? (maxLines * 18)
 *    Then truncate to that budget.
 * 3) If maxChars is set, final truncate to maxChars.
 *
 * Phase A1 heuristic: maxLines * 18 chars/line is a rough estimate.
 * No actual font measurement is performed.
 */
export function applySlotTextConstraints(params: {
  text: string;
  maxChars?: number;
  maxLines?: number;
}): string {
  const { maxChars, maxLines } = params;
  let result = normalizeText(params.text);

  // maxLines → convert to a char budget
  if (maxLines !== undefined && maxLines > 0) {
    const lineBudgetChars = maxChars ?? maxLines * 18;
    result = truncateByChars(result, lineBudgetChars);
  }

  // maxChars → final truncate
  if (maxChars !== undefined && maxChars > 0) {
    result = truncateByChars(result, maxChars);
  }

  return result;
}
