/**
 * Motion Designer Agent — generates Remotion composition props.
 *
 * Given a DesignBrief and a detected MotionSkillId,
 * produces the props object to render the chosen composition.
 */

import { z, type ZodType } from "zod";
import { callGptJson } from "../llm";
import type { DesignBrief, DesignPlatform, MotionDesignResult } from "./types";
import type { MotionSkillId } from "../../remotion/skills";
import {
  textRevealSchema,
  chartAnimationSchema,
  dataCounterSchema,
  slideshowSchema,
  splitScreenSchema,
  kineticTypographySchema,
  particleEffectSchema,
} from "../../remotion/skills";
import { getMotionSkill } from "./motion-skills";
import { detectMotionSkill, detectMotionSkillRuleBased } from "./motion-skill-detector";
import type { BrandKit } from "./brand-kit";
import { DEFAULT_BRAND_KIT } from "./brand-kit";

// ── Options ─────────────────────────────────────────

export interface MotionDesignerOptions {
  model?: string;
  skillId?: MotionSkillId;       // override detected skill
  platform?: DesignPlatform;
  brandKit?: BrandKit;
  useLLMDetection?: boolean;     // default: true
  durationSec?: number;          // desired duration
}

// ── Composition size by platform ────────────────────

const PLATFORM_MOTION_SIZES: Record<string, { width: number; height: number }> = {
  instagram: { width: 1080, height: 1080 },
  instagram_story: { width: 1080, height: 1920 },
  twitter: { width: 1280, height: 720 },
  facebook: { width: 1200, height: 630 },
  tiktok: { width: 1080, height: 1920 },
  blog: { width: 1200, height: 675 },
  youtube_thumb: { width: 1280, height: 720 },
};

// ── Main function ───────────────────────────────────

export async function generateMotionDesign(
  brief: DesignBrief,
  opts?: MotionDesignerOptions,
): Promise<MotionDesignResult> {
  const kit = opts?.brandKit ?? DEFAULT_BRAND_KIT;
  const platform = opts?.platform ?? "instagram";
  const size = PLATFORM_MOTION_SIZES[platform] ?? { width: 1080, height: 1080 };
  const start = performance.now();

  // 1. Detect or use provided skill
  let skillId: MotionSkillId;
  if (opts?.skillId) {
    skillId = opts.skillId;
  } else if (opts?.useLLMDetection !== false) {
    const detection = await detectMotionSkill(brief, { model: opts?.model });
    skillId = detection.skillId;
  } else {
    const detection = detectMotionSkillRuleBased(brief);
    skillId = detection.skillId;
  }

  const skillMeta = getMotionSkill(skillId);
  const durationSec = opts?.durationSec ?? Math.min(skillMeta.maxDurationSec, 8);

  // 2. Generate composition props via LLM
  const props = await generateCompositionProps(
    brief, skillId, kit, platform, durationSec, opts?.model,
  );

  const totalTimeMs = Math.round(performance.now() - start);

  return {
    compositionId: skillId,
    props,
    width: size.width,
    height: size.height,
    durationInFrames: durationSec * 30,
    fps: 30,
    generationTimeMs: totalTimeMs,
  };
}

// ── Props generation ────────────────────────────────

async function generateCompositionProps(
  brief: DesignBrief,
  skillId: MotionSkillId,
  kit: BrandKit,
  platform: DesignPlatform,
  durationSec: number,
  model?: string,
): Promise<Record<string, unknown>> {
  const skillMeta = getMotionSkill(skillId);
  const fps = 30;
  const totalFrames = durationSec * fps;

  const prompt = `You are a Motion Design Props Generator for a Korean music/culture web magazine.

Generate the props object for the "${skillId}" Remotion composition.

## Skill Info
- Name: ${skillMeta.name} (${skillMeta.nameKo})
- Description: ${skillMeta.description}
- Best for: ${skillMeta.bestFor.join(", ")}

## Content Brief
- Content Type: ${brief.contentType}
- Key Message: ${brief.keyMessage}
- Mood: ${brief.mood}
- Visual Concept: ${brief.visualConcept}
- Color Direction: ${brief.colorDirection.primary} (${brief.colorDirection.mood})
- Layout Style: ${brief.layoutStyle}
- Typography Mood: ${brief.typographyMood}

## Constraints
- Platform: ${platform}
- Target duration: ~${durationSec}s (${totalFrames} frames at ${fps}fps)
- Brand primary color: ${kit.colors.primary}
- Brand accent color: ${kit.colors.accent}
- Font family: "${kit.typography.heading.fontFamily}"
- Korean text is required for Korean audience

## Schema Reference
${getSchemaDescription(skillId)}

## Rules
1. All text MUST be in Korean (unless English is more natural, e.g., artist names, song titles)
2. Use brand colors from the brand kit
3. Keep animations within the frame budget
4. Make content engaging and visually appealing
5. For data skills (ChartAnimation, DataCounter), use realistic but illustrative numbers

Return a valid JSON object matching the composition schema. Do NOT include "compositionId" or other meta fields — only the composition props.`;

  const schema = getCompositionSchema(skillId);

  const result = await callGptJson<Record<string, unknown>>(prompt, {
    model: model ?? "gpt-4o-mini",
    schema: schema as ZodType<Record<string, unknown>>,
  });

  return result;
}

/** Get the Zod schema for a given skill composition. */
function getCompositionSchema(skillId: MotionSkillId): ZodType {
  switch (skillId) {
    case "TextReveal": return textRevealSchema;
    case "ChartAnimation": return chartAnimationSchema;
    case "DataCounter": return dataCounterSchema;
    case "Slideshow": return slideshowSchema;
    case "SplitScreen": return splitScreenSchema;
    case "KineticTypography": return kineticTypographySchema;
    case "ParticleEffect": return particleEffectSchema;
  }
}

