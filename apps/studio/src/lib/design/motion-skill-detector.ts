/**
 * Motion Skill Detector — classifies content to the best motion skill.
 *
 * Uses gpt-4o-mini to analyze the content brief and select
 * which Remotion composition (skill) to use.
 */

import { z } from "zod";
import { callGptJson } from "../llm";
import type { DesignBrief } from "./types";
import { MOTION_SKILLS, getSkillsForContentType } from "./motion-skills";
import type { MotionSkillId } from "../../remotion/skills";
import { MOTION_SKILL_IDS } from "../../remotion/skills";

// ── Types ───────────────────────────────────────────

export interface MotionSkillDetection {
  skillId: MotionSkillId;
  confidence: number;        // 0-1
  reasoning: string;
  alternatives: MotionSkillId[];
}

// ── Zod schema for LLM response ─────────────────────

const detectionSchema = z.object({
  skillId: z.enum(MOTION_SKILL_IDS),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  alternatives: z.array(z.enum(MOTION_SKILL_IDS)).default([]),
});

// ── Detector ────────────────────────────────────────

export async function detectMotionSkill(
  brief: DesignBrief,
  opts?: { model?: string; preferredSkills?: MotionSkillId[] },
): Promise<MotionSkillDetection> {
  // Build skill catalog for prompt
  const candidates = getSkillsForContentType(brief.contentType);
  const allSkills = candidates.length > 0 ? candidates : Object.values(MOTION_SKILLS);

  const skillList = allSkills.map((s) => (
    `- ${s.id}: ${s.description}\n  Best for: ${s.bestFor.join(", ")}`
  )).join("\n");

  const preferredNote = opts?.preferredSkills?.length
    ? `\nPreferred skills (prioritize if suitable): ${opts.preferredSkills.join(", ")}`
    : "";

  const prompt = `You are a Motion Design Skill Selector for a Korean music/culture web magazine.

Given the content brief below, select the best Remotion motion skill composition.

## Available Skills
${skillList}
${preferredNote}

## Content Brief
- Content Type: ${brief.contentType}
- Key Message: ${brief.keyMessage}
- Mood: ${brief.mood}
- Visual Concept: ${brief.visualConcept}

## Rules
1. Match the skill to the content's nature (data → ChartAnimation/DataCounter, lyrics → KineticTypography, etc.)
2. Consider visual impact and audience engagement
3. If multiple skills fit, pick the most engaging one
4. Provide 1-2 alternatives in case the primary choice fails

Respond in JSON:
{
  "skillId": "<skill_id>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>",
  "alternatives": ["<alt_skill_id>"]
}`;

  const result = await callGptJson<z.infer<typeof detectionSchema>>(prompt, {
    model: opts?.model ?? "gpt-4o-mini",
    schema: detectionSchema,
  });

  return result;
}

/**
 * Quick detection without LLM — rule-based fallback.
 * Used when LLM is unavailable or for cost savings.
 */
export function detectMotionSkillRuleBased(brief: DesignBrief): MotionSkillDetection {
  const ct = brief.contentType;
  const text = `${brief.keyMessage} ${brief.visualConcept} ${brief.mood}`.toLowerCase();

  // Data-heavy content
  if (ct === "data_insight" || ct === "list_ranking") {
    if (text.includes("순위") || text.includes("rank") || text.includes("차트")) {
      return { skillId: "ChartAnimation", confidence: 0.85, reasoning: "Data/ranking content", alternatives: ["DataCounter"] };
    }
    return { skillId: "DataCounter", confidence: 0.8, reasoning: "Data insight content", alternatives: ["ChartAnimation"] };
  }

  // Comparison content
  if (text.includes("vs") || text.includes("비교") || text.includes("versus")) {
    return { skillId: "SplitScreen", confidence: 0.85, reasoning: "Comparison content", alternatives: ["ChartAnimation"] };
  }

  // Lyrics or quotes
  if (text.includes("가사") || text.includes("lyric") || text.includes("명언") || text.includes("quote")) {
    return { skillId: "KineticTypography", confidence: 0.85, reasoning: "Text-heavy/lyric content", alternatives: ["TextReveal"] };
  }

  // Album review with images
  if (ct === "album_review") {
    return { skillId: "Slideshow", confidence: 0.7, reasoning: "Album review — visual gallery", alternatives: ["TextReveal", "SplitScreen"] };
  }

  // Trending — celebration style
  if (ct === "trending") {
    return { skillId: "TextReveal", confidence: 0.7, reasoning: "Trending headline", alternatives: ["ParticleEffect", "KineticTypography"] };
  }

  // Artist spotlight — visual-focused
  if (ct === "artist_spotlight") {
    return { skillId: "Slideshow", confidence: 0.7, reasoning: "Artist spotlight — visual gallery", alternatives: ["TextReveal", "KineticTypography"] };
  }

  // General / default
  return { skillId: "TextReveal", confidence: 0.5, reasoning: "General content fallback", alternatives: ["KineticTypography", "Slideshow"] };
}
