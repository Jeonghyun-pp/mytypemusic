import { prisma } from "@/lib/db";
import { getValidToken } from "@/lib/sns/tokenManager";
import { getCommentAdapter } from "@/lib/sns/comments";
import type { JobHandler } from "../types";

/**
 * Reply send job: posts a reply to a comment/DM via the platform API.
 * Payload: { messageId: string }
 *
 * Uses the comment adapter's replyToComment() method.
 * On success: sets autoReplied=true, processedAt.
 * On failure: the job queue's built-in backoff handles retries.
 */
export const replySendHandler: JobHandler = {
  type: "reply_send",
  async handle(payload) {
    const messageId = payload.messageId as string;
    if (!messageId) throw new Error("replySend: missing messageId in payload");

    const msg = await prisma.incomingMessage.findUniqueOrThrow({
      where: { id: messageId },
    });

    if (!msg.autoReplyText) {
      throw new Error(`replySend: no autoReplyText for message ${messageId}`);
    }

    const account = await prisma.snsAccount.findUniqueOrThrow({
      where: { id: msg.snsAccountId },
    });

    const accessToken = await getValidToken(account.id);
    const adapter = getCommentAdapter(account.platform);

    // parentId = the comment's externalId (we reply to it)
    const result = await adapter.replyToComment(
      accessToken,
      account.platformUserId,
      msg.externalId,
      msg.autoReplyText,
    );

    await prisma.incomingMessage.update({
      where: { id: messageId },
      data: {
        autoReplied: true,
        processedAt: new Date(),
      },
    });

    return { replyId: result.replyId, messageId };
  },
};
