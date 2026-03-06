// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonInput = any;
import { prisma } from "@/lib/db";
import type { JobType, JobHandler } from "./types";

const handlers = new Map<string, JobHandler>();

/** Vercel Pro function timeout is 60s; leave 5s margin. */
const HANDLER_TIMEOUT_MS = 55_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Job handler timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/** Register a job handler for a given type. */
export function registerHandler(handler: JobHandler) {
  handlers.set(handler.type, handler);
}

/** Enqueue a new job for future processing. */
export async function enqueueJob(opts: {
  type: JobType;
  payload?: Record<string, unknown>;
  scheduledAt?: Date;
  priority?: number;
  maxRetries?: number;
}) {
  return prisma.job.create({
    data: {
      type: opts.type,
      payload: (opts.payload ?? {}) as JsonInput,
      scheduledAt: opts.scheduledAt ?? new Date(),
      priority: opts.priority ?? 0,
      maxRetries: opts.maxRetries ?? 3,
    },
  });
}

/**
 * Process pending jobs. Called by Vercel Cron every 5 minutes.
 * Picks up to `batchSize` jobs ordered by priority DESC, scheduledAt ASC.
 * Also recovers jobs stuck in "running" for >10 minutes (crash recovery).
 */
export async function processJobs(batchSize = 10): Promise<{
  processed: number;
  failed: number;
  recovered: number;
  results: Array<{ jobId: string; type: string; status: string }>;
}> {
  // Recover orphaned "running" jobs (crashed/timed-out handlers)
  const TEN_MIN_AGO = new Date(Date.now() - 10 * 60 * 1000);
  const { count: recovered } = await prisma.job.updateMany({
    where: {
      status: "running",
      startedAt: { lt: TEN_MIN_AGO },
    },
    data: {
      status: "pending",
      error: "Auto-recovered from stuck running state",
    },
  });

  const now = new Date();
  const jobs = await prisma.job.findMany({
    where: {
      status: "pending",
      scheduledAt: { lte: now },
    },
    orderBy: [{ priority: "desc" }, { scheduledAt: "asc" }],
    take: batchSize,
  });

  const results: Array<{ jobId: string; type: string; status: string }> = [];
  let failed = 0;

  for (const job of jobs) {
    const handler = handlers.get(job.type);
    if (!handler) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "failed",
          error: `No handler registered for job type: ${job.type}`,
          completedAt: new Date(),
        },
      });
      results.push({ jobId: job.id, type: job.type, status: "failed" });
      failed++;
      continue;
    }

    // Mark as running
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "running", startedAt: new Date() },
    });

    try {
      const result = await withTimeout(
        handler.handle(job.payload as Record<string, unknown>),
        HANDLER_TIMEOUT_MS,
      );
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "completed",
          result: result as JsonInput,
          completedAt: new Date(),
        },
      });
      results.push({ jobId: job.id, type: job.type, status: "completed" });
    } catch (e) {
      const retryCount = job.retryCount + 1;
      const shouldRetry = retryCount < job.maxRetries;
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: shouldRetry ? "pending" : "failed",
          error: String(e),
          retryCount,
          // exponential backoff: 1min, 4min, 9min ...
          scheduledAt: shouldRetry
            ? new Date(Date.now() + retryCount * retryCount * 60_000)
            : undefined,
          completedAt: shouldRetry ? undefined : new Date(),
        },
      });
      results.push({
        jobId: job.id,
        type: job.type,
        status: shouldRetry ? "retrying" : "failed",
      });
      failed++;
    }
  }

  return { processed: jobs.length, failed, recovered, results };
}
