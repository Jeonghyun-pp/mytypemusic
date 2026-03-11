/**
 * Refinement Loop Orchestrator — iteratively improves designs.
 *
 * Pipeline:
 *   Generate → Render → Critique → (Edit → Re-render → Re-critique)*
 *
 * Termination conditions:
 *   1. Verdict = PASS (score >= 8.0)
 *   2. Max iterations reached (default: 3)
 *   3. Score regression (new score <= previous — prevents infinite loops)
 *   4. REGENERATE already used once (prevents restart chains)
 */

import type {
  BenchmarkReport,
  DesignBrief,
  DesignCriticResult,
  DesignFormat,
  DesignPlatform,
  DesignQualityRecord,
  VisualDesignResult,
} from "./types";
import type { BrandKit } from "./brand-kit";
import { DEFAULT_BRAND_KIT } from "./brand-kit";
import { generateVisualDesign } from "./visual-designer";
import type { VisualDesignInput } from "./visual-designer";
import { critiqueDesign } from "./design-critic";
import { interpretAndApply } from "./edit-interpreter";
import { buildBenchmarkReport } from "./benchmark";

// ── Types ───────────────────────────────────────────────

export interface RefinementOptions {
  maxIterations?: number;        // default: 3
  passThreshold?: number;        // default: 8.0
  model?: string;                // LLM model for visual designer
  criticModel?: string;          // LLM model for critic (default: gpt-4o)
  editModel?: string;            // LLM model for edit interpreter
  imageDetail?: "low" | "high";  // Vision detail level
  brandKit?: BrandKit;
  skipCritic?: boolean;          // Skip critic (testing/cost saving)
  /** Pre-built benchmark report; if omitted, auto-built from stores */
  benchmark?: BenchmarkReport | null;
}

export interface IterationRecord {
  iteration: number;
  scores: DesignCriticResult;
  action: "pass" | "refine" | "regenerate" | "accept_best";
  designPath: "template" | "generated";
}

export interface RefinementResult {
  /** Final design result (best version) */
  design: VisualDesignResult;
  /** Quality record for persistence */
  quality: DesignQualityRecord;
  /** Full iteration history */
  iterations: IterationRecord[];
  /** Total time in ms */
  totalTimeMs: number;
}

// ── Main function ───────────────────────────────────────

/**
 * Run the full refinement loop:
 * Generate → Critique → Edit → Re-critique → ... → Final
 */
