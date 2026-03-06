import { prisma } from "@/lib/db";
import { getValidToken } from "@/lib/sns/tokenManager";
import { threadsCommentAdapter } from "@/lib/sns/comments/threads";
import { instagramCommentAdapter } from "@/lib/sns/comments/instagram";
import { xCommentAdapter } from "@/lib/sns/comments/x";
import type { CommentAdapter } from "@/lib/sns/comments/types";
import type { JobHandler } from "../types";

const commentAdapters: Record<string, CommentAdapter> = {
  threads: threadsCommentAdapter,
  instagram: instagramCommentAdapter,
  x: xCommentAdapter,
};

/**
 * Posts a pending keyword campaign comment on the target post.
 * Receives { logId, snsAccountId } in the payload.
 */
export const keywordCommentPostHandler: JobHandler = {
  type: "keyword_comment_post",
  async handle(payload) {
    const logId = payload.logId as string;
    const snsAccountId = payload.snsAccountId as string;

    if (!logId || !snsAccountId) {
      throw new Error("keywordCommentPost: missing logId or snsAccountId");
    }

    const log = await prisma.keywordCommentLog.findUnique({
      where: { id: logId },
    });
    if (!log) throw new Error(`Comment log ${logId} not found`);

    // Skip if already processed or campaign deactivated
    if (log.status !== "pending") {
      return { skipped: true, reason: `status is ${log.status}` };
    }

    const campaign = await prisma.keywordCampaign.findUnique({
      where: { id: log.campaignId },
    });
    if (!campaign?.isActive) {
      await prisma.keywordCommentLog.update({
        where: { id: logId },
        data: { status: "skipped" },
      });
      return { skipped: true, reason: "campaign inactive" };
    }

    const adapter = commentAdapters[log.platform];
    if (!adapter) {
      await prisma.keywordCommentLog.update({
        where: { id: logId },
        data: { status: "failed", error: `No comment adapter for ${log.platform}` },
      });
      throw new Error(`No comment adapter for platform: ${log.platform}`);
    }

    const accessToken = await getValidToken(snsAccountId);
    const account = await prisma.snsAccount.findUniqueOrThrow({
      where: { id: snsAccountId },
    });

    const postId = log.targetPostId ?? log.targetPostUrl;
    const result = await adapter.postCommentOnPost(
      accessToken,
      account.platformUserId,
      postId,
      log.commentText,
    );

    await prisma.keywordCommentLog.update({
      where: { id: logId },
      data: {
        status: "posted",
        postedAt: new Date(),
      },
    });

    return { posted: true, replyId: result.replyId };
  },
};
