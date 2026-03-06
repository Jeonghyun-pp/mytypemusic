import { json, serverError } from "@/lib/studio";
import { enqueueJob, processJobs, registerHandler } from "@/lib/jobs";
import { dailyResetHandler } from "@/lib/jobs/handlers/dailyReset";

registerHandler(dailyResetHandler);

/**
 * GET /api/jobs/daily-reset — Reset daily counters.
 * Called by Vercel Cron at midnight KST (15:00 UTC).
 */
export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = req.headers.get("authorization");
      if (auth !== `Bearer ${cronSecret}`) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    await enqueueJob({ type: "daily_reset" });
    const result = await processJobs(1);
    return json(result);
  } catch (e) {
    return serverError(String(e));
  }
}
