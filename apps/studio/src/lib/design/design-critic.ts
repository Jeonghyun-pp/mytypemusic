/**
 * Design Critic Agent — evaluates rendered designs using Vision LLM.
 *
 * Takes rendered slide images and scores them across 5 dimensions:
 *   1. VISUAL_HIERARCHY — attention flow, size/color contrast
 *   2. BRAND_CONSISTENCY — color palette, typography, magazine identity
 *   3. READABILITY — text contrast, font size, information density
 *   4. AESTHETIC_QUALITY — whitespace, alignment, color harmony
 *   5. PLATFORM_FIT — aspect ratio compliance, safe zones, thumbnail legibility
 *
 * Produces a verdict: PASS (avg >= 8), REFINE (6-7.9), REGENERATE (< 6).
 */

import { callGptVision } from "@/lib/llm";
import { z } from "zod";
import type {
  BenchmarkReport,
  DesignBrief,
  DesignCriticResult,
  CriticDimensionScore,
  CriticVerdict,
  SlideDesign,
  VisualDesignResult,
} from "./types";
import type { BrandKit } from "./brand-kit";
import { DEFAULT_BRAND_KIT } from "./brand-kit";

// ── Zod schema for Vision LLM response ─────────────────

const dimensionScoreSchema = z.object({
  dimension: z.string(),
  score: z.number().min(1).max(10),
  feedback: z.string(),
});

const criticResponseSchema = z.object({
  scores: z.array(dimensionScoreSchema).min(5).max(6),
  overallFeedback: z.string(),
  refinementInstructions: z.string().optional(),
});

type CriticLLMResponse = z.infer<typeof criticResponseSchema>;

// ── Constants ───────────────────────────────────────────

const BASE_DIMENSIONS = [
  "VISUAL_HIERARCHY",
  "BRAND_CONSISTENCY",
  "READABILITY",
  "AESTHETIC_QUALITY",
  "PLATFORM_FIT",
] as const;

const BENCHMARK_DIMENSION = "COMPETITIVE_EDGE" as const;

type DimensionName = (typeof BASE_DIMENSIONS)[number] | typeof BENCHMARK_DIMENSION;

const PASS_THRESHOLD = 8.0;
const REFINE_THRESHOLD = 6.0;

// ── Render helper ───────────────────────────────────────

/**
 * Render slides to PNG base64 strings for Vision LLM input.
 * Uses the shared Satori render pipeline (agents/shared/render.ts).
 */
async function renderSlidesToBase64(slides: SlideDesign[]): Promise<string[]> {
  const { renderHtmlToPngBuffer } = await import(
    "@agents/shared/render"
  );

  const results: string[] = [];
  for (const slide of slides) {
    try {
      const pngBuffer = await renderHtmlToPngBuffer(
        slide.jsxCode,
        "bold-display", // default font mood
        slide.width,
        slide.height,
      );
      results.push(pngBuffer.toString("base64"));
    } catch (err) {
      // If render fails, push empty string — critic will note missing slide
      console.error(`Critic render failed for slide ${slide.index}:`, err);
      results.push("");
    }
  }
  return results;
}

// ── Rubric prompt ───────────────────────────────────────

