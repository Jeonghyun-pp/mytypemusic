import type {
  TopicRequest,
  TopicCategory,
  TopicDepth,
} from "../contracts.js";
import { normalizeTopic } from "../utils/normalize.js";
import { parseTopicRequest } from "../schema.js";
import { DEFAULTS } from "./defaults.js";
import { extractEntities } from "./entities.js";

// ============================================================================
// Keyword lists for inference
// ============================================================================

const MUSIC_CUES = [
  "밴드", "내한", "콘서트", "공연", "투어", "신곡",
  "앨범", "차트", "페스티벌", "라인업",
];

const LIFESTYLE_CUES = [
  "여행", "맛집", "소비", "계절", "패션", "뷰티",
  "라이프", "인테리어", "건강", "트렌드",
];

const NEWS_CUES = ["속보", "발표", "공개", "확정", "일정"];
const ANALYSIS_CUES = ["분석", "전망", "영향", "배경", "논란"];
const EXPLAINER_CUES = ["정리", "설명", "가이드", "쉽게"];

// ============================================================================
// Inference helpers
// ============================================================================

function containsAny(text: string, cues: string[]): boolean {
  return cues.some((c) => text.includes(c));
}

function inferCategory(text: string): TopicCategory | undefined {
  const hasMusic = containsAny(text, MUSIC_CUES);
  const hasLifestyle = containsAny(text, LIFESTYLE_CUES);
  if (hasMusic && !hasLifestyle) return "music";
  if (hasLifestyle && !hasMusic) return "lifestyle";
  // ambiguous or no match → undefined (falls back to override or default omission)
  return undefined;
}

function inferDepth(text: string): TopicDepth | undefined {
  if (containsAny(text, NEWS_CUES)) return "news";
  if (containsAny(text, ANALYSIS_CUES)) return "analysis";
  if (containsAny(text, EXPLAINER_CUES)) return "explainer";
  return undefined;
}

// ============================================================================
// Seed keyword extraction
// ============================================================================

/**
 * Extract seed keyword from a natural-language prompt.
 *
 * Priority:
 *  1. Quoted substring: first "..." or '...' match
 *  2. Remove common stop words and extract meaningful keywords
 *  3. First sentence (split on . or newline), truncated to 50 chars
 */
function extractSeedKeyword(prompt: string): string {
  // 1) Try quoted substring
  const quoteMatch = /["'\u201C\u2018]([^"'\u201D\u2019]+)["'\u201D\u2019]/.exec(prompt);
  if (quoteMatch?.[1]) {
    return quoteMatch[1].trim();
  }

  // 2) Remove common stop words and extract meaningful parts
  const stopWords = ["최근", "활동", "소식", "정리", "해줘", "요약", "알려줘", "보여줘"];
  let cleaned = prompt.trim();
  
  // Remove trailing stop words
  for (const stop of stopWords) {
    const regex = new RegExp(`\\s*${stop}\\s*$`, "i");
    cleaned = cleaned.replace(regex, "").trim();
  }
  
  // 3) First sentence (split on period or newline)
  const firstSentence = cleaned.split(/[.\n]/)[0] ?? cleaned;
  const trimmed = firstSentence.trim();
  // Increased limit to 50 chars to preserve compound keywords like "밴드 터치드"
  if (trimmed.length <= 50) return trimmed;
  return trimmed.slice(0, 50).trim();
}

// ============================================================================
// Main builder
// ============================================================================

/**
 * Build a TopicRequest from a natural-language prompt.
 *
 * 1. Extracts seedKeyword from prompt (quoted text preferred)
 * 2. Infers category/depth from keyword cues
 * 3. Merges: DEFAULTS < inferred < overrides
 * 4. Normalizes seedKeyword via normalizeTopic
 * 5. Validates via parseTopicRequest (throws on bad input)
 */
export function buildTopicRequestFromPrompt(
  prompt: string,
  overrides?: Partial<TopicRequest>,
): TopicRequest {
  // Extract entities from prompt for multi-query search
  const entities = extractEntities(prompt);

  // Use primaryTopic as seed (falls back to legacy extractSeedKeyword if empty)
  const rawSeed = entities.primaryTopic || extractSeedKeyword(prompt);
  const seedKeyword = normalizeTopic(rawSeed);

  const inferredCategory = inferCategory(prompt);
  const inferredDepth = inferDepth(prompt);

  const raw: Record<string, unknown> = {
    mode: DEFAULTS.mode,
    seedKeyword,
    region: DEFAULTS.region,
    depth: inferredDepth ?? DEFAULTS.depth,
    maxArticles: DEFAULTS.maxArticles,
    recencyDays: DEFAULTS.recencyDays,
  };

  // Inferred category only applied if present
  if (inferredCategory) {
    raw.category = inferredCategory;
  }

  // Attach extracted entities for multi-query search
  if (entities.entities.length > 0) {
    raw.searchEntities = entities.entities;
  }

  // Overrides take highest priority
  if (overrides) {
    for (const [key, val] of Object.entries(overrides)) {
      if (val !== undefined) {
        raw[key] = val;
      }
    }
  }

  return parseTopicRequest(raw);
}
