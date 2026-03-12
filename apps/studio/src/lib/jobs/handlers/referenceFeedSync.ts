import { prisma } from "@/lib/db";
import {
  discoverProfile,
  discoverRecentMedia,
} from "@/lib/sns/instagram-discovery";
import { createLogger } from "@/lib/logger";
import type { JobHandler } from "../types";

const logger = createLogger({ handler: "reference_feed_sync" });

/**
 * Sync recent posts from monitored Instagram reference accounts.
 *
 * payload.accountId — sync single account; omit for all active accounts.
 */
export const referenceFeedSyncHandler: JobHandler = {
  type: "reference_feed_sync",

  async handle(payload: Record<string, unknown>) {
    const accountId = payload.accountId as string | undefined;

    const accounts = await prisma.referenceAccount.findMany({
      where: {
        isActive: true,
        platform: "instagram",
        ...(accountId ? { id: accountId } : {}),
      },
    });

    let totalSynced = 0;
    let totalPosts = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        // First sync: populate profile info
        if (!account.platformUserId) {
          const profile = await discoverProfile(account.username);
          if (!profile) {
            const msg = `Cannot discover profile @${account.username} — may not be a Business/Creator account`;
            logger.warn(msg);
            await prisma.referenceAccount.update({
              where: { id: account.id },
              data: { syncError: msg },
            });
            errors.push(msg);
            continue;
          }
          await prisma.referenceAccount.update({
            where: { id: account.id },
            data: {
              platformUserId: profile.id,
              displayName: profile.name,
              profileImageUrl: profile.profilePictureUrl,
              followersCount: profile.followersCount,
              syncError: null,
            },
          });
        }

        // Fetch recent media
        const { media } = await discoverRecentMedia(account.username, {
          limit: 25,
        });

        for (const m of media) {
          const hashtags = m.caption?.match(/#[\w가-힣]+/g) ?? [];
          const mentionedUsers = m.caption?.match(/@[\w.]+/g) ?? [];

          await prisma.referenceFeed.upsert({
            where: { platformPostId: m.id },
            update: {
              caption: m.caption ?? "",
              likeCount: m.likeCount,
              commentsCount: m.commentsCount,
            },
            create: {
              referenceAccountId: account.id,
              platformPostId: m.id,
              postType: m.mediaType.toLowerCase().replace("carousel_album", "carousel_album"),
              permalink: m.permalink,
              caption: m.caption ?? "",
              thumbnailUrl: m.thumbnailUrl ?? "",
              likeCount: m.likeCount,
              commentsCount: m.commentsCount,
              timestamp: new Date(m.timestamp),
              hashtags: hashtags.map((h) => h.slice(1)), // remove # prefix
              mentionedUsers: mentionedUsers.map((u) => u.slice(1)), // remove @ prefix
            },
          });
          totalPosts++;
        }

        await prisma.referenceAccount.update({
          where: { id: account.id },
          data: { lastSyncedAt: new Date(), syncError: null },
        });
        totalSynced++;
      } catch (err) {
        const msg = `Failed to sync @${account.username}: ${String(err)}`;
        logger.error(err, msg);
        errors.push(msg);
        await prisma.referenceAccount
          .update({
            where: { id: account.id },
            data: { syncError: String(err) },
          })
          .catch(() => {});
      }
    }

    return { accountsSynced: totalSynced, postsUpserted: totalPosts, errors };
  },
};
