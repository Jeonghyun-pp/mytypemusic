import { inngest } from "../client";
import { commentFetchHandler } from "@/lib/jobs/handlers/commentFetch";
import { commentMonitorHandler } from "@/lib/jobs/handlers/commentMonitor";

/** Poll for new comments every 10 minutes. */
export const commentFetch = inngest.createFunction(
  { id: "comment-fetch", retries: 2 },
  { cron: "*/10 * * * *" },
  async ({ step }) => {
    const result = await step.run("fetch-comments", () => commentFetchHandler.handle({}));
    // After fetching, classify and auto-reply
    await step.run("monitor-comments", () => commentMonitorHandler.handle({}));
    return result;
  },
);
