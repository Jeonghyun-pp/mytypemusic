import type { NormalizedArticle } from "../feeds/normalize.js";
import { normalizeTopic } from "../../utils/normalize.js";
import { stripParticles } from "../../interpret/entities.js";

// ============================================================================
// Types
// ============================================================================

export type ScoredArticle = NormalizedArticle & {
  score: number;
  signals: string[];
};

// ============================================================================
// Category bonus tokens
// ============================================================================

const MUSIC_TOKENS = [
  "내한", "콘서트", "공연", "투어", "페스티벌", "라인업",
  "신곡", "앨범", "차트", "뮤직", "밴드",
];

const LIFE_TOKENS = [
  "여행", "맛집", "소비", "트렌드", "패션", "뷰티",
  "인테리어", "라이프", "건강", "계절", "추천",
];

const TOKEN_CAP = 3;
const FRESH_24H_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Scorer
// ============================================================================

/**
 * Score a single article against the seed keyword.
 *
 * Rules (deterministic, lightweight):
 *  - full seed in title (case-insensitive):   +8 (higher priority for exact match)
 *  - full seed in snippet:                    +4
 *  - partial seed words in title:            +2 per word (max +4)
 *  - partial seed words in snippet:           +1 per word (max +2)
 *  - category bonus tokens in title/snippet: +1 each (cap 3)
 *  - title < 8 chars:                        -2
 *  - publishedAt within last 24h:            +1
 */
export function scoreArticle(
  article: NormalizedArticle,
  seedKeyword: string,
  category?: "music" | "lifestyle",
): ScoredArticle {
  let score = 0;
  const signals: string[] = [];

  const seed = normalizeTopic(seedKeyword).toLowerCase();
  const titleLower = article.title.toLowerCase();
  const snippetLower = (article.snippet ?? "").toLowerCase();

  // Split seed into words for partial matching
  const seedWords = seed.split(/\s+/).filter((w) => w.length > 1); // Filter out single chars

  // Full seed in title (highest priority)
  if (titleLower.includes(seed)) {
    score += 8;
    signals.push("seed_in_title");
  } else if (seedWords.length > 1) {
    // Partial match: count how many seed words appear in title
    let matchedWords = 0;
    for (const word of seedWords) {
      if (titleLower.includes(word)) {
        matchedWords++;
      }
    }
    if (matchedWords > 0) {
      const partialScore = Math.min(matchedWords * 2, 4); // Max +4 for partial match
      score += partialScore;
      signals.push(`seed_partial_title:${matchedWords}/${seedWords.length}`);
    }
  }

  // Full seed in snippet
  if (snippetLower.includes(seed)) {
    score += 4;
    signals.push("seed_in_snippet");
  } else if (seedWords.length > 1) {
    // Partial match in snippet
    let matchedWords = 0;
    for (const word of seedWords) {
      if (snippetLower.includes(word)) {
        matchedWords++;
      }
    }
    if (matchedWords > 0) {
      const partialScore = Math.min(matchedWords, 2); // Max +2 for partial match
      score += partialScore;
      signals.push(`seed_partial_snippet:${matchedWords}/${seedWords.length}`);
    }
  }

  // Category bonus tokens
  const tokens = category === "lifestyle" ? LIFE_TOKENS : MUSIC_TOKENS;
  let tokenBonus = 0;
  for (const tok of tokens) {
    if (tokenBonus >= TOKEN_CAP) break;
    if (titleLower.includes(tok) || snippetLower.includes(tok)) {
      tokenBonus++;
      signals.push(`token:${tok}`);
    }
  }
  score += tokenBonus;

  // Short title penalty
  if (article.title.length < 8) {
    score -= 2;
    signals.push("too_short_title");
  }

  // Freshness bonus
  if (article.publishedAt) {
    const pub = new Date(article.publishedAt).getTime();
    if (!isNaN(pub) && Date.now() - pub < FRESH_24H_MS) {
      score += 1;
      signals.push("fresh_24h");
    }
  }

  // Engagement metrics bonus (YouTube, Instagram, etc.)
  if (article.metrics) {
    const { views, likes, comments } = article.metrics;
    // Views: log-scale bonus, cap +4
    if (views != null && views > 0) {
      const viewBonus = Math.min(Math.floor(Math.log10(views)) - 2, 4); // 1K→+1, 10K→+2, 100K→+3, 1M→+4
      if (viewBonus > 0) {
        score += viewBonus;
        signals.push(`views:${views}→+${viewBonus}`);
      }
    }
    // Likes: log-scale bonus, cap +2
    if (likes != null && likes > 0) {
      const likeBonus = Math.min(Math.floor(Math.log10(likes)) - 1, 2); // 100→+1, 1K→+2
      if (likeBonus > 0) {
        score += likeBonus;
        signals.push(`likes:${likes}→+${likeBonus}`);
      }
    }
    // Comments: flat bonus for active discussion
    if (comments != null && comments >= 50) {
      score += 1;
      signals.push(`comments:${comments}→+1`);
    }
  }

  return { ...article, score, signals };
}

