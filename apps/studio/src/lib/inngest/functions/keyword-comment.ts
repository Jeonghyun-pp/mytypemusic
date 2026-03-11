import { inngest } from "../client";
import { keywordCommentPostHandler } from "@/lib/jobs/handlers/keywordCommentPost";

/** Event-triggered: post a keyword campaign comment on a target post. */
export const keywordCommentPost = inngest.createFunction(
  { id: "keyword-comment-post", retries: 3 },
  { event: "keyword/comment-post" },
  async ({ event, step }) => {
    const { logId, snsAccountId } = event.data as { logId: string; snsAccountId: string };
    return step.run("post-comment", () =>
      keywordCommentPostHandler.handle({ logId, snsAccountId }),
    );
  },
);
