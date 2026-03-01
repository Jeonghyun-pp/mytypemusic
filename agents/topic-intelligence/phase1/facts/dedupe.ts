import type { KeyFactCandidate } from "./extract.js";

// ============================================================================
// Helpers
// ============================================================================

/** Tokenize text into lowercase word set. */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0),
  );
}

/** Jaccard similarity between two token sets. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;

  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/** Merge two evidence URL arrays, deduplicate, cap at max. */
function mergeEvidence(a: string[], b: string[], max: number): string[] {
  const seen = new Set(a);
  const merged = [...a];
  for (const url of b) {
    if (merged.length >= max) break;
    if (!seen.has(url)) {
      seen.add(url);
      merged.push(url);
    }
  }
  return merged;
}

// ============================================================================
// Main
// ============================================================================

/**
 * Deduplicate key facts by Jaccard similarity on text tokens.
 *
 * - threshold >= 0.85: treat as duplicate, keep first occurrence
 * - Merge evidenceUrls from duplicates (max 3)
 */
export function dedupeFacts(
  facts: KeyFactCandidate[],
  jaccardThreshold?: number,
): KeyFactCandidate[] {
  const threshold = jaccardThreshold ?? 0.85;
  const maxEvidence = 3;

  const kept: KeyFactCandidate[] = [];
  const keptTokens: Set<string>[] = [];

  for (const fact of facts) {
    const tokens = tokenize(fact.text);
    let dupeIndex = -1;

    for (let i = 0; i < keptTokens.length; i++) {
      if (jaccard(tokens, keptTokens[i]!) >= threshold) {
        dupeIndex = i;
        break;
      }
    }

    if (dupeIndex >= 0) {
      // Merge evidence into the existing fact
      const existing = kept[dupeIndex]!;
      existing.evidenceUrls = mergeEvidence(
        existing.evidenceUrls,
        fact.evidenceUrls,
        maxEvidence,
      );
    } else {
      kept.push({
        text: fact.text,
        evidenceUrls: fact.evidenceUrls.slice(0, maxEvidence),
      });
      keptTokens.push(tokens);
    }
  }

  return kept;
}
