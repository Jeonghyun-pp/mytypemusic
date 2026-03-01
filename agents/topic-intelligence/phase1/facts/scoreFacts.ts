import type { BodyFactCandidate } from "./extractFromBody.js";
import { normalizeTopic } from "../../utils/normalize.js";

// ============================================================================
// Types
// ============================================================================

export type ScoredBodyFact = BodyFactCandidate & {
  score: number;
  signals: string[];
};

// ============================================================================
// Main
// ============================================================================

/**
 * Score a body fact candidate using deterministic rules.
 *
 * Rules:
 * - seedKeyword (or normalized) in text: +4 (seed_in_fact)
 * - hasNumber: +2 (num)
 * - hasDate: +2 (date)
 * - hasQuote: +1 (quote)
 * - category match: music+hasMusicSignals or lifestyle+hasLifeSignals: +2
 * - length 40~110: +1 (good_len)
 * - length >120: -1 (too_long)
 */
export function scoreBodyFact(
  fact: BodyFactCandidate,
  seedKeyword: string,
  category?: "music" | "lifestyle",
): ScoredBodyFact {
  let score = 0;
  const signals: string[] = [];

  // seed keyword match
  const normalized = normalizeTopic(seedKeyword);
  const textLower = fact.text.toLowerCase();
  if (
    textLower.includes(seedKeyword.toLowerCase()) ||
    textLower.includes(normalized.toLowerCase())
  ) {
    score += 4;
    signals.push("seed_in_fact");
  }

  // number
  if (fact.features.hasNumber) {
    score += 2;
    signals.push("num");
  }

  // date
  if (fact.features.hasDate) {
    score += 2;
    signals.push("date");
  }

  // quote
  if (fact.features.hasQuote) {
    score += 1;
    signals.push("quote");
  }

  // category signals
  if (category === "music" && fact.features.hasMusicSignals) {
    score += 2;
    signals.push("music_signal");
  }
  if (category === "lifestyle" && fact.features.hasLifeSignals) {
    score += 2;
    signals.push("life_signal");
  }

  // length bonus/penalty
  const len = fact.features.length;
  if (len >= 40 && len <= 110) {
    score += 1;
    signals.push("good_len");
  } else if (len > 120) {
    score -= 1;
    signals.push("too_long");
  }

  return { ...fact, score, signals };
}
