import type { TrendsSeed } from "./client.js";

// ============================================================================
// Types
// ============================================================================

export type SeedCategory = "music" | "lifestyle" | "unknown";

export type SeedCandidate = {
  keyword: string;
  category: SeedCategory;
  score: number; // 0~100
  reasons: string[];
  source: TrendsSeed["source"];
  traffic?: number;
};

// ============================================================================
// Category inference
// ============================================================================

const MUSIC_KEYWORDS = [
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
  "음원",
  "뮤직",
  "가수",
  "아이돌",
  "방탄",
  "BTS",
  "블랙핑크",
  "아이브",
  "뉴진스",
  "에스파",
  "컴백",
  "데뷔",
  "빌보드",
  "그래미",
  "뮤비",
  "MV",
  "음악",
  "밴드",
  "래퍼",
  "힙합",
  "K-POP",
  "케이팝",
];

const LIFESTYLE_KEYWORDS = [
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
  "카페",
  "호텔",
  "리조트",
  "레시피",
  "다이어트",
  "운동",
  "필라테스",
  "요가",
  "피부",
  "화장품",
  "브랜드",
  "신발",
  "의류",
  "쇼핑",
  "세일",
  "오픈런",
  "핫플",
  "전시",
];

/**
 * Categorize a seed keyword into music/lifestyle/unknown
 * based on keyword token matching.
 */
export function categorizeSeed(keyword: string): SeedCategory {
  const lower = keyword.toLowerCase();

  const musicHit = MUSIC_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
  const lifeHit = LIFESTYLE_KEYWORDS.some((k) =>
    lower.includes(k.toLowerCase()),
  );

  if (musicHit && !lifeHit) return "music";
  if (lifeHit && !musicHit) return "lifestyle";
  if (musicHit && lifeHit) return "music"; // music takes priority
  return "unknown";
}

// ============================================================================
// Generic / low-value keyword penalty
// ============================================================================

const GENERIC_KEYWORDS = [
  "날씨",
  "주식",
  "부동산",
  "정치",
  "선거",
  "코인",
  "비트코인",
  "환율",
  "금리",
  "경제",
  "국회",
  "대통령",
  "사고",
  "지진",
  "태풍",
  "로또",
];

function isGenericKeyword(keyword: string): boolean {
  const lower = keyword.toLowerCase();
  return GENERIC_KEYWORDS.some((g) => lower.includes(g.toLowerCase()));
}

// ============================================================================
// Scoring
// ============================================================================

/**
 * Score a seed candidate.
 *
 * Rules:
 * - base = 20
 * - traffic (log scale): +0~40
 * - source bonus: dailyTrends +10, realTimeTrends +15, relatedQueries +5
 * - category bonus: music/lifestyle +10, unknown +0
 * - generic keyword penalty: -30
 * - clamp 0..100
 */
export function scoreSeed(candidate: {
  keyword: string;
  category: SeedCategory;
  traffic?: number;
  source: TrendsSeed["source"];
}): SeedCandidate {
  let score = 20;
  const reasons: string[] = ["base:20"];

  // Traffic bonus (log scale, 0~40)
  if (candidate.traffic != null && candidate.traffic > 0) {
    // log10(1000)=3, log10(1000000)=6 → scale to 0..40
    const logVal = Math.log10(candidate.traffic);
    const trafficBonus = Math.min(Math.round(logVal * 8), 40);
    score += trafficBonus;
    reasons.push(`traffic:+${String(trafficBonus)}`);
  }

  // Source bonus
  if (candidate.source === "realTimeTrends") {
    score += 15;
    reasons.push("realtime:+15");
  } else if (candidate.source === "dailyTrends") {
    score += 10;
    reasons.push("daily:+10");
  } else {
    score += 5;
    reasons.push("related:+5");
  }

  // Category bonus
  if (candidate.category === "music" || candidate.category === "lifestyle") {
    score += 10;
    reasons.push(`cat_${candidate.category}:+10`);
  }

  // Generic penalty
  if (isGenericKeyword(candidate.keyword)) {
    score -= 30;
    reasons.push("generic:-30");
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  return {
    keyword: candidate.keyword,
    category: candidate.category,
    score,
    reasons,
    source: candidate.source,
    traffic: candidate.traffic,
  };
}
