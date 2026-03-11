import { inngest } from "../client";
import { publishHandler } from "@/lib/jobs/handlers/publish";
import { performanceCollectHandler } from "@/lib/jobs/handlers/performanceCollect";

/** Event-triggered publish. Send inngest.send({ name: "publication/scheduled", data: { publicationId } }). */
export const publishContent = inngest.createFunction(
  { id: "publish-content", retries: 3 },
  { event: "publication/scheduled" },
  async ({ event, step }) => {
    const { publicationId } = event.data as { publicationId: string };

    await step.run("publish", () =>
      publishHandler.handle({ publicationId }),
    );

    // Collect performance 24h later
    await step.sleep("wait-24h", "24h");

    await step.run("collect-performance", () =>
      performanceCollectHandler.handle({ publicationId }),
    );

    return { publicationId, status: "published-and-tracked" };
  },
);