// ============================================================================
// Entity-Salience Scorer (Step 5)
// ============================================================================

/**
 * Entity-salience based scoring.
 *
 * Implements Google Research entity salience concepts + BM25F field weighting.
 * REGENT (SIGIR-AP 2025): entity-aware scoring is ~5.7x more impactful than BM25.
 *
 * Rules:
 *  [Entity Salience — core]
 *   Entity in title:    +8 per entity  (BM25F title weight 5x)
 *   Entity in snippet:  +3 per entity  (BM25F body weight 1x)
 *   Multi-entity bonus: +3             (2+ entities co-present)
 *
 *  [Primary Topic — secondary]
 *   seedKeyword in title:   +3
 *   seedKeyword in snippet: +1
 *
 *  [Category Token — weak secondary]
 *   Category tokens:  +1 ea (cap 2)
 *
 *  [Quality/Freshness]
 *   Short title (<8):   -2
 *   Fresh 24h:          +1
 *   Engagement metrics:  same as base scorer
 *
 *  [Hard Filter]
 *   Entity match 0 → score capped at max(score, 2)
 */
export function scoreArticleWithEntities(
  article: NormalizedArticle,
  seedKeyword: string,
  entities: string[],
  category?: "music" | "lifestyle",
): ScoredArticle {
  let score = 0;
  const signals: string[] = [];

  const titleLower = article.title.toLowerCase();
  const snippetLower = (article.snippet ?? "").toLowerCase();

  // Strip particles from title/snippet tokens for matching
  const titleTokensStripped = titleLower
    .split(/\s+/)
    .map((t) => stripParticles(t));
  const snippetTokensStripped = snippetLower
    .split(/\s+/)
    .map((t) => stripParticles(t));

  const titleJoined = titleTokensStripped.join(" ");
  const snippetJoined = snippetTokensStripped.join(" ");

  // ── Entity Salience ──
  let entityMatchCount = 0;

  for (const entity of entities) {
    const entityLower = entity.toLowerCase();
    const entityStripped = stripParticles(entityLower);

    // Entity in title (+8)
    if (titleLower.includes(entityLower) || titleJoined.includes(entityStripped)) {
      score += 8;
      entityMatchCount++;
      signals.push(`entity_title:${entity}`);
    }
    // Entity in snippet (+3)
    else if (snippetLower.includes(entityLower) || snippetJoined.includes(entityStripped)) {
      score += 3;
      entityMatchCount++;
      signals.push(`entity_snippet:${entity}`);
    }
  }

  // Multi-entity co-presence bonus (+3)
  if (entityMatchCount >= 2) {
    score += 3;
    signals.push(`multi_entity:${String(entityMatchCount)}`);
  }

  // ── Primary Topic (seedKeyword) ──
  const seed = normalizeTopic(seedKeyword).toLowerCase();

  if (titleLower.includes(seed)) {
    score += 3;
    signals.push("seed_in_title");
  } else if (snippetLower.includes(seed)) {
    score += 1;
    signals.push("seed_in_snippet");
  }

  // ── Category Tokens (cap 2, reduced from 3) ──
  const ENTITY_TOKEN_CAP = 2;
  const tokens = category === "lifestyle" ? LIFE_TOKENS : MUSIC_TOKENS;
  let tokenBonus = 0;
  for (const tok of tokens) {
    if (tokenBonus >= ENTITY_TOKEN_CAP) break;
    if (titleLower.includes(tok) || snippetLower.includes(tok)) {
      tokenBonus++;
      signals.push(`token:${tok}`);
    }
  }
  score += tokenBonus;

  // ── Short title penalty ──
  if (article.title.length < 8) {
    score -= 2;
    signals.push("too_short_title");
  }

  // ── Freshness bonus ──
  if (article.publishedAt) {
    const pub = new Date(article.publishedAt).getTime();
    if (!isNaN(pub) && Date.now() - pub < FRESH_24H_MS) {
      score += 1;
      signals.push("fresh_24h");
    }
  }

  // ── Engagement metrics ──
  if (article.metrics) {
    const { views, likes, comments } = article.metrics;
    if (views != null && views > 0) {
      const viewBonus = Math.min(Math.floor(Math.log10(views)) - 2, 4);
      if (viewBonus > 0) {
        score += viewBonus;
        signals.push(`views:${String(views)}→+${String(viewBonus)}`);
      }
    }
    if (likes != null && likes > 0) {
      const likeBonus = Math.min(Math.floor(Math.log10(likes)) - 1, 2);
      if (likeBonus > 0) {
        score += likeBonus;
        signals.push(`likes:${String(likes)}→+${String(likeBonus)}`);
      }
    }
    if (comments != null && comments >= 50) {
      score += 1;
      signals.push(`comments:${String(comments)}→+1`);
    }
  }

  // ── Hard Filter: 0 entity matches → cap score at 2 ──
  if (entityMatchCount === 0) {
    score = Math.min(score, 2);
    signals.push("no_entity_match→cap2");
  }

  return { ...article, score, signals };
}
