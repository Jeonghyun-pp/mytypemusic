import type {
  TopicIntelInput,
  ContentSlide,
  ContentCreditsSource,
} from "../contracts.js";

// ============================================================================
// Constants
// ============================================================================

const MAX_FACT_SLIDES = 5;
const MAX_HEADLINE_LENGTH = 40;
const MAX_CREDITS_SOURCES = 6;
const MIN_CREDITS_SOURCES = 3;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Truncate text to maxLen with "…" if needed.
 */
function truncate(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen - 1) + "…";
}

/**
 * Extract number/date patterns from text as bullet candidates.
 */
const NUMBER_DATE_PATTERN =
  /(?:\d{4}[\.\-\/년]\s*\d{1,2}[\.\-\/월]\s*\d{1,2}일?|\d+[\.,]?\d*\s*(?:만|억|천|명|원|달러|%|곡|위|장|회|개|편))/g;

function extractNumberDateBullets(text: string): string[] {
  const matches = text.match(NUMBER_DATE_PATTERN);
  if (!matches) return [];

  // Expand matches to include surrounding context (up to 30 chars)
  const bullets: string[] = [];
  for (const m of matches) {
    const idx = text.indexOf(m);
    if (idx < 0) continue;

    // Find sentence boundary or take surrounding context
    const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, idx - 15)));
    const end = Math.min(text.length, text.indexOf(" ", idx + m.length + 15));
    const snippet = text.slice(
      start === 0 ? 0 : start + 1,
      end < 0 ? text.length : end,
    ).trim();

    if (snippet.length >= 3) {
      bullets.push(snippet);
    }
  }

  return bullets.slice(0, 3);
}

/**
 * Extract keyword-based bullets from text when no number/date patterns found.
 */
function extractKeywordBullets(text: string): string[] {
  // Split by common Korean sentence delimiters
  const parts = text.split(/[,，.。·;；\n]/).map((s) => s.trim()).filter((s) => s.length >= 4);

  if (parts.length >= 2) {
    return parts.slice(0, 3);
  }

  // Fallback: split by spaces and group into meaningful chunks
  const tokens = text.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length <= 4) {
    return [text.trim()];
  }

  // Split tokens into 2-3 roughly equal groups
  const groupSize = Math.ceil(tokens.length / 3);
  const bullets: string[] = [];
  for (let i = 0; i < tokens.length && bullets.length < 3; i += groupSize) {
    const group = tokens.slice(i, i + groupSize).join(" ");
    if (group.length >= 3) {
      bullets.push(group);
    }
  }

  return bullets;
}

/**
 * Build 2-3 bullets from a fact text (rule-based).
 */
export function buildBulletsFromFact(text: string): string[] {
  // 1) Try number/date extraction first
  const numBullets = extractNumberDateBullets(text);
  if (numBullets.length >= 2) {
    return numBullets;
  }

  // 2) Fallback: keyword-based
  return extractKeywordBullets(text);
}

// ============================================================================
// Slide builders
// ============================================================================

function buildCoverSlide(
  title: string,
  subtitle: string | undefined,
): ContentSlide {
  return {
    kind: "cover",
    headline: title,
    note: subtitle,
  };
}

function buildFactSlide(
  fact: { text: string; evidenceUrls: string[] },
): ContentSlide {
  const headline = truncate(fact.text, MAX_HEADLINE_LENGTH);
  const bullets = buildBulletsFromFact(fact.text);
  const evidenceUrls =
    fact.evidenceUrls.length > 0
      ? fact.evidenceUrls.slice(0, 3)
      : undefined;

  return {
    kind: "fact",
    headline,
    bullets: bullets.length > 0 ? bullets : undefined,
    evidenceUrls,
  };
}

function buildSummarySlide(
  facts: Array<{ text: string }>,
): ContentSlide {
  const bullets = facts.slice(0, 3).map((f) => truncate(f.text, 50));

  return {
    kind: "summary",
    headline: "핵심만 정리",
    bullets,
  };
}

function buildCreditsSlide(
  sources: ContentCreditsSource[],
): ContentSlide {
  const display = sources.slice(0, MAX_CREDITS_SOURCES);
  const bullets = display.map((s) => {
    const pub = s.publisher ? `[${s.publisher}]` : "";
    return `${pub} ${s.title}`.trim();
  });

  return {
    kind: "credits",
    headline: "출처",
    bullets,
  };
}

function buildCtaSlide(): ContentSlide {
  return {
    kind: "cta",
    headline: "유익했다면 저장 & 공유",
    note: "팔로우하면 매일 새 소식을 받을 수 있어요",
  };
}

// ============================================================================
// Main: assemble slides
// ============================================================================

/**
 * Build 6~8 slides from TopicIntelInput.
 *
 * Structure:
 *   1) cover
 *   2~6) fact (up to 5 from keyFacts)
 *   7) summary
 *   8) credits
 *   (optional) cta — added when facts >= 3
 */
export function buildSlides(
  intel: TopicIntelInput,
  title: string,
  subtitle: string | undefined,
): { slides: ContentSlide[]; creditsSources: ContentCreditsSource[] } {
  const slides: ContentSlide[] = [];

  // 1) Cover
  slides.push(buildCoverSlide(title, subtitle));

  // 2~6) Fact slides
  const factsToUse = intel.keyFacts.slice(0, MAX_FACT_SLIDES);
  for (const fact of factsToUse) {
    slides.push(buildFactSlide(fact));
  }

  // 7) Summary
  if (factsToUse.length >= 2) {
    slides.push(buildSummarySlide(factsToUse));
  }

  // CTA (optional, when we have enough facts)
  if (factsToUse.length >= 3) {
    slides.push(buildCtaSlide());
  }

  // Credits sources
  const creditsSources: ContentCreditsSource[] = intel.sources
    .slice(0, Math.max(MIN_CREDITS_SOURCES, Math.min(MAX_CREDITS_SOURCES, intel.sources.length)))
    .map((s) => ({
      title: s.title,
      url: s.url,
      publisher: s.publisher,
      publishedAt: s.publishedAt,
    }));

  // 8) Credits slide
  slides.push(buildCreditsSlide(creditsSources));

  return { slides, creditsSources };
}
