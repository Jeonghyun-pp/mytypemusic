/**
 * Feedback Collector — gathers engagement metrics at scheduled intervals.
 *
 * Schedule: T+1h, T+24h, T+7d, T+30d after publish.
 * Sources: PostPerformance table (populated by SNS analytics jobs).
 */
import { prisma } from "@/lib/db";

export interface MetricsSnapshot {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
}

type MetricsWindow = "1h" | "24h" | "7d" | "30d";

const WINDOW_MS: Record<MetricsWindow, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/**
 * Collect metrics for all pipeline runs that are due for a specific window.
 * Called by a cron job (e.g. every hour).
 */
export async function collectDueMetrics(): Promise<{
  collected: number;
  completed: number;
}> {
  let collected = 0;
  let completed = 0;

  // Find runs that have been published but still need metrics
  const runs = await prisma.pipelineRun.findMany({
    where: {
      publishedAt: { not: null },
      feedbackStatus: { in: ["pending", "collecting"] },
    },
    select: {
      id: true,
      publishedAt: true,
      publicationId: true,
      metrics1h: true,
      metrics24h: true,
      metrics7d: true,
      metrics30d: true,
    },
  });

  for (const run of runs) {
    if (!run.publishedAt) continue;

    const elapsed = Date.now() - run.publishedAt.getTime();
    const updates: Record<string, unknown> = {};

    // Collect each window when due
    if (!run.metrics1h && elapsed >= WINDOW_MS["1h"]) {
      const m = await fetchMetrics(run.publicationId);
      if (m) {
        updates.metrics1h = m;
        updates.feedbackStatus = "collecting";
        collected++;
      }
    }

    if (!run.metrics24h && elapsed >= WINDOW_MS["24h"]) {
      const m = await fetchMetrics(run.publicationId);
      if (m) {
        updates.metrics24h = m;
        collected++;
      }
    }

    if (!run.metrics7d && elapsed >= WINDOW_MS["7d"]) {
      const m = await fetchMetrics(run.publicationId);
      if (m) {
        updates.metrics7d = m;
        collected++;
      }
    }

    if (!run.metrics30d && elapsed >= WINDOW_MS["30d"]) {
      const m = await fetchMetrics(run.publicationId);
      if (m) {
        updates.metrics30d = m;
        // Calculate final engagement metrics
        updates.engagementRate = m.engagementRate;
        updates.contentQualityRatio = calculateQCR(m);
        updates.feedbackStatus = "complete";
        updates.feedbackProcessedAt = new Date();
        completed++;
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.pipelineRun.update({
        where: { id: run.id },
        data: updates,
      });
    }
  }

  return { collected, completed };
}

/**
 * Mark a pipeline run as published, starting the feedback collection cycle.
 */
export async function markPublished(
  pipelineRunId: string,
  publicationId: string,
): Promise<void> {
  await prisma.pipelineRun.update({
    where: { id: pipelineRunId },
    data: {
      publicationId,
      publishedAt: new Date(),
      feedbackStatus: "pending",
    },
  });
}

// ── Internal helpers ───────────────────────────────────

async function fetchMetrics(
  publicationId: string | null,
): Promise<MetricsSnapshot | null> {
  if (!publicationId) return null;

  // Get latest PostPerformance snapshot for this publication
  const perf = await prisma.postPerformance.findFirst({
    where: { publicationId },
    orderBy: { snapshotAt: "desc" },
  });

  if (!perf) return null;

  return {
    views: perf.views,
    likes: perf.likes,
    comments: perf.comments,
    shares: perf.shares,
    saves: perf.saves,
    engagementRate: perf.engagementRate,
  };
}

/**
 * Content Quality Ratio — penalizes clickbait.
 * High views + low engagement = low QCR.
 */
function calculateQCR(m: MetricsSnapshot): number {
  if (m.views === 0) return 0;
  const meaningfulEngagement = m.likes + m.comments * 2 + m.shares * 3 + m.saves * 2;
  return meaningfulEngagement / m.views;
}
