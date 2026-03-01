import type { ScoredArticle } from "./score.js";

// ============================================================================
// Types
// ============================================================================

export type SelectOptions = {
  maxArticles: number;
  minScore?: number;
  titleDedupeJaccard?: number;
};

// ============================================================================
// Helpers
// ============================================================================

/** Tokenize a title into lowercase word set for Jaccard comparison. */
function tokenize(title: string): Set<string> {
  return new Set(
    title
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

// ============================================================================
// Selector
// ============================================================================

/**
 * Select top articles after scoring.
 *
 * 1. Sort by score desc → publishedAt desc → title asc
 * 2. Remove below minScore
 * 3. Title dedupe via Jaccard similarity
 * 4. Return top maxArticles
 */
export function selectTopArticles(
  scored: ScoredArticle[],
  opts: SelectOptions,
): ScoredArticle[] {
  const minScore = opts.minScore ?? 1;
  const threshold = opts.titleDedupeJaccard ?? 0.8;

  // 1) Sort: score desc, publishedAt desc, title asc
  const sorted = [...scored].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    // publishedAt desc (articles without date go last)
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;

    return a.title.localeCompare(b.title);
  });

  // 2) Remove below minScore
  const aboveMin = sorted.filter((a) => a.score >= minScore);

  // 3) Title dedupe (keep first occurrence = higher score)
  const kept: ScoredArticle[] = [];
  const keptTokens: Set<string>[] = [];

  for (const article of aboveMin) {
    const tokens = tokenize(article.title);
    let isDupe = false;

    for (const existing of keptTokens) {
      if (jaccard(tokens, existing) >= threshold) {
        isDupe = true;
        break;
      }
    }

    if (!isDupe) {
      kept.push(article);
      keptTokens.push(tokens);
    }
  }

  // 4) Top maxArticles
  return kept.slice(0, opts.maxArticles);
}
