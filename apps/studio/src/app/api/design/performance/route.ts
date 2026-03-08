/**
 * GET /api/design/performance — Get style performance insights & recommendations
 * POST /api/design/performance — Record design style or update engagement metrics
 *
 * Query params (GET):
 *   - contentType?: DesignContentType
 *   - platform?: DesignPlatform
 *   - view?: "insights" | "recommendations" | "templates" | "summary"
 *
 * POST body:
 *   - action: "record" | "update_engagement"
 *   - For "record": { record: StylePerformanceRecord }
 *   - For "update_engagement": { id, metrics: { impressions?, engagements?, saves?, shares?, clicks? } }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getStyleInsights,
  getStyleRecommendation,
  getTopTemplates,
  getPerformanceSummary,
  recordDesignStyle,
  updateEngagement,
} from "@/lib/design/style-performance";
import type { DesignContentType, DesignPlatform } from "@/lib/design/types";
import type { StylePerformanceRecord } from "@/lib/design/style-performance";

const recordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number(),
  contentType: z.string(),
  format: z.string(),
  platform: z.string(),
  templateId: z.string().optional(),
  designPath: z.enum(["template", "generated", "motion", "data_viz"]),
  typographyMood: z.string().optional(),
  layoutStyle: z.string().optional(),
  colorMood: z.string().optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  hasImage: z.boolean(),
  slideCount: z.number().int().min(0),
});

const metricsSchema = z.object({
  impressions: z.number().min(0).optional(),
  engagements: z.number().min(0).optional(),
  saves: z.number().min(0).optional(),
  shares: z.number().min(0).optional(),
  clicks: z.number().min(0).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "summary";
  const contentType = url.searchParams.get("contentType") as DesignContentType | null;
  const platform = url.searchParams.get("platform") as DesignPlatform | null;

  const filter: { contentType?: DesignContentType; platform?: DesignPlatform } = {};
  if (contentType) filter.contentType = contentType;
  if (platform) filter.platform = platform;

  switch (view) {
    case "insights":
      return NextResponse.json({ insights: getStyleInsights(filter) });

    case "recommendations":
      if (!contentType || !platform) {
        return NextResponse.json(
          { error: "contentType and platform required for recommendations" },
          { status: 400 },
        );
      }
      return NextResponse.json({
        recommendation: getStyleRecommendation(contentType, platform),
      });

    case "templates":
      return NextResponse.json({ templates: getTopTemplates(10, filter) });

    case "summary":
    default:
      return NextResponse.json({
        summary: getPerformanceSummary(),
        topTemplates: getTopTemplates(5, filter),
        insights: getStyleInsights(filter).slice(0, 10),
      });
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action as string;

  if (action === "record") {
    const parsed = recordSchema.safeParse(body.record);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid record", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    recordDesignStyle(parsed.data as StylePerformanceRecord);
    return NextResponse.json({ ok: true });
  }

  if (action === "update_engagement") {
    const id = body.id as string;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const parsed = metricsSchema.safeParse(body.metrics);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid metrics", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const updated = updateEngagement(id, parsed.data);
    return NextResponse.json({ ok: true, updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