function buildRubricPrompt(
  brief: DesignBrief,
  kit: BrandKit,
  slideCount: number,
  platform: string,
  benchmark?: BenchmarkReport,
): string {
  // Build benchmark context section
  let benchmarkSection = "";
  if (benchmark && benchmark.totalSamples >= 3) {
    const baseline = benchmark.historicalBaseline;
    const norms = benchmark.platformNorms;
    const topStyles = benchmark.topPerformingStyles;

    benchmarkSection = `
=== BENCHMARK DATA (${benchmark.confidence} confidence, ${String(benchmark.totalSamples)} samples) ===
Historical baseline: avg score ${String(baseline.averageScore)}/10, pass rate ${String(Math.round(baseline.passRate * 100))}%
${Object.entries(baseline.byDimension).map(([d, s]) => `  ${d}: ${String(s)}/10`).join("\n")}

Platform "${norms.platform}" norms: avg score ${String(norms.avgScore)}/10
${norms.bestColorMood ? `  Best performing color mood: ${norms.bestColorMood}` : ""}
${norms.bestLayoutStyle ? `  Best performing layout: ${norms.bestLayoutStyle}` : ""}
${norms.topTemplates.length > 0 ? `  Top templates: ${norms.topTemplates.join(", ")}` : ""}

${topStyles.length > 0 ? `Top engagement-driving styles:\n${topStyles.map((s) => `  ${s.attribute}="${s.value}": ${s.comparedToAvg >= 0 ? "+" : ""}${String(s.comparedToAvg)}% vs avg (n=${String(s.sampleSize)})`).join("\n")}` : ""}
=== END BENCHMARK ===
`;
  }

  // Build the 6th dimension block only when benchmark is available
  const competitiveEdgeDimension = benchmark && benchmark.totalSamples >= 3 ? `
6. COMPETITIVE_EDGE (1-10)
   - Does this design meet or exceed our historical baseline (avg ${String(benchmark.historicalBaseline.averageScore)}/10)?
   - Does it leverage proven high-engagement style attributes?
   - Would this stand out in a social media feed compared to typical magazine content?
   - 9-10: Clearly exceeds historical baseline; uses proven winning styles
   - 7-8: Meets baseline; incorporates some proven attributes
   - 5-6: Below historical average; misses key engagement-driving elements
   - 1-4: Significantly below baseline; generic and forgettable
` : "";

  return `You are a senior visual design critic for a Korean music/culture web magazine.

You are evaluating ${slideCount} rendered design slide(s) for the "${platform}" platform.

=== DESIGN BRIEF CONTEXT ===
Content type: ${brief.contentType}
Mood: ${brief.mood}
Key message: ${brief.keyMessage}
Visual concept: ${brief.visualConcept}
Color direction: ${brief.colorDirection.primary} (${brief.colorDirection.mood})
Layout style: ${brief.layoutStyle}
Typography mood: ${brief.typographyMood}

=== BRAND KIT ===
Primary: ${kit.colors.primary}, Accent: ${kit.colors.accent}
Background dark: ${kit.colors.background.dark}
Font: ${kit.typography.heading.fontFamily}
Safe margin: ${kit.layout.safeMargin}px

${benchmarkSection}=== EVALUATION RUBRIC ===
Score each dimension from 1 to 10. Be strict but fair.

1. VISUAL_HIERARCHY (1-10)
   - Does the key message ("${brief.keyMessage}") immediately capture attention?
   - Is the visual flow natural (top→bottom, left→right)?
   - Are size and color contrasts effective?
   - 9-10: Eye instantly goes to the key message; perfect flow
   - 7-8: Good hierarchy with minor improvements possible
   - 5-6: Key message competes with other elements
   - 1-4: Chaotic layout; key message is buried

2. BRAND_CONSISTENCY (1-10)
   - Does the color palette match the brand kit?
   - Is typography coherent (font, weights, sizes)?
   - Does overall tone match the magazine's identity?
   - 9-10: Could be published as-is in the magazine
   - 7-8: Mostly on-brand, small adjustments needed
   - 5-6: Some brand elements present but inconsistent
   - 1-4: Doesn't look like it belongs to the magazine

3. READABILITY (1-10)
   - Is text contrast sufficient against backgrounds?
   - Are font sizes appropriate for mobile viewing?
   - Is information density appropriate (not too much, not too little)?
   - 9-10: Every word is crisp and legible at any size
   - 7-8: Mostly readable, minor contrast/size issues
   - 5-6: Some text hard to read; density issues
   - 1-4: Significant readability problems

4. AESTHETIC_QUALITY (1-10)
   - Is whitespace adequate and well-distributed?
   - Is alignment precise (elements feel intentional)?
   - Is color harmony pleasing?
   - Does it look polished and professional?
   - 9-10: Exhibition-quality visual design
   - 7-8: Professional with minor polish needed
   - 5-6: Adequate but uninspired
   - 1-4: Amateurish or unfinished

5. PLATFORM_FIT (1-10)
   - Does the design respect the platform's aspect ratio?
   - Will text be within safe zones (not cut off)?
   - Is it recognizable and compelling at thumbnail size?
   - 9-10: Optimized for the platform
   - 7-8: Works well, minor adjustments for platform
   - 5-6: Technically compliant but not optimized
   - 1-4: Does not fit the platform
${competitiveEdgeDimension}
=== OUTPUT FORMAT ===
Return a JSON object:
{
  "scores": [
    { "dimension": "VISUAL_HIERARCHY", "score": N, "feedback": "specific feedback in Korean" },
    { "dimension": "BRAND_CONSISTENCY", "score": N, "feedback": "..." },
    { "dimension": "READABILITY", "score": N, "feedback": "..." },
    { "dimension": "AESTHETIC_QUALITY", "score": N, "feedback": "..." },
    { "dimension": "PLATFORM_FIT", "score": N, "feedback": "..." }${benchmark && benchmark.totalSamples >= 3 ? `,
    { "dimension": "COMPETITIVE_EDGE", "score": N, "feedback": "..." }` : ""}
  ],
  "overallFeedback": "1-2 sentence summary in Korean",
  "refinementInstructions": "If average < 8: specific, actionable instructions in Korean for what to fix. If average >= 8: omit this field."
}

IMPORTANT:
- feedback must reference specific slides by number (e.g., "1번 슬라이드의 제목 크기가...")
- refinementInstructions must be concrete: specify exact changes (colors, sizes, positions)
- If multiple slides, evaluate consistency across the set
- Score honestly — do not inflate scores

Respond ONLY with the JSON object.`;
}

