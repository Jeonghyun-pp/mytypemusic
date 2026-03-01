// ============================================================================
// Types
// ============================================================================

export type BodyFactCandidate = {
  text: string;
  sourceIdx: number;
  url: string;
  features: {
    hasNumber: boolean;
    hasDate: boolean;
    hasQuote: boolean;
    hasMusicSignals: boolean;
    hasLifeSignals: boolean;
    length: number;
  };
};

export type ExtractBodyFactsOptions = {
  maxPerArticle?: number; // default 6
  minLen?: number; // default 30
  maxLen?: number; // default 140
};

// ============================================================================
// Constants
// ============================================================================

const NOISE_PATTERNS = [
  "기자",
  "무단 전재",
  "구독",
  "광고",
  "관련기사",
  "저작권",
  "뉴스레터",
  "제보",
  "댓글",
  "공유하기",
  "카카오톡",
  "페이스북",
  "트위터",
  "인스타그램",
  "All rights reserved",
  "Copyright",
  "©",
];

const MUSIC_SIGNALS = [
  "콘서트",
  "공연",
  "투어",
  "앨범",
  "신곡",
  "발매",
  "라인업",
  "페스티벌",
  "내한",
  "차트",
];

const LIFE_SIGNALS = [
  "여행",
  "맛집",
  "가격",
  "할인",
  "신상",
  "출시",
  "트렌드",
  "패션",
  "뷰티",
  "인테리어",
  "건강",
  "계절",
];

// ============================================================================
// Helpers
// ============================================================================

const DATE_RE =
  /(\d{1,2}월\s*\d{1,2}일)|(\d{4}년)|(\d{1,2}일)|(\d{1,2}시)/;

const QUOTE_RE = /"|"|"|'|인터뷰|밝혔다|말했다/;

function isNoiseSentence(s: string): boolean {
  const lower = s.toLowerCase();
  return NOISE_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

function detectFeatures(
  text: string,
  category?: "music" | "lifestyle",
): BodyFactCandidate["features"] {
  return {
    hasNumber: /\d/.test(text),
    hasDate: DATE_RE.test(text),
    hasQuote: QUOTE_RE.test(text),
    hasMusicSignals:
      category === "music" || !category
        ? MUSIC_SIGNALS.some((s) => text.includes(s))
        : false,
    hasLifeSignals:
      category === "lifestyle" || !category
        ? LIFE_SIGNALS.some((s) => text.includes(s))
        : false,
    length: text.length,
  };
}

/** Count how many feature flags are true. */
function featureCount(f: BodyFactCandidate["features"]): number {
  let c = 0;
  if (f.hasNumber) c++;
  if (f.hasDate) c++;
  if (f.hasQuote) c++;
  if (f.hasMusicSignals) c++;
  if (f.hasLifeSignals) c++;
  return c;
}

/**
 * Split text into sentences using Korean/English mixed rules.
 * 1) Split by newlines into blocks
 * 2) Split each block by ". ", "다.", "요.", "!", "?"
 */
function splitSentences(text: string): string[] {
  const blocks = text.split(/\n+/);
  const sentences: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.length === 0) continue;

    // Split on sentence-ending patterns
    const parts = trimmed.split(/(?<=다\.|요\.\s|\.\s|!|\?)\s*/);
    for (const part of parts) {
      const s = part.trim();
      if (s.length > 0) {
        sentences.push(s);
      }
    }
  }

  return sentences;
}

// ============================================================================
// Main
// ============================================================================

/**
 * Extract sentence-level fact candidates from article body text.
 *
 * - Splits text into sentences (Korean/English mixed rules)
 * - Filters by length + noise patterns
 * - Detects features (number, date, quote, category signals)
 * - Returns top-N by feature count
 */
export function extractSentenceCandidatesFromBody(
  params: {
    text: string;
    sourceIdx: number;
    url: string;
    category?: "music" | "lifestyle";
  },
  opts?: ExtractBodyFactsOptions,
): BodyFactCandidate[] {
  const maxPerArticle = opts?.maxPerArticle ?? 6;
  const minLen = opts?.minLen ?? 30;
  const maxLen = opts?.maxLen ?? 140;

  // 1) Split into sentences
  const sentences = splitSentences(params.text);

  // 2) Filter by length + noise
  const filtered: Array<{ text: string }> = [];
  for (const s of sentences) {
    if (s.length < minLen || s.length > maxLen) continue;
    if (isNoiseSentence(s)) continue;
    filtered.push({ text: s });
  }

  // 3) Detect features and build candidates
  const candidates: BodyFactCandidate[] = filtered.map((f) => ({
    text: f.text,
    sourceIdx: params.sourceIdx,
    url: params.url,
    features: detectFeatures(f.text, params.category),
  }));

  // 4) Sort by feature count desc, then by length desc (prefer richer sentences)
  candidates.sort((a, b) => {
    const fc = featureCount(b.features) - featureCount(a.features);
    if (fc !== 0) return fc;
    return b.features.length - a.features.length;
  });

  // 5) Return top-N
  return candidates.slice(0, maxPerArticle);
}
