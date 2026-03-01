// ============================================================================
// Token extraction for guardrail comparison
// ============================================================================

// --- Numbers ---
// Matches: 1,000 / 1000 / 12.34 / 3% / 3만 / 100억 / 50달러 etc.
const NUMBER_PATTERN =
  /\d[\d,]*\.?\d*\s*(?:%|만|억|천|명|원|달러|곡|위|장|회|개|편)?/g;

export function extractNumbers(text: string): string[] {
  return Array.from(text.matchAll(NUMBER_PATTERN), (m) => m[0].trim());
}

// --- Dates / Times ---
// YYYY-MM-DD, YYYY.MM.DD, M월 D일, M/D, HH:MM
const DATE_PATTERNS = [
  /\d{4}[-.\\/]\d{1,2}[-.\\/]\d{1,2}/g, // 2026-02-16, 2026.02.16
  /\d{1,2}월\s*\d{1,2}일/g, // 2월 16일
  /\d{1,2}\/\d{1,2}/g, // 3/9
  /\d{1,2}:\d{2}/g, // 19:00
  /\d{4}년/g, // 2026년
];

export function extractDates(text: string): string[] {
  const results: string[] = [];
  for (const pattern of DATE_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    for (const m of text.matchAll(pattern)) {
      results.push(m[0].trim());
    }
  }
  return results;
}

// --- Proper noun heuristic ---

const KOREAN_STOPWORDS = new Set([
  "오늘", "요즘", "정보", "정리", "추천", "핵심", "출처",
  "관련", "최근", "이번", "해당", "내용", "대한", "위한",
  "통해", "대해", "것으로", "으로", "에서", "하는", "있는",
  "없는", "된다", "한다", "이다", "있다", "없다", "했다",
  "됐다", "같은", "모든", "여러", "다른", "새로운", "가장",
  "함께", "따르면", "이후", "부터", "까지", "사이", "중에",
  "위해", "보인다", "알려졌다", "전했다", "밝혔다", "나타났다",
]);

// English: starts with uppercase, 2-20 chars
const ENGLISH_PROPER_PATTERN = /[A-Z][a-zA-Z0-9]{1,19}/g;

// Korean: 2-20 consecutive Hangul characters
const KOREAN_TOKEN_PATTERN = /[가-힣]{2,20}/g;

export function extractProperNounsHeuristic(text: string): string[] {
  const results: string[] = [];

  // English proper nouns
  for (const m of text.matchAll(ENGLISH_PROPER_PATTERN)) {
    results.push(m[0]);
  }

  // Korean tokens (filter stopwords)
  for (const m of text.matchAll(KOREAN_TOKEN_PATTERN)) {
    if (!KOREAN_STOPWORDS.has(m[0])) {
      results.push(m[0]);
    }
  }

  return results;
}

// --- Normalization ---

export function normalizeToken(t: string): string {
  return t
    .trim()
    .replace(/^[^\w가-힣]+|[^\w가-힣]+$/g, "") // strip leading/trailing symbols
    .replace(/,/g, "") // remove commas (number formatting)
    .toLowerCase();
}