// ── Main function ───────────────────────────────────────

export interface CriticOptions {
  model?: string;
  temperature?: number;
  imageDetail?: "low" | "high" | "auto";
  /** Benchmark report for external-reference-based evaluation */
  benchmark?: BenchmarkReport;
}

/**
 * Evaluate a visual design result using Vision LLM.
 *
 * Renders all slides to PNG, sends them to gpt-4o Vision with the rubric,
 * and returns structured scores + verdict.
 */
export async function critiqueDesign(
  designResult: VisualDesignResult,
  brief: DesignBrief,
  kit?: BrandKit,
  opts?: CriticOptions,
): Promise<DesignCriticResult> {
  const brandKit = kit ?? DEFAULT_BRAND_KIT;

  if (designResult.slides.length === 0) {
    return {
      scores: BASE_DIMENSIONS.map((d) => ({ dimension: d, score: 1, feedback: "슬라이드 없음" })),
      averageScore: 1,
      verdict: "regenerate",
      refinementInstructions: "디자인 슬라이드가 비어있습니다. 재생성이 필요합니다.",
    };
  }

  // 1. Render slides to PNG base64
  const base64Images = await renderSlidesToBase64(designResult.slides);
  const validImages = base64Images.filter((b) => b.length > 0);

  if (validImages.length === 0) {
    return {
      scores: BASE_DIMENSIONS.map((d) => ({ dimension: d, score: 1, feedback: "렌더링 실패" })),
      averageScore: 1,
      verdict: "regenerate",
      refinementInstructions: "모든 슬라이드 렌더링이 실패했습니다. 재생성이 필요합니다.",
    };
  }

  // 2. Build prompt
  const platform = designResult.slides[0]?.platform ?? "instagram";
  const prompt = buildRubricPrompt(brief, brandKit, validImages.length, platform, opts?.benchmark);

  // 3. Call Vision LLM
  const detail = opts?.imageDetail ?? "low";
  const llmResponse = await callGptVision<CriticLLMResponse>(
    prompt,
    validImages.map((b64) => ({ base64: b64, detail })),
    {
      model: opts?.model ?? "gpt-4o",
      temperature: opts?.temperature ?? 0.3,
      maxTokens: 1500,
      timeoutMs: 60_000,
      schema: criticResponseSchema,
    },
  );

  // 4. Compute verdict
  const hasBenchmark = !!(opts?.benchmark && opts.benchmark.totalSamples >= 3);
  const scores = ensureAllDimensions(llmResponse.scores, hasBenchmark);
  // Average only LLM-provided scores (exclude default-filled ones)
  const llmProvided = scores.filter((s) => s.feedback !== "평가 누락 — 기본값 적용");
  const avgSource = llmProvided.length > 0 ? llmProvided : scores;
  const averageScore = avgSource.reduce((sum, s) => sum + s.score, 0) / avgSource.length;
  const roundedAvg = Math.round(averageScore * 100) / 100;

  let verdict: CriticVerdict;
  if (roundedAvg >= PASS_THRESHOLD) {
    verdict = "pass";
  } else if (roundedAvg >= REFINE_THRESHOLD) {
    verdict = "refine";
  } else {
    verdict = "regenerate";
  }

  return {
    scores,
    averageScore: roundedAvg,
    verdict,
    refinementInstructions: verdict !== "pass"
      ? llmResponse.refinementInstructions ?? llmResponse.overallFeedback
      : undefined,
  };
}

// ── Helpers ─────────────────────────────────────────────

/** Ensure all required dimensions are present, fill missing with defaults */
function ensureAllDimensions(
  scores: CriticDimensionScore[],
  hasBenchmark?: boolean,
): CriticDimensionScore[] {
  const scoreMap = new Map(scores.map((s) => [s.dimension, s]));

  const dimensions: DimensionName[] = [...BASE_DIMENSIONS];
  if (hasBenchmark) dimensions.push(BENCHMARK_DIMENSION);

  return dimensions.map((dim) => {
    const existing = scoreMap.get(dim);
    if (existing) return existing;
    return { dimension: dim, score: 5, feedback: "평가 누락 — 기본값 적용" };
  });
}

/**
 * Quick critique — evaluate a single slide without full pipeline.
 * Useful for testing or incremental evaluation.
 */
export async function critiqueSingleSlide(
  slide: SlideDesign,
  brief: DesignBrief,
  kit?: BrandKit,
  opts?: CriticOptions,
): Promise<DesignCriticResult> {
  return critiqueDesign(
    { slides: [slide], format: "sns_image", designPath: "template" },
    brief,
    kit,
    opts,
  );
}
