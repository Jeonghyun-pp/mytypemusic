import { prisma } from "@/lib/db";
import { getValidToken } from "../tokenManager";
import { threadsPublishAdapter } from "./adapters/threads";
import { instagramPublishAdapter } from "./adapters/instagram";
import { xPublishAdapter } from "./adapters/x";
import { linkedinPublishAdapter } from "./adapters/linkedin";
import { wordpressPublishAdapter } from "./adapters/wordpress";
import { youtubePublishAdapter } from "./adapters/youtube";
import { tiktokPublishAdapter } from "./adapters/tiktok";
import type { PublishAdapter, PublishRequest } from "./types";

const adapters: Record<string, PublishAdapter> = {
  threads: threadsPublishAdapter,
  instagram: instagramPublishAdapter,
  x: xPublishAdapter,
  linkedin: linkedinPublishAdapter,
  wordpress: wordpressPublishAdapter,
  youtube: youtubePublishAdapter,
  tiktok: tiktokPublishAdapter,
};

function getPublishAdapter(platform: string): PublishAdapter {
  const adapter = adapters[platform];
  if (!adapter) throw new Error(`No publish adapter for platform: ${platform}`);
  return adapter;
}

/**
 * Recover publications stuck in "publishing" status (orphaned by crashes/timeouts).
 * Called at the start of each job processing cycle.
 */
export async function recoverOrphanedPublications(): Promise<number> {
  const TEN_MINUTES_AGO = new Date(Date.now() - 10 * 60 * 1000);
  const orphaned = await prisma.publication.updateMany({
    where: {
      status: "publishing",
      updatedAt: { lt: TEN_MINUTES_AGO },
    },
    data: { status: "failed", error: "Orphaned — stuck in publishing state" },
  });
  return orphaned.count;
}

/** Publish a single publication immediately. */
export async function publishNow(publicationId: string): Promise<void> {
  const pub = await prisma.publication.findUniqueOrThrow({
    where: { id: publicationId },
  });

  const account = await prisma.snsAccount.findUniqueOrThrow({
    where: { id: pub.snsAccountId },
  });

  await prisma.publication.update({
    where: { id: publicationId },
    data: { status: "publishing" },
  });

  try {
    const accessToken = await getValidToken(pub.snsAccountId);
    const adapter = getPublishAdapter(pub.platform);
    const content = pub.content as unknown as PublishRequest;

    const hasMedia = content.mediaUrls && content.mediaUrls.length > 0;
    const result = hasMedia
      ? await adapter.publishWithMedia(accessToken, account.platformUserId, content)
      : await adapter.publishText(accessToken, account.platformUserId, content);

    // Use transaction to atomically update status + enqueue performance jobs
    const now = Date.now();
    await prisma.$transaction([
      prisma.publication.update({
        where: { id: publicationId },
        data: {
          status: "published",
          publishedAt: new Date(),
          platformPostId: result.platformPostId,
          platformPostUrl: result.platformPostUrl,
        },
      }),
      prisma.job.create({
        data: {
          type: "performance_collect",
          payload: { publicationId, window: "1h" },
          scheduledAt: new Date(now + 60 * 60 * 1000),
        },
      }),
      prisma.job.create({
        data: {
          type: "performance_collect",
          payload: { publicationId, window: "24h" },
          scheduledAt: new Date(now + 24 * 60 * 60 * 1000),
        },
      }),
    ]);
  } catch (e) {
    await prisma.publication.update({
      where: { id: publicationId },
      data: {
        status: "failed",
        error: String(e),
      },
    });
    throw e;
  }
}

/** Publish to multiple accounts simultaneously. */
export async function publishMulti(publicationIds: string[]): Promise<{
  success: string[];
  failed: Array<{ id: string; error: string }>;
}> {
  const results = await Promise.allSettled(
    publicationIds.map((id) => publishNow(id)),
  );

  const success: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  results.forEach((r, i) => {
    const pubId = publicationIds[i] ?? "";
    if (r.status === "fulfilled") {
      success.push(pubId);
    } else {
      failed.push({ id: pubId, error: String(r.reason) });
    }
  });

  return { success, failed };
}
