/**
 * Design Critique API
 *
 * POST /api/design/critique
 *
 * Accepts pre-rendered slide PNGs and optional context,
 * evaluates them using Vision LLM across 5 design dimensions.
 *
 * Body:
 *   images: string[]           — base64 PNG data URIs (data:image/png;base64,...)
 *   context?: {
 *     contentType?: string     — e.g. "cardnews", "cover", "sns_image"
 *     platform?: string        — e.g. "instagram", "threads"
 *     mood?: string            — design mood/tone
 *     keyMessage?: string      — main message of the design
 *   }
 *
 * Returns:
 *   scores: { dimension: string; score: number; feedback: string }[]
 *   averageScore: number
 *   verdict: "pass" | "refine" | "regenerate"
 *   refinementInstructions?: string
 */

import { NextResponse } from "next/server";
import { callGptVision } from "@/lib/llm";
import { z } from "zod";

// ── Constants ────────────────────────────────────────────

const DIMENSIONS = [
  "VISUAL_HIERARCHY",
  "BRAND_CONSISTENCY",
  "READABILITY",
  "AESTHETIC_QUALITY",
  "PLATFORM_FIT",
] as const;

const PASS_THRESHOLD = 8.0;
const REFINE_THRESHOLD = 6.0;

// ── Zod schema for LLM response ─────────────────────────

const dimensionScoreSchema = z.object({
  dimension: z.string(),
  score: z.number().min(1).max(10),
  feedback: z.string(),
});

const criticResponseSchema = z.object({
  scores: z.array(dimensionScoreSchema),
  overallFeedback: z.string().optional(),
  refinementInstructions: z.string().optional(),
});

type CriticLLMResponse = z.infer<typeof criticResponseSchema>;

// ── Build prompt ─────────────────────────────────────────

function buildPrompt(context?: {
  contentType?: string;
  platform?: string;
  mood?: string;
  keyMessage?: string;
}): string {
  const platform = context?.platform ?? "instagram";
  const contentType = context?.contentType ?? "sns_image";

  return `You are an expert design critic evaluating social media visual designs.

CONTEXT:
- Platform: ${platform}
- Content type: ${contentType}
${context?.mood ? `- Design mood: ${context.mood}` : ""}
${context?.keyMessage ? `- Key message: ${context.keyMessage}` : ""}

Evaluate the design image(s) across these 5 dimensions (score 1-10):

1. VISUAL_HIERARCHY (1-10)
   - Is the attention flow clear? Do size/color/weight contrasts guide the eye?
   - 9-10: Instantly clear focal point, beautiful layering
   - 7-8: Good hierarchy, minor issues
   - 5-6: Confusing priorities or flat layout
   - 1-4: No clear hierarchy

2. BRAND_CONSISTENCY (1-10)
   - Do colors, typography, and style feel cohesive and intentional?
   - 9-10: Professional brand identity, cohesive system
   - 7-8: Mostly consistent
   - 5-6: Some inconsistencies
   - 1-4: No visual identity

3. READABILITY (1-10)
   - Is text legible? Good contrast? Appropriate font sizes and density?
   - 9-10: Perfect readability at all sizes
   - 7-8: Good readability, minor issues
   - 5-6: Some text hard to read
   - 1-4: Text is illegible

4. AESTHETIC_QUALITY (1-10)
   - Whitespace usage, alignment, color harmony, visual balance
   - 9-10: Magazine-quality aesthetics
   - 7-8: Clean and well-composed
   - 5-6: Acceptable but unremarkable
   - 1-4: Poor aesthetics

5. PLATFORM_FIT (1-10)
   - Is the design optimized for ${platform}? Safe zones, aspect ratio, thumbnail legibility?
   - 9-10: Perfectly optimized for ${platform}
   - 7-8: Good fit
   - 5-6: Misses some platform conventions
   - 1-4: Wrong format/sizing

Respond in JSON:
{
  "scores": [
    { "dimension": "VISUAL_HIERARCHY", "score": N, "feedback": "Korean feedback" },
    { "dimension": "BRAND_CONSISTENCY", "score": N, "feedback": "Korean feedback" },
    { "dimension": "READABILITY", "score": N, "feedback": "Korean feedback" },
    { "dimension": "AESTHETIC_QUALITY", "score": N, "feedback": "Korean feedback" },
    { "dimension": "PLATFORM_FIT", "score": N, "feedback": "Korean feedback" }
  ],
  "overallFeedback": "Overall Korean feedback summary",
  "refinementInstructions": "Specific improvement instructions in Korean (only if score < 8.0)"
}

Give feedback in Korean. Be specific and actionable.`;
}

// ── Route handler ────────────────────────────────────────

export async function POST(req: Request) {
  let body: {
    images: string[];
    context?: {
      contentType?: string;
      platform?: string;
      mood?: string;
      keyMessage?: string;
    };
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.images) || body.images.length === 0) {
    return NextResponse.json({ error: "images array required" }, { status: 400 });
  }

  // Strip data URI prefix to get raw base64
  const base64Images = body.images.map((img) => {
    const match = img.match(/^data:image\/\w+;base64,(.+)$/);
    return match ? match[1]! : img;
  }).filter((b) => b.length > 0);

  if (base64Images.length === 0) {
    return NextResponse.json({ error: "No valid images provided" }, { status: 400 });
  }

  const start = performance.now();

  try {
    const prompt = buildPrompt(body.context);

    const llmResponse = await callGptVision<CriticLLMResponse>(
      prompt,
      base64Images.map((b64) => ({ base64: b64, detail: "low" as const })),
      {
        model: "gpt-4o",
        temperature: 0.3,
        maxTokens: 1500,
        timeoutMs: 60_000,
        schema: criticResponseSchema,
      },
    );

    // Ensure all dimensions present
    const scoreMap = new Map(llmResponse.scores.map((s) => [s.dimension, s]));
    const scores = DIMENSIONS.map((dim) => {
      const existing = scoreMap.get(dim);
      if (existing) return existing;
      return { dimension: dim, score: 5, feedback: "평가 누락 — 기본값 적용" };
    });

    const averageScore = Math.round(
      (scores.reduce((sum, s) => sum + s.score, 0) / scores.length) * 100,
    ) / 100;

    let verdict: "pass" | "refine" | "regenerate";
    if (averageScore >= PASS_THRESHOLD) {
      verdict = "pass";
    } else if (averageScore >= REFINE_THRESHOLD) {
      verdict = "refine";
    } else {
      verdict = "regenerate";
    }

    const elapsed = Math.round(performance.now() - start);

    return NextResponse.json({
      scores,
      averageScore,
      verdict,
      refinementInstructions: verdict !== "pass"
        ? (llmResponse.refinementInstructions ?? llmResponse.overallFeedback)
        : undefined,
      overallFeedback: llmResponse.overallFeedback,
      evaluationTimeMs: elapsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Critique failed", details: msg }, { status: 500 });
  }
}
