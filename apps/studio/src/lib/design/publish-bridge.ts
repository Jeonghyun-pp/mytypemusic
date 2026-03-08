/**
 * Design → Publishing Bridge
 *
 * Connects the Design Engine output to the SNS Publishing system.
 * Handles: rendering slides to PNG → uploading → creating Publication records.
 */

import type {
  DesignBrief,
  DesignPlatform,
  DesignFormat,
  VisualDesignResult,
} from "./types";
import { recordDesignStyle } from "./style-performance";
import type { StylePerformanceRecord } from "./style-performance";

// ── Types ──────────────────────────────────────────────

export interface PublishReadyContent {
  /** Platform to publish to */
  platform: DesignPlatform;
  /** Post text (auto-generated from design brief) */
  text: string;
  /** Rendered image data URIs (PNG base64) */
  imageDataUris: string[];
  /** Hashtags */
  hashtags: string[];
  /** Design metadata for performance tracking */
  designMeta: {
    briefId: string;
    contentType: string;
    format: DesignFormat;
    designPath: string;
    templateIds: string[];
    typographyMood?: string;
    layoutStyle?: string;
    colorMood?: string;
  };
}

export interface DesignToPublishInput {
  brief: DesignBrief;
  visualResult: VisualDesignResult;
  platform: DesignPlatform;
  /** Override the generated caption text */
  captionOverride?: string;
  /** Additional hashtags to append */
  extraHashtags?: string[];
  /** Render function to convert slide JSX to PNG data URI */
  renderSlide: (slideHtml: string, width: number, height: number) => Promise<string>;
}

// ── Platform-specific caption/hashtag config ───────────

const PLATFORM_HASHTAG_LIMITS: Record<string, number> = {
  instagram: 30,
  instagram_story: 10,
  twitter: 5,
  youtube_thumb: 0,
  facebook: 10,
  tiktok: 10,
  blog: 10,
};

const PLATFORM_CAPTION_LIMITS: Record<string, number> = {
  instagram: 2200,
  instagram_story: 0,
  twitter: 280,
  youtube_thumb: 0,
  facebook: 5000,
  tiktok: 2200,
  blog: 10000,
};

// ── Main function ──────────────────────────────────────

/**
 * Convert design engine output into publish-ready content.
 * Renders all slides to PNG and generates platform-appropriate captions.
 */
export async function prepareForPublishing(
  input: DesignToPublishInput,
): Promise<PublishReadyContent> {
  const { brief, visualResult, platform, captionOverride, extraHashtags, renderSlide } = input;

  if (!visualResult.slides.length) {
    throw new Error("Cannot publish design with no slides");
  }

  // 1. Render slides to PNG
  const imageDataUris: string[] = [];
  for (const slide of visualResult.slides) {
    const png = await renderSlide(slide.jsxCode, slide.width, slide.height);
    imageDataUris.push(png);
  }

  // 2. Generate caption
  const captionLimit = PLATFORM_CAPTION_LIMITS[platform] ?? 2200;
  const text = captionOverride
    ? truncateCaption(captionOverride, captionLimit)
    : generateCaption(brief, platform, captionLimit);

  // 3. Generate hashtags
  const hashtagLimit = PLATFORM_HASHTAG_LIMITS[platform] ?? 10;
  const hashtags = generateHashtags(brief, extraHashtags).slice(0, hashtagLimit);

  // 4. Record for performance tracking
  const trackingId = `design_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record: StylePerformanceRecord = {
    id: trackingId,
    createdAt: Date.now(),
    contentType: brief.contentType,
    format: visualResult.format,
    platform,
    templateId: visualResult.slides[0]?.templateId,
    designPath: visualResult.designPath,
    typographyMood: brief.typographyMood,
    layoutStyle: brief.layoutStyle,
    colorMood: brief.colorDirection?.mood,
    primaryColor: brief.colorDirection?.primary,
    hasImage: visualResult.slides.some((s) => s.jsxCode.includes("img")),
    slideCount: visualResult.slides.length,
  };
  recordDesignStyle(record);

  return {
    platform,
    text,
    imageDataUris,
    hashtags,
    designMeta: {
      briefId: trackingId,
      contentType: brief.contentType,
      format: visualResult.format,
      designPath: visualResult.designPath,
      templateIds: visualResult.slides.map((s) => s.templateId).filter(Boolean) as string[],
      typographyMood: brief.typographyMood,
      layoutStyle: brief.layoutStyle,
      colorMood: brief.colorDirection?.mood,
    },
  };
}

// ── Caption generation ─────────────────────────────────

function generateCaption(
  brief: DesignBrief,
  platform: DesignPlatform,
  maxLength: number,
): string {
  if (maxLength === 0) return "";

  const parts: string[] = [];

  // Key message first
  if (brief.keyMessage) {
    parts.push(brief.keyMessage);
  }

  // Visual concept as context
  if (brief.visualConcept && platform !== "twitter") {
    parts.push(`\n\n${brief.visualConcept}`);
  }

  // CTA
  if (platform === "instagram" || platform === "facebook") {
    parts.push("\n\n저장하고 나중에 다시 보세요!");
  }

  const caption = parts.join("");
  return truncateCaption(caption, maxLength);
}

function truncateCaption(text: string, maxLength: number): string {
  if (maxLength === 0) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// ── Hashtag generation ─────────────────────────────────

function generateHashtags(
  brief: DesignBrief,
  extra?: string[],
): string[] {
  const tags = new Set<string>();

  // Content-type based hashtags
  const contentTypeTags: Record<string, string[]> = {
    album_review: ["앨범리뷰", "음악리뷰", "NewMusic"],
    artist_spotlight: ["아티스트", "음악", "인터뷰"],
    trending: ["트렌드", "핫이슈", "화제"],
    data_insight: ["데이터", "인포그래픽", "분석"],
    list_ranking: ["랭킹", "순위", "TOP"],
    general: ["매거진", "컬처"],
  };

  const baseTags = contentTypeTags[brief.contentType] ?? ["매거진"];
  for (const tag of baseTags) tags.add(tag);

  // Mood-based tags
  if (brief.mood) {
    const moodWords = brief.mood.split(/[,\s]+/).filter((w) => w.length > 1).slice(0, 2);
    for (const w of moodWords) tags.add(w);
  }

  // Extra tags
  if (extra) {
    for (const tag of extra) tags.add(tag.replace(/^#/, ""));
  }

  // Always add brand tag
  tags.add("WebMagazine");

  return Array.from(tags).map((t) => `#${t}`);
}

/**
 * Batch prepare multiple design outputs for publishing.
 */
export async function batchPrepareForPublishing(
  brief: DesignBrief,
  results: Array<{ visualResult: VisualDesignResult; platform: DesignPlatform }>,
  renderSlide: (slideHtml: string, width: number, height: number) => Promise<string>,
  opts?: { captionOverride?: string; extraHashtags?: string[] },
): Promise<PublishReadyContent[]> {
  const prepared: PublishReadyContent[] = [];
  for (const { visualResult, platform } of results) {
    const content = await prepareForPublishing({
      brief,
      visualResult,
      platform,
      renderSlide,
      captionOverride: opts?.captionOverride,
      extraHashtags: opts?.extraHashtags,
    });
    prepared.push(content);
  }
  return prepared;
}
