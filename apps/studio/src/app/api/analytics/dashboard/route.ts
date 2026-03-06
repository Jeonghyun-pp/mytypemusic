import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/studio";

/**
 * GET /api/analytics/dashboard — aggregated analytics for all accounts.
 * Query: ?days=30 (default 30)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const days = Math.min(Number(url.searchParams.get("days") ?? 30), 90);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: { date: { gte: since } },
      orderBy: { date: "asc" },
    });

    // Aggregate by account
    const accountMap = new Map<string, {
      snsAccountId: string;
      platform: string;
      latestFollowers: number;
      followersGrowth: number;
      totalReach: number;
      totalEngagement: number;
      avgEngagementRate: number;
      dataPoints: number;
      demographics: unknown;
      timeline: Array<{ date: string; followers: number; reach: number; engagement: number }>;
    }>();

    for (const snap of snapshots) {
      const key = snap.snsAccountId;
      const existing = accountMap.get(key);
      if (existing) {
        existing.latestFollowers = snap.followers;
        existing.followersGrowth += snap.followersGrowth;
        existing.totalReach += snap.reach;
        existing.totalEngagement += snap.engagement;
        existing.avgEngagementRate += snap.engagementRate;
        existing.dataPoints++;
        if (snap.demographics) existing.demographics = snap.demographics;
        existing.timeline.push({
          date: snap.date.toISOString().split("T")[0] ?? "",
          followers: snap.followers,
          reach: snap.reach,
          engagement: snap.engagement,
        });
      } else {
        accountMap.set(key, {
          snsAccountId: snap.snsAccountId,
          platform: snap.platform,
          latestFollowers: snap.followers,
          followersGrowth: snap.followersGrowth,
          totalReach: snap.reach,
          totalEngagement: snap.engagement,
          avgEngagementRate: snap.engagementRate,
          dataPoints: 1,
          demographics: snap.demographics ?? null,
          timeline: [{
            date: snap.date.toISOString().split("T")[0] ?? "",
            followers: snap.followers,
            reach: snap.reach,
            engagement: snap.engagement,
          }],
        });
      }
    }

    // Calculate averages
    const accounts = Array.from(accountMap.values()).map((a) => ({
      ...a,
      avgEngagementRate: a.dataPoints > 0 ? a.avgEngagementRate / a.dataPoints : 0,
    }));

    // Total counts
    const totalPublications = await prisma.publication.count({
      where: { publishedAt: { gte: since } },
    });

    return json({
      period: { days, since: since.toISOString() },
      accounts,
      totalPublications,
      totalSnapshots: snapshots.length,
    });
  } catch (e) {
    return serverError(String(e));
  }
}