// ── Schema descriptions for each skill ──────────────

function getSchemaDescription(skillId: MotionSkillId): string {
  switch (skillId) {
    case "TextReveal":
      return `{
  "lines": [{ "text": string, "fontSize": number (default 64), "fontWeight": number (default 700), "color": string (default "#FFFFFF"), "delayFrames": number (default 0) }],
  "revealStyle": "fade_up" | "typewriter" | "split" | "scale_bounce" (default "fade_up"),
  "backgroundColor": string (default "#1A1A2E"),
  "backgroundGradient": string (optional, CSS gradient),
  "fontFamily": string (default "Pretendard, sans-serif"),
  "lineSpacing": number (default 20),
  "staggerFrames": number (default 10, delay between lines),
  "holdFrames": number (default 60, frames to hold after reveal)
}`;

    case "ChartAnimation":
      return `{
  "chartType": "bar" | "horizontal_bar" | "pie" | "progress" (default "bar"),
  "title": string (default ""),
  "data": [{ "label": string, "value": number, "color": string (optional) }] (min 1 item, REQUIRED),
  "colors": string[] (default ["#6C5CE7","#00CEC9","#FD79A8","#FDCB6E","#E17055"]),
  "backgroundColor": string (default "#1A1A2E"),
  "textColor": string (default "#FFFFFF"),
  "fontFamily": string (default "Pretendard, sans-serif"),
  "animationFrames": number (default 45),
  "holdFrames": number (default 60),
  "showValues": boolean (default true),
  "maxValue": number (optional, auto-calculated from data),
  "unit": string (default "")
}`;

    case "DataCounter":
      return `{
  "counters": [{ "label": string, "startValue": number (default 0), "endValue": number (REQUIRED), "prefix": string (default ""), "suffix": string (default ""), "color": string (optional), "decimals": number (default 0) }] (min 1, REQUIRED),
  "title": string (default ""),
  "layout": "row" | "column" | "grid" (default "row"),
  "backgroundColor": string (default "#1A1A2E"),
  "textColor": string (default "#FFFFFF"),
  "accentColor": string (default "#6C5CE7"),
  "fontFamily": string (default "Pretendard, sans-serif"),
  "countFrames": number (default 50),
  "staggerFrames": number (default 8),
  "holdFrames": number (default 60)
}`;

    case "Slideshow":
      return `{
  "slides": [{ "imageUrl": string (REQUIRED), "title": string (default ""), "subtitle": string (default ""), "durationFrames": number (default 90) }] (min 1, REQUIRED),
  "transition": "fade" | "slide_left" | "slide_up" | "zoom" | "ken_burns" (default "fade"),
  "transitionFrames": number (default 15),
  "textPosition": "bottom" | "center" | "top" (default "bottom"),
  "textColor": string (default "#FFFFFF"),
  "overlayColor": string (default "#000000"),
  "overlayOpacity": number (default 0.4),
  "fontFamily": string (default "Pretendard, sans-serif"),
  "showProgress": boolean (default false)
}`;

    case "SplitScreen":
      return `{
  "left": { "imageUrl": string (optional), "backgroundColor": string (default "#1A1A2E"), "title": string (default ""), "subtitle": string (default ""), "body": string (default ""), "textColor": string (default "#FFFFFF"), "accentColor": string (default "#6C5CE7") },
  "right": { "imageUrl": string (optional), "backgroundColor": string (default "#1A1A2E"), "title": string (default ""), "subtitle": string (default ""), "body": string (default ""), "textColor": string (default "#FFFFFF"), "accentColor": string (default "#6C5CE7") },
  "direction": "horizontal" | "vertical" (default "horizontal"),
  "splitRatio": number 0-1 (default 0.5),
  "dividerColor": string (default "#6C5CE7"),
  "dividerWidth": number (default 4),
  "animateIn": "slide" | "reveal" | "fade" (default "slide"),
  "fontFamily": string (default "Pretendard, sans-serif"),
  "holdFrames": number (default 120)
}`;

    case "KineticTypography":
      return `{
  "words": [{ "text": string (REQUIRED), "emphasis": boolean (default false), "color": string (optional) }] (min 1, REQUIRED),
  "style": "cascade" | "explode" | "wave" | "spotlight" (default "cascade"),
  "fontSize": number (default 72),
  "fontFamily": string (default "Pretendard, sans-serif"),
  "backgroundColor": string (default "#0A0A1A"),
  "textColor": string (default "#FFFFFF"),
  "emphasisColor": string (default "#6C5CE7"),
  "framesPerWord": number (default 12),
  "holdFrames": number (default 60)
}`;

    case "ParticleEffect":
      return `{
  "particleCount": number (default 40),
  "particleType": "circle" | "square" | "star" | "confetti" (default "circle"),
  "colors": string[] (default ["#6C5CE7","#00CEC9","#FD79A8","#FDCB6E","#E17055"]),
  "backgroundColor": string (default "#0A0A1A"),
  "direction": "up" | "down" | "radial" | "random" (default "up"),
  "speed": number (default 1),
  "minSize": number (default 4),
  "maxSize": number (default 16),
  "title": string (default ""),
  "subtitle": string (default ""),
  "textColor": string (default "#FFFFFF"),
  "fontFamily": string (default "Pretendard, sans-serif"),
  "holdFrames": number (default 150),
  "seed": number (default 42)
}`;
  }
}
