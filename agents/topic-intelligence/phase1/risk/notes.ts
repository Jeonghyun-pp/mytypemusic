// ============================================================================
// Types
// ============================================================================

export type RiskNotesInput = {
  seedKeyword: string;
  category?: "music" | "lifestyle";
  selectedCount: number;
  missingPublishedAtCount: number;
};

// ============================================================================
// Sensitive keyword lists
// ============================================================================

const POLITICS_KEYWORDS = ["대통령", "정치", "선거", "탄핵", "정당"];
const HATE_CRIME_KEYWORDS = ["혐오", "폭행", "살인", "마약", "범죄", "테러"];
const RUMOR_KEYWORDS = ["루머", "폭로", "논란", "의혹"];

const MAX_NOTES = 6;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if the seed keyword looks like it may contain a person's name.
 *
 * Simple heuristic: Korean 2–4 character sequences that look like proper names
 * (no spaces, all Hangul) OR known idol/artist name patterns.
 */
function mayContainPersonName(seed: string): boolean {
  // Split by whitespace and check each token
  const tokens = seed.split(/\s+/);
  for (const token of tokens) {
    // Korean name pattern: 2-4 consecutive Hangul characters, no other chars
    if (/^[가-힣]{2,4}$/.test(token)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// Main
// ============================================================================

/**
 * Generate rule-based risk notes for the topic.
 *
 * - Sensitive keyword detection (politics, hate/crime, rumor)
 * - Portrait rights warning for music topics with person names
 * - Missing data warnings
 * - Max 6 notes
 */
export function generateRiskNotes(input: RiskNotesInput): string[] {
  const notes: string[] = [];
  const seedLower = input.seedKeyword.toLowerCase();

  // Sensitive keyword checks
  for (const kw of POLITICS_KEYWORDS) {
    if (seedLower.includes(kw)) {
      notes.push(`Sensitive topic detected: political keyword "${kw}". Extra editorial review recommended.`);
      break;
    }
  }

  for (const kw of HATE_CRIME_KEYWORDS) {
    if (seedLower.includes(kw)) {
      notes.push(`Sensitive topic detected: hate/crime keyword "${kw}". Content may require careful framing.`);
      break;
    }
  }

  for (const kw of RUMOR_KEYWORDS) {
    if (seedLower.includes(kw)) {
      notes.push(`Rumor/controversy keyword "${kw}" detected. Verify facts before publishing.`);
      break;
    }
  }

  // Portrait rights warning for music category
  if (input.category === "music" && mayContainPersonName(input.seedKeyword)) {
    notes.push(
      "초상권/공식 이미지 사용 주의. 스톡/CC 우선.",
    );
  }

  // No articles selected
  if (input.selectedCount === 0) {
    notes.push(
      "No matching RSS sources/articles selected; output quality will be low.",
    );
  }

  // Missing publishedAt
  if (input.missingPublishedAtCount > 0) {
    notes.push(
      "Some sources missing publishedAt; recency filtering may be approximate.",
    );
  }

  return notes.slice(0, MAX_NOTES);
}
