import { prisma } from "@/lib/db";
import { json, badRequest, serverError } from "@/lib/studio";

/**
 * GET /api/analytics/optimal-times/[accountId]
 * Returns top-5 optimal posting times based on historical engagement data.
 * Query: ?platform=threads (optional filter)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    const { accountId } = await params;
    if (!accountId) return badRequest("accountId is required");

    const url = new URL(req.url);
    const platform = url.searchParams.get("platform");

    const where: Record<string, unknown> = { snsAccountId: accountId };
    if (platform) where.platform = platform;

    const performances = await prisma.postPerformance.findMany({
      where,
      select: {
        dayOfWeek: true,
        hourOfDay: true,
        engagementRate: true,
        views: true,
        likes: true,
        comments: true,
      },
    });

    if (performances.length === 0) {
      return json({
        accountId,
        recommendations: [],
        message: "Not enough data yet. Publish more content to get recommendations.",
        totalDataPoints: 0,
      });
    }

    // Aggregate by (dayOfWeek, hourOfDay)
    const slotMap = new Map<
      string,
      { dayOfWeek: number; hourOfDay: number; totalEngagement: number; count: number; totalViews: number }
    >();

    for (const p of performances) {
      const key = `${p.dayOfWeek}-${p.hourOfDay}`;
      const existing = slotMap.get(key);
      if (existing) {
        existing.totalEngagement += p.engagementRate;
        existing.totalViews += p.views;
        existing.count += 1;
      } else {
        slotMap.set(key, {
          dayOfWeek: p.dayOfWeek,
          hourOfDay: p.hourOfDay,
          totalEngagement: p.engagementRate,
          totalViews: p.views,
          count: 1,
        });
      }
    }

    // Calculate averages and rank
    const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
    const ranked = Array.from(slotMap.values())
      .map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        dayLabel: DAY_LABELS[slot.dayOfWeek] ?? "",
        hourOfDay: slot.hourOfDay,
        timeLabel: `${String(slot.hourOfDay).padStart(2, "0")}:00`,
        avgEngagementRate: slot.totalEngagement / slot.count,
        avgViews: Math.round(slot.totalViews / slot.count),
        dataPoints: slot.count,
      }))
      .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
      .slice(0, 5);

    // Build a 7x24 heatmap (engagement rate)
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const slot of slotMap.values()) {
      heatmap[slot.dayOfWeek]![slot.hourOfDay] = slot.totalEngagement / slot.count;
    }

    return json({
      accountId,
      platform: platform ?? "all",
      recommendations: ranked,
      heatmap,
      totalDataPoints: performances.length,
    });
  } catch (e) {
    return serverError(String(e));
  }
}
