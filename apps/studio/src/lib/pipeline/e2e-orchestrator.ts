/**
 * E2E Pipeline Orchestrator — chains the full content production pipeline:
 *   Topic → Research → Article → Design → (Optional) Publish
 *
 * Each stage is modular and can be skipped or replaced.
 */

import { runPipeline } from "./orchestrator";
import type { PipelineResult, PersonaContext, ContentType } from "./types";
import { generateDesignBrief } from "../design/design-director";
import { generateVisualDesign } from "../design/visual-designer";
import { generateDataViz } from "../design/data-viz-agent";
import { runRefinementLoop } from "../design/refinement-loop";
import type {
  DesignEngineInput,
  DesignBrief,
  DesignFormat,
  DesignPlatform,
  DesignQualityRecord,
  DataVizResult,
} from "../design/types";
import type { VisualDesignResult } from "../design/types";

// ── Types ──────────────────────────────────────────────

export type E2EStage =
  | "idle"
  | "researching"
  | "writing"
  | "editing"
  | "designing"
  | "rendering"
  | "publishing"
  | "completed"
  | "failed";

export interface E2EInput {
  topic: string;
  contentType?: ContentType;
  targetWordCount?: number;
  persona?: PersonaContext | null;
  referenceImageUrl?: string;
  /** Sourced images from Unsplash/Spotify for designs */
  sourcedImageUrls?: string[];
  /** Trend context for visual emphasis (from TopicScore) */
  trendContext?: {
    velocity: number;
    sourceCount: number;
    isExploration: boolean;
  };
  platforms?: DesignPlatform[];
  preferGenerated?: boolean;
  /** Enable critique-refine loop for higher quality designs (default: true) */
  enableRefinement?: boolean;
  /** Max refinement iterations per design output (default: 3) */
  maxRefinementIterations?: number;
  skip?: {
    article?: boolean;
    design?: boolean;
    dataViz?: boolean;
    publish?: boolean;
  };
  /** Pre-existing article content (skip article generation) */
  existingContent?: string;
  /** Called when pipeline stage changes */
  onStageChange?: (stage: E2EStage, detail?: string) => void;
}

export interface E2EDesignOutput {
  brief: DesignBrief;
  visualResults: Array<{
    format: DesignFormat;
    platform: DesignPlatform;
    slides: VisualDesignResult["slides"];
    designPath: "template" | "generated";
    /** Quality record from refinement loop (present when refinement enabled) */
    quality?: DesignQualityRecord;
    /** Number of refinement iterations performed */
    iterationCount?: number;
  }>;
  dataViz?: DataVizResult;
  errors: Array<{ format: DesignFormat; platform: DesignPlatform; error: string }>;
}

export interface E2EResult {
  stage: E2EStage;
  article?: PipelineResult;
  design?: E2EDesignOutput;
  totalTimeMs: number;
  stageTimings: Record<string, number>;
}

// ── Main Orchestrator ──────────────────────────────────

