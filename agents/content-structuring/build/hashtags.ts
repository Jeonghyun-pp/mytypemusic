import type { TopicIntelInput } from "../contracts.js";

// ============================================================================
// Constants
// ============================================================================

const MUSIC_BASE_TAGS = [
  "#음악",
  "#콘서트",
  "#페스티벌",
  "#신곡",
  "#공연",
];

const LIFESTYLE_BASE_TAGS = [
  "#라이프스타일",
  "#트렌드",
  "#일상",
  "#추천",
  "#정보",
];

const COMMON_TAGS = ["#카드뉴스", "#오늘의정보"];

const MAX_HASHTAGS = 15;
const MIN_HASHTAGS = 10;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract meaningful Korean/English tokens from a string for hashtag use.
 * Filters out very short tokens and common particles.
 */
const KOREAN_PARTICLES = new Set([
  "의", "가", "이", "은", "는", "을", "를", "에", "와", "과",
  "로", "으로", "에서", "까지", "부터", "도", "만", "밖에",
]);

function extractHashtagTokens(text: string): string[] {
  // Split on whitespace and punctuation
  const raw = text.split(/[\s,.\-_/()[\]{}'"!?:;·。，]+/);

  return raw
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .filter((t) => !KOREAN_PARTICLES.has(t))
    .filter((t) => !/^\d+$/.test(t)); // exclude pure numbers
}

// ============================================================================
// Main
// ============================================================================

/**
 * Build hashtags from TopicIntelInput.
 *
 * Rules:
 * - Category base tags (music or lifestyle)
 * - Common tags
 * - normalizedTopic → hashtag
 * - Top keywords from angleCandidates → hashtags
 * - Limit 10~15, deduplicated
 */
export function buildHashtags(intel: TopicIntelInput): string[] {
  const category = intel.category === "music" ? "music" : "lifestyle";
  const baseTags =
    category === "music" ? MUSIC_BASE_TAGS : LIFESTYLE_BASE_TAGS;

  const tags = new Set<string>();

  // 1) Topic hashtag
  const topicTag = `#${intel.normalizedTopic.replace(/\s+/g, "")}`;
  if (topicTag.length > 1 && topicTag.length <= 30) {
    tags.add(topicTag);
  }

  // 2) Base tags
  for (const tag of baseTags) {
    tags.add(tag);
  }

  // 3) Common tags
  for (const tag of COMMON_TAGS) {
    tags.add(tag);
  }

  // 4) Angle-derived tags (from angleCandidates)
  for (const angle of intel.angleCandidates.slice(0, 3)) {
    const tokens = extractHashtagTokens(angle);
    for (const token of tokens.slice(0, 2)) {
      const tag = `#${token}`;
      if (tag.length <= 20) {
        tags.add(tag);
      }
      if (tags.size >= MAX_HASHTAGS) break;
    }
    if (tags.size >= MAX_HASHTAGS) break;
  }

  // 5) Image query derived tags
  if (tags.size < MIN_HASHTAGS) {
    for (const query of intel.imageQueries.slice(0, 3)) {
      const tokens = extractHashtagTokens(query);
      for (const token of tokens.slice(0, 1)) {
        const tag = `#${token}`;
        if (tag.length <= 20) {
          tags.add(tag);
        }
        if (tags.size >= MAX_HASHTAGS) break;
      }
      if (tags.size >= MAX_HASHTAGS) break;
    }
  }

  return [...tags].slice(0, MAX_HASHTAGS);
}
