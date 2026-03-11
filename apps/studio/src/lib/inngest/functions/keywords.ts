import { inngest } from "../client";
import { keywordScanHandler } from "@/lib/jobs/handlers/keywordScan";
import { dailyResetHandler } from "@/lib/jobs/handlers/dailyReset";

/** Keyword scan: search for posts + schedule comments. Every 15 minutes during operating hours. */
export const keywordScan = inngest.createFunction(
  { id: "keyword-scan", retries: 2 },
  { cron: "*/15 9-22 * * *" },
  async ({ step }) => {
    return step.run("scan-keywords", () => keywordScanHandler.handle({}));
  },
);

/** Daily reset: clear todayCount on all campaigns. Midnight KST (15:00 UTC). */
export const dailyReset = inngest.createFunction(
  { id: "daily-reset", retries: 1 },
  { cron: "0 15 * * *" },
  async ({ step }) => {
    return step.run("reset-counts", () => dailyResetHandler.handle({}));
  },
);