export async function runRefinementLoop(
  input: VisualDesignInput,
  brief: DesignBrief,
  format: DesignFormat,
  platform: DesignPlatform,
  opts?: RefinementOptions,
): Promise<RefinementResult> {
  const maxIterations = opts?.maxIterations ?? 3;
  const passThreshold = opts?.passThreshold ?? 8.0;
  const kit = opts?.brandKit ?? DEFAULT_BRAND_KIT;
  const start = performance.now();

  // Auto-build benchmark from historical stores unless explicitly null
  const benchmark = opts?.benchmark !== null
    ? (opts?.benchmark ?? buildBenchmarkReport(brief.contentType, platform))
    : undefined;

  const iterations: IterationRecord[] = [];
  let bestDesign: VisualDesignResult | null = null;
  let bestScore = 0;
  let hasRegenerated = false;

  // Initial generation
  let currentDesign = await generateVisualDesign(
    input, format, platform, { model: opts?.model },
  );

  // Skip critic if requested (testing mode)
  if (opts?.skipCritic) {
    return buildResult(
      currentDesign, brief, format, platform,
      [], 10, 0, start,
    );
  }

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // 1. Critique (with benchmark for data-driven evaluation)
    const criticResult = await critiqueDesign(
      currentDesign, brief, kit,
      {
        model: opts?.criticModel,
        imageDetail: opts?.imageDetail,
        benchmark,
      },
    );

    // 2. Record iteration
    const record: IterationRecord = {
      iteration,
      scores: criticResult,
      action: "pass", // will be updated below
      designPath: currentDesign.designPath,
    };

    // 3. Track best
    if (criticResult.averageScore > bestScore) {
      bestScore = criticResult.averageScore;
      bestDesign = currentDesign;
    }

    // 4. Decide action
    if (criticResult.verdict === "pass" || criticResult.averageScore >= passThreshold) {
      record.action = "pass";
      iterations.push(record);
      break;
    }

    // Score regression check (iteration > 0)
    if (iteration > 0 && criticResult.averageScore < iterations[iteration - 1]!.scores.averageScore) {
      record.action = "accept_best";
      iterations.push(record);
      // Revert to best design
      currentDesign = bestDesign!;
      break;
    }

    if (criticResult.verdict === "regenerate") {
      if (hasRegenerated) {
        // Already regenerated once — accept current best
        record.action = "accept_best";
        iterations.push(record);
        currentDesign = bestDesign!;
        break;
      }

      // Regenerate from scratch
      record.action = "regenerate";
      iterations.push(record);
      hasRegenerated = true;

      currentDesign = await generateVisualDesign(
        input, format, platform, { model: opts?.model },
      );
      continue;
    }

    // REFINE: apply edits
    if (criticResult.verdict === "refine" && criticResult.refinementInstructions) {
      record.action = "refine";
      iterations.push(record);

      try {
        const { result } = await interpretAndApply(
          currentDesign,
          criticResult.refinementInstructions,
          { model: opts?.editModel, brief, brandKit: kit },
        );
        currentDesign = result;
      } catch (err) {
        console.error(`Edit failed at iteration ${iteration}:`, err);
        // Keep current design, continue to next iteration
      }
      continue;
    }

    // Fallback: no instructions to refine, accept
    record.action = "accept_best";
    iterations.push(record);
    break;
  }

  // If no iterations ran (shouldn't happen), use initial design
  const finalDesign = currentDesign;
  const finalScore = iterations.length > 0
    ? iterations[iterations.length - 1]!.scores.averageScore
    : 0;
  const iterationCount = iterations.length;

  return buildResult(
    finalDesign, brief, format, platform,
    iterations, finalScore, iterationCount, start,
  );
}

// ── Helpers ─────────────────────────────────────────────

function buildResult(
  design: VisualDesignResult,
  brief: DesignBrief,
  format: DesignFormat,
  platform: DesignPlatform,
  iterations: IterationRecord[],
  finalScore: number,
  iterationCount: number,
  startTime: number,
): RefinementResult {
  const totalTimeMs = Math.round(performance.now() - startTime);

  const quality: DesignQualityRecord = {
    designId: `design_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    contentType: brief.contentType,
    format,
    platform,
    scores: iterations.length > 0
      ? iterations[iterations.length - 1]!.scores.scores
      : [],
    averageScore: finalScore,
    verdict: finalScore >= 8 ? "pass" : finalScore >= 6 ? "refine" : "regenerate",
    iterationCount,
    designPath: design.designPath,
    generationTimeMs: totalTimeMs,
  };

  return { design, quality, iterations, totalTimeMs };
}

/**
 * Quick refinement — single critique + optional edit.
 * Faster alternative to full loop when budget is limited.
 */
export async function quickRefine(
  designResult: VisualDesignResult,
  brief: DesignBrief,
  opts?: RefinementOptions,
): Promise<{ design: VisualDesignResult; critique: DesignCriticResult }> {
  const kit = opts?.brandKit ?? DEFAULT_BRAND_KIT;

  const benchmark = opts?.benchmark !== null
    ? (opts?.benchmark ?? buildBenchmarkReport(brief.contentType, designResult.slides[0]?.platform ?? "instagram"))
    : undefined;

  const critique = await critiqueDesign(
    designResult, brief, kit,
    { model: opts?.criticModel, imageDetail: opts?.imageDetail, benchmark },
  );

  if (critique.verdict === "pass" || !critique.refinementInstructions) {
    return { design: designResult, critique };
  }

  try {
    const { result } = await interpretAndApply(
      designResult,
      critique.refinementInstructions,
      { model: opts?.editModel, brief, brandKit: kit },
    );
    return { design: result, critique };
  } catch {
    return { design: designResult, critique };
  }
}
