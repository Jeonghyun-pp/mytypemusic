import type { Phase2AResult } from "../run.js";
import type { SeedCandidate } from "../trends/score.js";

// ============================================================================
// Types
// ============================================================================

export type PickMode =
  | { mode: "pick"; indexes: number[] }
  | { mode: "autoPick"; topN: number }
  | { mode: "filter"; regex: string; topN?: number };

export type PickOptions = {
  category?: "music" | "lifestyle" | "all"; // default "all"
  minScore?: number; // default 40
};

// ============================================================================
// Main
// ============================================================================

/**
 * Pick/filter seeds from a snapshot.
 *
 * 1) Re-sort by score desc
 * 2) Category filter
 * 3) minScore filter
 * 4) Apply pickMode (pick/autoPick/filter)
 * 5) Deduplicate by keyword
 */
export function pickSeeds(
  snapshot: Phase2AResult,
  pickMode: PickMode,
  opts?: PickOptions,
): SeedCandidate[] {
  const categoryFilter = opts?.category ?? "all";
  const minScore = opts?.minScore ?? 40;

  // 1) Re-sort by score desc
  const sorted = [...snapshot.candidates].sort((a, b) => b.score - a.score);

  // 2) Category filter
  const afterCategory =
    categoryFilter === "all"
      ? sorted
      : sorted.filter((c) => c.category === categoryFilter);

  // 3) minScore filter
  const afterScore = afterCategory.filter((c) => c.score >= minScore);

  // 4) Apply pickMode
  let selected: SeedCandidate[];

  if (pickMode.mode === "pick") {
    // Manual index selection (out-of-range silently ignored)
    selected = [];
    for (const idx of pickMode.indexes) {
      const item = afterScore[idx];
      if (item) {
        selected.push(item);
      }
    }
  } else if (pickMode.mode === "autoPick") {
    selected = afterScore.slice(0, pickMode.topN);
  } else {
    // filter mode
    const re = new RegExp(pickMode.regex, "i");
    const matched = afterScore.filter((c) => re.test(c.keyword));
    selected = pickMode.topN != null ? matched.slice(0, pickMode.topN) : matched;
  }

  // 5) Deduplicate by keyword
  const seen = new Set<string>();
  const deduped: SeedCandidate[] = [];
  for (const s of selected) {
    if (seen.has(s.keyword)) continue;
    seen.add(s.keyword);
    deduped.push(s);
  }

  return deduped;
}
