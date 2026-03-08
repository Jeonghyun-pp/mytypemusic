import { NextResponse } from "next/server";
import { getQualityStats, getQualityTrends } from "@/lib/design/quality-store";
import {
  getStyleInsights,
  getPerformanceSummary,
  getTopTemplates,
} from "@/lib/design/style-performance";
import { prisma } from "@/lib/db";

/**
 * GET /api/analytics/design
 *
 * Returns design quality stats, style performance insights,
 * quality trends, and optimal publishing time heatmap.
 *
 * Query params:
 *   days=30 (trend period, default 30)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const days = Math.min(Number(url.searchParams.get("days") ?? "30"), 90);

    // 1. Quality stats (in-memory)
    const qualityStats = getQualityStats();

    // 2. Quality trends (in-memory)
    const qualityTrends = getQualityTrends(days);

    // 3. Style insights (in-memory) — top performing attributes
    const styleInsights = getStyleInsights();

    // 4. Performance summary (in-memory)
    const performanceSummary = getPerformanceSummary();

    // 5. Top templates (in-memory)
    const topTemplates = getTopTemplates(10);

    // 6. Optimal posting times from PostPerformance (DB)
    let heatmap: { dayOfWeek: number; hourOfDay: number; avgEngagement: number; count: number }[] = [];
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const raw = await prisma.postPerformance.groupBy({
        by: ["dayOfWeek", "hourOfDay"],
        where: { publishedAt: { gte: since } },
        _avg: { engagementRate: true },
        _count: true,
      });

      heatmap = raw.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        hourOfDay: r.hourOfDay,
        avgEngagement: r._avg.engagementRate ?? 0,
        count: r._count,
      }));
    } catch {
      // DB not available or no data — return empty
    }

    // 7. Content type performance from StylePerformanceEntry (DB)
    let contentTypePerf: { contentType: string; avgEngagement: number; count: number }[] = [];
    try {
      const raw = await prisma.stylePerformanceEntry.groupBy({
        by: ["contentType"],
        where: { engagementRate: { not: null } },
        _avg: { engagementRate: true },
        _count: true,
      });

      contentTypePerf = raw
        .map((r) => ({
          contentType: r.contentType,
          avgEngagement: r._avg.engagementRate ?? 0,
          count: r._count,
        }))
        .sort((a, b) => b.avgEngagement - a.avgEngagement);
    } catch {
      // DB not available
    }

    return NextResponse.json({
      days,
      qualityStats,
      qualityTrends,
      styleInsights,
      performanceSummary,
      topTemplates,
      heatmap,
      contentTypePerf,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
