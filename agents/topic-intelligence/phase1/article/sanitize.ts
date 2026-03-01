// ============================================================================
// Types
// ============================================================================

export type SanitizeResult = {
  text: string;
  length: number;
  removedLines: number;
};

// ============================================================================
// Noise patterns
// ============================================================================

const NOISE_PATTERNS = [
  "무단 전재",
  "재배포 금지",
  "Copyright",
  "copyright",
  "ⓒ",
  "뉴스레터",
  "구독",
  "기사제보",
  "기사 제보",
  "제보하기",
  "All rights reserved",
  "all rights reserved",
  "무단전재",
  "저작권자",
  "기자 =",
  "특파원 =",
];

// ============================================================================
// Main
// ============================================================================

/**
 * Sanitize extracted plain text.
 *
 * - Decode common HTML entities
 * - Normalize whitespace
 * - Remove noise lines (copyright, ads, footer)
 * - Collapse excessive blank lines
 */
export function sanitizePlainText(input: string): SanitizeResult {
  let text = input;

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // Remove \r
  text = text.replace(/\r/g, "");

  // Process line by line
  const lines = text.split("\n");
  const kept: string[] = [];
  let removedLines = 0;

  for (const rawLine of lines) {
    // Collapse consecutive spaces within line
    const line = rawLine.replace(/ {2,}/g, " ").trim();

    // Check noise patterns
    let isNoise = false;
    for (const pattern of NOISE_PATTERNS) {
      if (line.includes(pattern)) {
        isNoise = true;
        break;
      }
    }

    if (isNoise) {
      removedLines++;
      continue;
    }

    kept.push(line);
  }

  // Collapse 3+ consecutive blank lines to 2
  let result = kept.join("\n");
  result = result.replace(/\n{3,}/g, "\n\n");

  result = result.trim();

  return {
    text: result,
    length: result.length,
    removedLines,
  };
}
