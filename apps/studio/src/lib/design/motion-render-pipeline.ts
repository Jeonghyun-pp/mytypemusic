/**
 * Motion Render Pipeline — orchestrates motion design generation + rendering.
 *
 * Pipeline:
 *   1. Generate DesignBrief (if not provided)
 *   2. Detect best motion skill
 *   3. Generate composition props via Motion Designer
 *   4. Render via Remotion Lambda (or return props for preview)
 */

import type { DesignBrief, DesignEngineInput, MotionDesignResult, DesignPlatform } from "./types";
import { generateDesignBrief } from "./design-director";
import { generateMotionDesign } from "./motion-designer";
import type { MotionDesignerOptions } from "./motion-designer";
import { renderComposition } from "../remotion/renderClient";

// ── Types ───────────────────────────────────────────

export interface MotionRenderOptions extends MotionDesignerOptions {
  /** If true, skip Lambda render and return props only (for preview). */
  previewOnly?: boolean;
  /** Video codec. */
  codec?: "h264" | "h265";
}

export interface MotionRenderResult {
  /** The design result with composition props. */
  design: MotionDesignResult;
  /** Lambda render output URL (null if previewOnly). */
  videoUrl: string | null;
  /** Lambda render ID (null if previewOnly). */
  renderId: string | null;
  /** Total pipeline time in ms. */
  totalTimeMs: number;
}

// ── Main pipeline ───────────────────────────────────

/**
 * Full motion render pipeline:
 * Input → Brief → Skill Detection → Props Generation → Lambda Render
 */
export async function runMotionPipeline(
  input: DesignEngineInput,
  opts?: MotionRenderOptions,
): Promise<MotionRenderResult> {
  const start = performance.now();

  // 1. Generate design brief
  const brief = await generateDesignBrief(input);

  // 2. Generate motion design (skill detection + props)
  return runMotionPipelineFromBrief(brief, opts, start);
}

/**
 * Motion pipeline from an existing brief.
 */
export async function runMotionPipelineFromBrief(
  brief: DesignBrief,
  opts?: MotionRenderOptions,
  startTime?: number,
): Promise<MotionRenderResult> {
  const start = startTime ?? performance.now();
  const platform = opts?.platform ?? "instagram";

  // Generate motion design
  const design = await generateMotionDesign(brief, {
    ...opts,
    platform,
  });

  // Preview mode — skip render
  if (opts?.previewOnly) {
    return {
      design,
      videoUrl: null,
      renderId: null,
      totalTimeMs: Math.round(performance.now() - start),
    };
  }

  // Lambda render
  try {
    const renderResult = await renderComposition({
      compositionId: design.compositionId,
      inputProps: design.props,
      codec: opts?.codec ?? "h264",
    });

    return {
      design,
      videoUrl: renderResult.downloadUrl,
      renderId: renderResult.renderId,
      totalTimeMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    console.error("Motion render failed:", err);
    // Return design without video on render failure
    return {
      design,
      videoUrl: null,
      renderId: null,
      totalTimeMs: Math.round(performance.now() - start),
    };
  }
}
