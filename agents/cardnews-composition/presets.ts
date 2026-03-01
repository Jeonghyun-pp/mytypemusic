// ============================================================================
// Style Presets — category-based defaults for deck generation
// ============================================================================

import type { CoverVariationId } from "./selector.js";
import type { VariationId } from "./selector.js";
import type { FontMood } from "./fonts/registry.js";

export type StylePresetId =
  | "news"
  | "beauty"
  | "tech"
  | "lifestyle"
  | "finance"
  | "music"
  | "default";

export interface StylePreset {
  id: StylePresetId;
  fontMood?: FontMood;
  paletteId?: string;
  cover: {
    defaultVariation: CoverVariationId;
    titleSize?: number;
    scrimH?: number;
  };
  fact: {
    defaultVariation: VariationId;
    headlineLabel: string;
  };
  outro: {
    cta: string;
  };
}

export const STYLE_PRESETS: Record<StylePresetId, StylePreset> = {
  news: {
    id: "news",
    fontMood: "impact",
    paletteId: "monochrome",
    cover: { defaultVariation: "v1", titleSize: 68 },
    fact: { defaultVariation: "v1", headlineLabel: "핵심 뉴스" },
    outro: { cta: "저장하고 나중에 읽기 · 팔로우하면 매일 뉴스 도착" },
  },
  beauty: {
    id: "beauty",
    fontMood: "editorial",
    paletteId: "editorial",
    cover: { defaultVariation: "v2", titleSize: 52, scrimH: 360 },
    fact: { defaultVariation: "v3", headlineLabel: "뷰티 포인트" },
    outro: { cta: "저장해두고 따라하기 · 팔로우하고 트렌드 받기" },
  },
  tech: {
    id: "tech",
    fontMood: "clean-sans",
    paletteId: "monochrome",
    cover: { defaultVariation: "v1", titleSize: 64 },
    fact: { defaultVariation: "v2", headlineLabel: "핵심 스펙" },
    outro: { cta: "저장해두고 비교하기 · 팔로우하면 신제품 알림" },
  },
  lifestyle: {
    id: "lifestyle",
    fontMood: "editorial",
    paletteId: "warmVintage",
    cover: { defaultVariation: "v2", titleSize: 56, scrimH: 340 },
    fact: { defaultVariation: "v3", headlineLabel: "알아두면 좋은 것" },
    outro: { cta: "저장해두고 실천하기 · 팔로우하고 영감 받기" },
  },
  finance: {
    id: "finance",
    fontMood: "minimal",
    paletteId: "monochrome",
    cover: { defaultVariation: "v1", titleSize: 60 },
    fact: { defaultVariation: "v1", headlineLabel: "핵심 수치" },
    outro: { cta: "저장해두고 참고하기 · 팔로우하면 시장 리포트 도착" },
  },
  music: {
    id: "music",
    fontMood: "bold-display",
    cover: { defaultVariation: "v1", titleSize: 56, scrimH: 320 },
    fact: { defaultVariation: "v2", headlineLabel: "음악 포인트" },
    outro: { cta: "저장해두고 들어보기 · 팔로우하면 새 음악 소식 도착" },
  },
  default: {
    id: "default",
    fontMood: "bold-display",
    cover: { defaultVariation: "v1" },
    fact: { defaultVariation: "v1", headlineLabel: "핵심 포인트" },
    outro: { cta: "저장해두고 나중에 보기 · 팔로우하고 다음 편 받기" },
  },
};

const VALID_PRESET_IDS = Object.keys(STYLE_PRESETS) as StylePresetId[];

/**
 * Check if a string is a valid StylePresetId.
 */
export function isValidPresetId(id: string): id is StylePresetId {
  return VALID_PRESET_IDS.includes(id as StylePresetId);
}

/**
 * Pick a style preset based on topic category (simple rule-based mapping).
 *
 * Rules:
 *   - "celebrity" / "fashion" → "beauty"
 *   - "music" → "lifestyle"
 *   - "issue" → "news"
 *   - string contains "tech" / "ai" / "product" → "tech"
 *   - string contains "news" / "world" / "politics" → "news"
 *   - string contains "life" / "travel" / "culture" → "lifestyle"
 *   - string contains "beauty" / "fashion" / "cosmetic" → "beauty"
 *   - string contains "finance" / "economy" / "stock" → "finance"
 *   - fallback → "default"
 */
export function pickPresetByCategory(category: string): StylePresetId {
  const c = category.toLowerCase();

  // Exact matches for known TopicCategory enum values
  if (c === "celebrity" || c === "fashion") return "beauty";
  if (c === "music") return "music";
  if (c === "lifestyle") return "lifestyle";
  if (c === "issue") return "news";

  // Keyword-based fallback for extended categories
  if (/tech|ai|product/.test(c)) return "tech";
  if (/news|world|politics/.test(c)) return "news";
  if (/life|travel|culture/.test(c)) return "lifestyle";
  if (/beauty|fashion|cosmetic/.test(c)) return "beauty";
  if (/finance|economy|stock/.test(c)) return "finance";

  return "default";
}
