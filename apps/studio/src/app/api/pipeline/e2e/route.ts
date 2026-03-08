/**
 * POST /api/pipeline/e2e
 *
 * Full E2E pipeline: Topic → Article → Design → (optional) Publish
 *
 * Request body:
 *   - topic: string (required)
 *   - contentType?: "blog" | "sns" | "carousel" | "review"
 *   - targetWordCount?: number
 *   - personaId?: string
 *   - referenceImageUrl?: string
 *   - platforms?: DesignPlatform[]
 *   - preferGenerated?: boolean
 *   - existingContent?: string (skip article generation)
 *   - skip?: { article?, design?, dataViz?, publish? }
 *
 * Response (streamed via SSE):
 *   - stage events: { type: "stage", stage, detail }
 *   - result event:  { type: "result", result: E2EResult }
 *   - error event:   { type: "error", error: string }
 */

import { z } from "zod";
import { runE2EPipeline } from "@/lib/pipeline/e2e-orchestrator";
import type { E2EStage } from "@/lib/pipeline/e2e-orchestrator";
import { prisma } from "@/lib/db";

const requestSchema = z.object({
  topic: z.string().min(1, "topic is required"),
  contentType: z.enum(["blog", "sns", "carousel", "review"]).optional(),
  targetWordCount: z.number().int().min(100).max(10000).optional(),
  personaId: z.string().optional(),
  referenceImageUrl: z.string().url().optional(),
  platforms: z.array(z.enum(["instagram", "instagram_story", "twitter", "youtube_thumb", "facebook", "blog", "tiktok"])).optional(),
  preferGenerated: z.boolean().optional(),
  existingContent: z.string().optional(),
  skip: z.object({
    article: z.boolean().optional(),
    design: z.boolean().optional(),
    dataViz: z.boolean().optional(),
    publish: z.boolean().optional(),
  }).optional(),
});

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = parsed.data;

  // Resolve persona if provided
  let persona = null;
  if (body.personaId) {
    try {
      const p = await prisma.writingPersona.findUnique({ where: { id: body.personaId } });
      if (p) {
        persona = {
          name: p.name,
          styleFingerprint: p.styleFingerprint ?? "",
          perspective: "",
          expertiseAreas: [],
          tone: p.tone as Record<string, unknown> | null,
          emotionalDrivers: [],
          vocabulary: p.vocabulary as Record<string, unknown> | null,
          structure: p.structure as Record<string, unknown> | null,
          contentRules: null,
          goldenExamples: null,
          channelProfiles: null,
        };
      }
    } catch {
      // Continue without persona
    }
  }

  // Stream SSE response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await runE2EPipeline({
          topic: body.topic,
          contentType: body.contentType,
          targetWordCount: body.targetWordCount,
          persona,
          referenceImageUrl: body.referenceImageUrl,
          platforms: body.platforms as import("@/lib/design/types").DesignPlatform[] | undefined,
          preferGenerated: body.preferGenerated,
          existingContent: body.existingContent,
          skip: body.skip,
          onStageChange: (stage: E2EStage, detail?: string) => {
            try {
              controller.enqueue(
                encoder.encode(sseEvent({ type: "stage", stage, detail })),
              );
            } catch {
              // Client disconnected — ignore enqueue errors
            }
          },
        });

        controller.enqueue(
          encoder.encode(sseEvent({ type: "result", result })),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(sseEvent({ type: "error", error: msg })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
