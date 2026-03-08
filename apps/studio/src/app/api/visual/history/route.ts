import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/visual/history
 * Returns image generation history with cost summary.
 *
 * Query: ?limit=20&offset=0
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);
    const offset = Number(url.searchParams.get("offset") ?? "0");

    const [items, total, costAgg] = await Promise.all([
      prisma.imageGenHistory.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.imageGenHistory.count(),
      prisma.imageGenHistory.aggregate({
        _sum: { costUsd: true },
        _count: true,
      }),
    ]);

    // Cost breakdown by provider
    const providerCosts = await prisma.imageGenHistory.groupBy({
      by: ["provider"],
      _sum: { costUsd: true },
      _count: true,
      _avg: { elapsedMs: true },
    });

    return NextResponse.json({
      items,
      total,
      totalCostUsd: costAgg._sum.costUsd ?? 0,
      totalCount: costAgg._count,
      providerBreakdown: providerCosts.map((p) => ({
        provider: p.provider,
        count: p._count,
        totalCostUsd: p._sum.costUsd ?? 0,
        avgElapsedMs: Math.round(p._avg.elapsedMs ?? 0),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
