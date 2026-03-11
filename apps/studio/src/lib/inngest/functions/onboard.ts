import { inngest } from "../client";
import { onboardAnalyzeHandler } from "@/lib/jobs/handlers/onboardAnalyze";

/** Event-triggered: analyze a newly connected account and create a default persona. */
export const onboardAnalyze = inngest.createFunction(
  { id: "onboard-analyze", retries: 2 },
  { event: "account/onboard" },
  async ({ event, step }) => {
    const { accountId } = event.data as { accountId: string };
    return step.run("analyze-account", () =>
      onboardAnalyzeHandler.handle({ accountId }),
    );
  },
);
