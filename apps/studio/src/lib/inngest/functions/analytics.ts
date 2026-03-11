import { inngest } from "../client";
import { analyticsCollectHandler } from "@/lib/jobs/handlers/analyticsCollect";

/** Runs daily at 01:00 KST (16:00 UTC). */
export const analyticsCollect = inngest.createFunction(
  { id: "analytics-collect", retries: 3 },
  { cron: "0 16 * * *" },
  async ({ step }) => {
    return step.run("collect-analytics", () => analyticsCollectHandler.handle({}));
  },
);
