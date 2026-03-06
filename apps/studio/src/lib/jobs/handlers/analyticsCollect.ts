// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonInput = any;
import { prisma } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs";
import { getValidToken } from "@/lib/sns/tokenManager";
import { getInsightsAdapter } from "@/lib/sns/insights";
import type { JobHandler } from "../types";

/**
 * Analytics collection job: gathers daily metrics from connected SNS accounts.
 * Runs once daily via Vercel Cron.
 * Creates AnalyticsSnapshot records for each active account.
 */
export const analyticsCollectHandler: JobHandler = {
  type: "analytics_collect",
  async handle() {
    const accounts = await prisma.snsAccount.findMany({
      where: { isActive: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let collected = 0;

    for (const account of accounts) {
      // Skip if we already have today's snapshot
      const existing = await prisma.analyticsSnapshot.findUnique({
        where: {
          snsAccountId_date: {
            snsAccountId: account.id,
            date: today,
          },
        },
      });
      if (existing) continue;

      // Get yesterday's snapshot for growth calculation
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const prevSnapshot = await prisma.analyticsSnapshot.findUnique({
        where: {
          snsAccountId_date: {
            snsAccountId: account.id,
            date: yesterday,
          },
        },
      });

      // Count publications and engagement from today
      const todayPubs = await prisma.publication.findMany({
        where: {
          snsAccountId: account.id,
          publishedAt: { gte: today },
        },
      });

      const todayPerf = await prisma.postPerformance.findMany({
        where: {
          snsAccountId: account.id,
          snapshotAt: { gte: today },
        },
      });

      const totalLikes = todayPerf.reduce((sum, p) => sum + p.likes, 0);
      const totalComments = todayPerf.reduce((sum, p) => sum + p.comments, 0);
      const totalShares = todayPerf.reduce((sum, p) => sum + p.shares, 0);
      const totalViews = todayPerf.reduce((sum, p) => sum + p.views, 0);
      const engagement = totalLikes + totalComments + totalShares;

      // Fetch real follower count + demographics from platform API
      let followers = prevSnapshot?.followers ?? 0;
      let demographics: JsonInput = null;
      const adapter = getInsightsAdapter(account.platform);
      if (adapter?.fetchAccountInsights) {
        try {
          const accessToken = await getValidToken(account.id);
          const accountInsights = await adapter.fetchAccountInsights(
            accessToken,
            account.platformUserId,
          );
          followers = accountInsights.followersCount;
          if (accountInsights.demographics) {
            demographics = accountInsights.demographics;
          }
        } catch {
          // Fallback to previous data if API fails
        }
      }

      const followersGrowth = prevSnapshot
        ? followers - prevSnapshot.followers
        : 0;

      await prisma.analyticsSnapshot.create({
        data: {
          snsAccountId: account.id,
          platform: account.platform,
          date: today,
          followers,
          followersGrowth,
          reach: totalViews,
          impressions: totalViews,
          engagement,
          engagementRate: totalViews > 0 ? engagement / totalViews : 0,
          profileViews: 0,
          demographics,
          topPosts: todayPubs.slice(0, 5).map((p) => ({
            postId: p.platformPostId,
            text: ((p.content as Record<string, unknown>)?.text as string ?? "").slice(0, 100),
          })),
        },
      });
      collected++;
    }

    // Trigger persona learning after analytics collection
    await enqueueJob({ type: "persona_learn", payload: {} });

    return { accountsProcessed: accounts.length, snapshotsCreated: collected };
  },
};
