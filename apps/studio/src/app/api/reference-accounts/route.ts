import { prisma } from "@/lib/db";
import { json, badRequest, serverError } from "@/lib/studio";
import { discoverProfile } from "@/lib/sns/instagram-discovery";
import { enqueueJob } from "@/lib/jobs";

/**
 * GET /api/reference-accounts — list all reference accounts with feed count.
 */
export async function GET() {
  try {
    const accounts = await prisma.referenceAccount.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { feeds: true } },
      },
    });

    return json(
      accounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        username: a.username,
        displayName: a.displayName,
        profileImageUrl: a.profileImageUrl,
        followersCount: a.followersCount,
        category: a.category,
        tags: a.tags,
        isActive: a.isActive,
        lastSyncedAt: a.lastSyncedAt,
        syncError: a.syncError,
        feedCount: a._count.feeds,
        createdAt: a.createdAt,
      })),
    );
  } catch (e) {
    return serverError(String(e));
  }
}

/**
 * POST /api/reference-accounts — add a new reference account.
 * Body: { username, platform?, category?, tags? }
 *
 * Validates that the username belongs to a Business/Creator IG account,
 * then enqueues an immediate sync job.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      username?: string;
      platform?: string;
      category?: string;
      tags?: string[];
    };

    const username = body.username?.replace(/^@/, "").trim();
    if (!username) return badRequest("username is required");

    const platform = body.platform ?? "instagram";

    // Check for duplicate
    const existing = await prisma.referenceAccount.findUnique({
      where: { platform_username: { platform, username } },
    });
    if (existing) return badRequest(`@${username} is already registered`);

    // Validate via Business Discovery
    const profile = await discoverProfile(username);
    if (!profile) {
      return badRequest(
        `@${username} is not a Business/Creator account or does not exist. ` +
          "Ensure the account is public and has a Business or Creator profile.",
      );
    }

    // Create account
    const account = await prisma.referenceAccount.create({
      data: {
        platform,
        username,
        platformUserId: profile.id,
        displayName: profile.name,
        profileImageUrl: profile.profilePictureUrl,
        followersCount: profile.followersCount,
        category: body.category ?? "artist",
        tags: body.tags ?? [],
      },
    });

    // Enqueue immediate feed sync
    await enqueueJob({
      type: "reference_feed_sync",
      payload: { accountId: account.id },
    });

    return json(account, 201);
  } catch (e) {
    return serverError(String(e));
  }
}