export async function runE2EPipeline(input: E2EInput): Promise<E2EResult> {
  const start = performance.now();
  const timings: Record<string, number> = {};
  const notify = input.onStageChange ?? (() => {});

  let article: PipelineResult | undefined;
  let design: E2EDesignOutput | undefined;

  try {
    // ── Stage 1: Article Generation ──
    let articleContent: string;

    if (input.existingContent) {
      articleContent = input.existingContent;
    } else if (input.skip?.article) {
      articleContent = input.topic;
    } else {
      notify("researching", "기사 리서치 중...");
      const articleStart = performance.now();

      article = await runPipeline({
        topic: input.topic,
        contentType: input.contentType,
        targetWordCount: input.targetWordCount,
        persona: input.persona,
        onStatusChange: (status) => {
          if (status === "outlined") notify("researching", "아웃라인 생성 완료");
          else if (status === "drafting") notify("writing", "초고 작성 중...");
          else if (status === "drafted") notify("writing", "초고 완료");
          else if (status === "editing") notify("editing", "에디터 검토 중...");
        },
      });

      timings.article = Math.round(performance.now() - articleStart);

      if (article.status === "failed") {
        notify("failed", article.error);
        return { stage: "failed", article, totalTimeMs: Math.round(performance.now() - start), stageTimings: timings };
      }

      articleContent = article.editedContent || article.draftContent;
    }

    // ── Stage 2: Design Generation ──
    if (!input.skip?.design) {
      notify("designing", "디자인 브리프 생성 중...");
      const designStart = performance.now();

      const engineInput: DesignEngineInput = {
        topic: input.topic,
        content: articleContent,
        referenceImageUrl: input.referenceImageUrl,
        sourcedImageUrls: input.sourcedImageUrls,
        trendContext: input.trendContext,
        skip: {
          dataViz: input.skip?.dataViz,
        },
      };

      const brief = await generateDesignBrief(engineInput);

      // Prepare content slides from article
      const contentSlides = buildContentSlides(articleContent, brief);

      // Generate visual designs for each planned output
      const targetOutputs = brief.outputs.filter(
        (o) => o.format === "card_news" || o.format === "sns_image" || o.format === "quote_card",
      );

      const outputs = input.platforms
        ? input.platforms.map((p) => {
            const briefOutput = brief.outputs.find((o) => o.platform === p);
            return {
              format: (briefOutput?.format ?? "sns_image") as DesignFormat,
              platform: p,
              priority: "must" as const,
            };
          })
        : targetOutputs;

      notify("rendering", `${String(outputs.length)}개 디자인 생성 중...`);

      const visualResults: E2EDesignOutput["visualResults"] = [];
      const errors: E2EDesignOutput["errors"] = [];

      const useRefinement = input.enableRefinement !== false;

      for (const output of outputs) {
        try {
          const designInput = {
            brief,
            contentSlides,
            preferGenerated: input.preferGenerated,
            sourcedImageUrls: input.sourcedImageUrls,
          };

          if (useRefinement) {
            const refinementResult = await runRefinementLoop(
              designInput,
              brief,
              output.format,
              output.platform,
              {
                maxIterations: input.maxRefinementIterations ?? 3,
                imageDetail: "low",
              },
            );
            visualResults.push({
              format: output.format,
              platform: output.platform,
              slides: refinementResult.design.slides,
              designPath: refinementResult.design.designPath,
              quality: refinementResult.quality,
              iterationCount: refinementResult.iterations.length,
            });
          } else {
            const result = await generateVisualDesign(
              designInput,
              output.format,
              output.platform,
            );
            visualResults.push({
              format: output.format,
              platform: output.platform,
              slides: result.slides,
              designPath: result.designPath,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ format: output.format, platform: output.platform, error: msg });
        }
      }

      // Optional: Data visualization
      let dataViz: DataVizResult | undefined;
      if (!input.skip?.dataViz && brief.contentType === "data_insight") {
        try {
          dataViz = await generateDataViz(brief, articleContent);
        } catch {
          // Non-critical — continue without data viz
        }
      }

      design = { brief, visualResults, dataViz, errors };
      timings.design = Math.round(performance.now() - designStart);
    }

    // ── Stage 3: Publishing (deferred) ──
    // Publishing is intentionally not auto-triggered in the E2E pipeline.
    // The caller should use the SNS publish API after reviewing the output.

    notify("completed", "파이프라인 완료");

    return {
      stage: "completed",
      article,
      design,
      totalTimeMs: Math.round(performance.now() - start),
      stageTimings: timings,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    notify("failed", msg);
    return {
      stage: "failed",
      article,
      design,
      totalTimeMs: Math.round(performance.now() - start),
      stageTimings: timings,
    };
  }
}

// ── Helpers ────────────────────────────────────────────

/**
 * Build content slides from article text for the Visual Designer.
 * Splits the article into logical sections for card news slides.
 */
function buildContentSlides(
  content: string,
  brief: DesignBrief,
): Array<{ title: string; body: string; footer?: string; role?: "cover" | "body" | "outro" }> {
  const slides: Array<{ title: string; body: string; footer?: string; role?: "cover" | "body" | "outro" }> = [];

  // Cover slide
  slides.push({
    title: brief.keyMessage,
    body: brief.visualConcept,
    footer: "Web Magazine",
    role: "cover",
  });

  // Split content into paragraphs and group into slides
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  // Target 4-6 body slides depending on content length
  const targetSlides = Math.min(6, Math.max(2, Math.ceil(paragraphs.length / 2)));
  const chunkSize = Math.max(1, Math.ceil(paragraphs.length / targetSlides));

  for (let i = 0; i < paragraphs.length; i += chunkSize) {
    const chunk = paragraphs.slice(i, i + chunkSize);
    const slideNum = slides.length;

    // Extract first sentence as title, rest as body
    const fullText = chunk.join("\n\n");
    const firstSentence = fullText.match(/^[^.!?]+[.!?]/)?.[0] ?? fullText.slice(0, 60);
    const body = fullText.slice(firstSentence.length).trim() || fullText;

    slides.push({
      title: `POINT ${String(slideNum).padStart(2, "0")}`,
      body: body.slice(0, 200),
      role: "body",
    });
  }

  // Outro slide
  slides.push({
    title: brief.keyMessage,
    body: "더 많은 콘텐츠는 프로필 링크에서 확인하세요",
    footer: "@web_magazine",
    role: "outro",
  });

  return slides;
}
