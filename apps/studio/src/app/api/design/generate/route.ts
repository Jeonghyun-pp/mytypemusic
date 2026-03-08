/**
 * POST /api/design/generate
 *
 * Design Engine entry point — generates a DesignBrief and visual designs
 * from content input. Combines Design Director + Visual Designer agents.
 *
 * Request body:
 *   - topic: string (required)
 *   - content: string (required) — article text
 *   - contentSlides: Array<{ title, body, footer? }> — slide-level content
 *   - referenceImageUrl?: string
 *   - platforms?: DesignPlatform[] — defaults to brief output plan
 *   - preferGenerated?: boolean — use Path B (LLM-generated HTML)
 *   - skip?: { cardNews?, snsImages?, motionGraphic?, dataViz?, coverImage? }
 *
 * Response:
 *   - brief: DesignBrief
 *   - results: Array<{ format, platform, slides, designPath }>
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { generateDesignBrief } from "@/lib/design/design-director";
import { generateVisualDesign } from "@/lib/design/visual-designer";
import type { DesignEngineInput, DesignPlatform, DesignFormat } from "@/lib/design/types";
import { PLATFORM_SIZES } from "@/lib/design/types";

const VALID_PLATFORMS = Object.keys(PLATFORM_SIZES) as DesignPlatform[];

const contentSlideSchema = z.object({
  title: z.string(),
  body: z.string(),
  footer: z.string().optional(),
  role: z.enum(["cover", "body", "outro"]).optional(),
});

const requestSchema = z.object({
  topic: z.string().min(1, "topic is required"),
  content: z.string().min(10, "content must be at least 10 characters"),
  contentSlides: z.array(contentSlideSchema).optional(),
  referenceImageUrl: z.string().url().optional(),
  platforms: z.array(z.enum(VALID_PLATFORMS as [string, ...string[]])).optional(),
  preferGenerated: z.boolean().optional(),
  skip: z.object({
    cardNews: z.boolean().optional(),
    snsImages: z.boolean().optional(),
    motionGraphic: z.boolean().optional(),
    dataViz: z.boolean().optional(),
    coverImage: z.boolean().optional(),
  }).optional(),
});

export async function POST(req: Request) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const start = performance.now();

  // 1. Generate DesignBrief via Design Director
  const engineInput: DesignEngineInput = {
    topic: body.topic,
    content: body.content,
    referenceImageUrl: body.referenceImageUrl,
    skip: body.skip,
  };

  let brief;
  try {
    brief = await generateDesignBrief(engineInput);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Design Director failed", details: msg },
      { status: 500 },
    );
  }

  // 2. Prepare content slides
  const contentSlides = body.contentSlides
    ?? [{ title: brief.keyMessage, body: body.topic, footer: "Web Magazine" }];

  const preferGenerated = body.preferGenerated === true;

  // 3. Generate visual designs for each planned output
  const targetOutputs = brief.outputs.filter(
    (o) => o.format === "card_news" || o.format === "sns_image" || o.format === "quote_card",
  );

  // Allow caller to override platforms — find matching format from brief or default to sns_image
  const outputs = body.platforms
    ? body.platforms.map((p) => {
        const briefOutput = brief.outputs.find((o) => o.platform === p);
        return {
          format: (briefOutput?.format ?? "sns_image") as DesignFormat,
          platform: p as DesignPlatform,
          priority: "must" as const,
        };
      })
    : targetOutputs;

  const results: Array<{
    format: DesignFormat;
    platform: DesignPlatform;
    slides: Array<{ index: number; jsxCode: string; width: number; height: number }>;
    designPath: "template" | "generated";
  }> = [];

  const errors: Array<{
    format: DesignFormat;
    platform: DesignPlatform;
    error: string;
  }> = [];

  for (const output of outputs) {
    try {
      const result = await generateVisualDesign(
        { brief, contentSlides, preferGenerated },
        output.format,
        output.platform,
      );
      results.push({
        format: result.format,
        platform: output.platform,
        slides: result.slides,
        designPath: result.designPath,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Visual design failed for ${output.format}@${output.platform}:`, msg);
      errors.push({
        format: output.format,
        platform: output.platform,
        error: msg,
      });
    }
  }

  const elapsed = Math.round(performance.now() - start);

  return NextResponse.json({
    brief,
    results,
    ...(errors.length > 0 ? { errors } : {}),
    generationTimeMs: elapsed,
  });
}
