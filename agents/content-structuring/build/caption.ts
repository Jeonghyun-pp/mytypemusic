import type { TopicIntelInput } from "../contracts.js";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract domain from a URL for display.
 */
function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ============================================================================
// Main
// ============================================================================

/**
 * Build an Instagram caption draft.
 *
 * Structure:
 *   1) Hook paragraph: 1-2 sentences from angleCandidates[0]
 *   2) Summary bullets: top 3 keyFacts (truncated)
 *   3) Source reference: 2-4 publishers/domains
 *   4) Hashtags line
 */
export function buildCaptionDraft(
  intel: TopicIntelInput,
  hashtags: string[],
): string {
  const lines: string[] = [];

  // Para 1: Hook
  const hook = intel.angleCandidates[0];
  if (hook) {
    lines.push(hook);
  } else {
    lines.push(`${intel.normalizedTopic}, 핵심만 정리했습니다.`);
  }
  lines.push("");

  // Para 2: Summary bullets (top 3 facts)
  const factBullets = intel.keyFacts.slice(0, 3);
  for (const fact of factBullets) {
    const text =
      fact.text.length > 60
        ? fact.text.slice(0, 59) + "…"
        : fact.text;
    lines.push(`▸ ${text}`);
  }
  if (factBullets.length > 0) {
    lines.push("");
  }

  // Para 3: Source references (2-4)
  const sourceRefs: string[] = [];
  const seen = new Set<string>();
  for (const src of intel.sources) {
    const label = src.publisher ?? extractDomain(src.url);
    if (seen.has(label)) continue;
    seen.add(label);
    sourceRefs.push(label);
    if (sourceRefs.length >= 4) break;
  }
  if (sourceRefs.length > 0) {
    lines.push(`📌 참고: ${sourceRefs.join(", ")}`);
    lines.push("");
  }

  // Last line: Hashtags
  lines.push(hashtags.join(" "));

  return lines.join("\n");
}
