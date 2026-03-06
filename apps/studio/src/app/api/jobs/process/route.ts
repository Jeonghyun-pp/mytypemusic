import { json, serverError } from "@/lib/studio";
import { processJobs, registerHandler } from "@/lib/jobs";
import { recoverOrphanedPublications } from "@/lib/sns/publish/publisher";
import { publishHandler } from "@/lib/jobs/handlers/publish";
import { performanceCollectHandler } from "@/lib/jobs/handlers/performanceCollect";
import { autopilotScanHandler } from "@/lib/jobs/handlers/autopilotScan";
import { commentMonitorHandler } from "@/lib/jobs/handlers/commentMonitor";
import { keywordScanHandler } from "@/lib/jobs/handlers/keywordScan";
import { analyticsCollectHandler } from "@/lib/jobs/handlers/analyticsCollect";
import { commentFetchHandler } from "@/lib/jobs/handlers/commentFetch";
import { replySendHandler } from "@/lib/jobs/handlers/replySend";
import { personaLearnHandler } from "@/lib/jobs/handlers/personaLearn";
import { keywordCommentPostHandler } from "@/lib/jobs/handlers/keywordCommentPost";
import { dailyResetHandler } from "@/lib/jobs/handlers/dailyReset";
import { onboardAnalyzeHandler } from "@/lib/jobs/handlers/onboardAnalyze";

// Register all job handlers
registerHandler(publishHandler);
registerHandler(performanceCollectHandler);
registerHandler(autopilotScanHandler);
registerHandler(commentMonitorHandler);
registerHandler(commentFetchHandler);
registerHandler(replySendHandler);
registerHandler(keywordScanHandler);
registerHandler(keywordCommentPostHandler);
registerHandler(dailyResetHandler);
registerHandler(analyticsCollectHandler);
registerHandler(personaLearnHandler);
registerHandler(onboardAnalyzeHandler);

/**
 * POST /api/jobs/process — Process pending jobs.
 * Called by Vercel Cron every 5 minutes.
 * Protected by CRON_SECRET header.
 */
export async function POST(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = req.headers.get("authorization");
      if (auth !== `Bearer ${cronSecret}`) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    // Recover orphaned publications before processing jobs
    const recoveredPubs = await recoverOrphanedPublications();
    const result = await processJobs();
    return json({ ...result, recoveredPublications: recoveredPubs });
  } catch (e) {
    return serverError(String(e));
  }
}

// Vercel Cron also supports GET
export async function GET(req: Request) {
  return POST(req);
}
