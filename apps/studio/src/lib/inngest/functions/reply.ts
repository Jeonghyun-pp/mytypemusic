import { inngest } from "../client";
import { replySendHandler } from "@/lib/jobs/handlers/replySend";

/** Event-triggered: send a reply to a comment/DM. */
export const replySend = inngest.createFunction(
  { id: "reply-send", retries: 3 },
  { event: "comment/reply" },
  async ({ event, step }) => {
    const { messageId } = event.data as { messageId: string };
    return step.run("send-reply", () =>
      replySendHandler.handle({ messageId }),
    );
  },
);
