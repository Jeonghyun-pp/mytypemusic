import {
  extractNumbers,
  extractDates,
  extractProperNounsHeuristic,
  normalizeToken,
} from "./extract.js";

// ============================================================================
// Types
// ============================================================================

export type CompareViolationType =
  | "number_changed"
  | "date_changed"
  | "entity_changed";

export type CompareViolation = {
  type: CompareViolationType;
  detail: string;
};

// ============================================================================
// Collect all text from a slide into a single string
// ============================================================================

export function collectSlideText(slide: {
  headline: string;
  bullets?: string[];
  note?: string;
}): string {
  const parts = [slide.headline];
  if (slide.bullets) {
    parts.push(...slide.bullets);
  }
  if (slide.note) {
    parts.push(slide.note);
  }
  return parts.join(" ");
}

// ============================================================================
// Diff: check that draft tokens are preserved in rewritten text
// ============================================================================

export function diffMustPreserve(params: {
  draftText: string;
  rewrittenText: string;
  strictness: "strong" | "weak";
}): { violations: CompareViolation[] } {
  const { draftText, rewrittenText, strictness } = params;
  const violations: CompareViolation[] = [];

  // --- Numbers ---
  const draftNumbers = extractNumbers(draftText);
  const rewrittenNumbersNorm = new Set(
    extractNumbers(rewrittenText).map(normalizeToken),
  );

  for (const num of draftNumbers) {
    const norm = normalizeToken(num);
    if (norm.length > 0 && !rewrittenNumbersNorm.has(norm)) {
      violations.push({
        type: "number_changed",
        detail: `Number "${num}" from draft is missing in rewritten text.`,
      });
    }
  }

  // --- Dates ---
  const draftDates = extractDates(draftText);
  const rewrittenDatesNorm = new Set(
    extractDates(rewrittenText).map(normalizeToken),
  );

  for (const d of draftDates) {
    const norm = normalizeToken(d);
    if (norm.length > 0 && !rewrittenDatesNorm.has(norm)) {
      violations.push({
        type: "date_changed",
        detail: `Date "${d}" from draft is missing in rewritten text.`,
      });
    }
  }

  // --- Entities (strong mode only) ---
  if (strictness === "strong") {
    const draftEntities = extractProperNounsHeuristic(draftText);
    const rewrittenTextNorm = normalizeToken(rewrittenText);

    // Deduplicate and take top 8 by frequency
    const freqMap = new Map<string, number>();
    for (const e of draftEntities) {
      const norm = normalizeToken(e);
      if (norm.length >= 3) {
        freqMap.set(norm, (freqMap.get(norm) ?? 0) + 1);
      }
    }

    const topEntities = Array.from(freqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([token]) => token);

    let missingCount = 0;
    const missingEntities: string[] = [];

    for (const entity of topEntities) {
      // Substring check: entity should appear somewhere in rewritten text
      if (!rewrittenTextNorm.includes(entity)) {
        missingCount++;
        missingEntities.push(entity);
      }
    }

    // Violation threshold: 2+ missing entities
    if (missingCount >= 2) {
      violations.push({
        type: "entity_changed",
        detail: `Entities missing in rewritten text: ${missingEntities.join(", ")}`,
      });
    }
  }

  return { violations };
}
