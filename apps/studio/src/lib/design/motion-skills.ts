/**
 * Motion Skills Registry — metadata for each skill composition.
 *
 * Used by the Motion Skill Detector and Motion Designer Agent
 * to select and configure the right Remotion composition.
 */

import type { MotionSkillId } from "../../remotion/skills";

export interface MotionSkillMeta {
  id: MotionSkillId;
  name: string;
  nameKo: string;
  description: string;
  bestFor: string[];
  contentTypes: string[];
  defaultSize: { width: number; height: number };
  maxDurationSec: number;
}

export const MOTION_SKILLS: Record<MotionSkillId, MotionSkillMeta> = {
  TextReveal: {
    id: "TextReveal",
    name: "Text Reveal",
    nameKo: "텍스트 리빌",
    description: "Animated text entrance with multiple reveal styles (fade up, typewriter, split, scale bounce).",
    bestFor: ["titles", "quotes", "headlines", "album names", "announcements"],
    contentTypes: ["album_review", "artist_spotlight", "trending", "general"],
    defaultSize: { width: 1080, height: 1080 },
    maxDurationSec: 10,
  },
  ChartAnimation: {
    id: "ChartAnimation",
    name: "Chart Animation",
    nameKo: "차트 애니메이션",
    description: "Animated bar, horizontal bar, pie, or progress charts for data visualization.",
    bestFor: ["rankings", "statistics", "comparisons", "streaming data", "chart performance"],
    contentTypes: ["data_insight", "list_ranking", "trending"],
    defaultSize: { width: 1080, height: 1080 },
    maxDurationSec: 8,
  },
  DataCounter: {
    id: "DataCounter",
    name: "Data Counter",
    nameKo: "데이터 카운터",
    description: "Animated number counters with labels for statistics and milestones.",
    bestFor: ["streaming stats", "milestones", "achievements", "year-in-review", "numbers"],
    contentTypes: ["data_insight", "list_ranking", "trending"],
    defaultSize: { width: 1080, height: 1080 },
    maxDurationSec: 8,
  },
  Slideshow: {
    id: "Slideshow",
    name: "Slideshow",
    nameKo: "슬라이드쇼",
    description: "Animated image slideshow with text overlays and transitions (fade, slide, zoom, ken burns).",
    bestFor: ["photo galleries", "album art", "event highlights", "artist features", "behind the scenes"],
    contentTypes: ["album_review", "artist_spotlight", "general"],
    defaultSize: { width: 1080, height: 1080 },
    maxDurationSec: 30,
  },
  SplitScreen: {
    id: "SplitScreen",
    name: "Split Screen",
    nameKo: "화면 분할",
    description: "Side-by-side or top-bottom comparison view with animated entrance.",
    bestFor: ["versus", "comparisons", "before/after", "album vs album", "old vs new"],
    contentTypes: ["album_review", "trending", "general"],
    defaultSize: { width: 1080, height: 1080 },
    maxDurationSec: 8,
  },
  KineticTypography: {
    id: "KineticTypography",
    name: "Kinetic Typography",
    nameKo: "키네틱 타이포그래피",
    description: "Words animated individually with cascade, explode, wave, or spotlight effects.",
    bestFor: ["lyrics", "quotes", "key phrases", "impact statements", "track titles"],
    contentTypes: ["album_review", "artist_spotlight", "trending", "general"],
    defaultSize: { width: 1080, height: 1080 },
    maxDurationSec: 15,
  },
  ParticleEffect: {
    id: "ParticleEffect",
    name: "Particle Effect",
    nameKo: "파티클 이펙트",
    description: "Decorative particle animations as backgrounds or overlays with text.",
    bestFor: ["celebrations", "announcements", "backgrounds", "atmospheric", "teasers"],
    contentTypes: ["album_review", "trending", "general"],
    defaultSize: { width: 1080, height: 1080 },
    maxDurationSec: 10,
  },
};

/** Get skill metadata by ID. */
export function getMotionSkill(id: MotionSkillId): MotionSkillMeta {
  return MOTION_SKILLS[id];
}

/** List all skills matching a content type. */
export function getSkillsForContentType(contentType: string): MotionSkillMeta[] {
  return Object.values(MOTION_SKILLS).filter((s) =>
    s.contentTypes.includes(contentType),
  );
}
