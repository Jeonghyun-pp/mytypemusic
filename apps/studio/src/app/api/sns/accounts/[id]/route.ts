import { prisma } from "@/lib/db";
import { json, notFound, serverError } from "@/lib/studio";
import { getValidToken } from "@/lib/sns/tokenManager";

/** DELETE /api/sns/accounts/:id — disconnect an SNS account and clean up related data */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const existing = await prisma.snsAccount.findUnique({ where: { id } });
    if (!existing) return notFound("Account not found");

    // Cascade-delete related records in a transaction
    // First, collect IDs for nested relations
    const configIds = (
      await prisma.autopilotConfig.findMany({ where: { snsAccountId: id }, select: { id: true } })
    ).map((c) => c.id);
    const campaignIds = (
      await prisma.keywordCampaign.findMany({ where: { snsAccountId: id }, select: { id: true } })
    ).map((c) => c.id);

    await prisma.$transaction([
      // Cancel pending/scheduled publications
      prisma.publication.updateMany({
        where: { snsAccountId: id, status: { in: ["draft", "scheduled"] } },
        data: { status: "failed", error: "Account disconnected" },
      }),
      // Delete autopilot proposals, then configs
      ...(configIds.length > 0
        ? [prisma.autopilotProposal.deleteMany({ where: { autopilotConfigId: { in: configIds } } })]
        : []),
      prisma.autopilotConfig.deleteMany({ where: { snsAccountId: id } }),
      // Delete inbox messages and auto-reply rules
      prisma.incomingMessage.deleteMany({ where: { snsAccountId: id } }),
      prisma.autoReplyRule.deleteMany({ where: { snsAccountId: id } }),
      // Delete keyword campaign logs, then campaigns
      ...(campaignIds.length > 0
        ? [prisma.keywordCommentLog.deleteMany({ where: { campaignId: { in: campaignIds } } })]
        : []),
      prisma.keywordCampaign.deleteMany({ where: { snsAccountId: id } }),
      // Delete analytics snapshots
      prisma.analyticsSnapshot.deleteMany({ where: { snsAccountId: id } }),
      // Finally delete the account itself
      prisma.snsAccount.delete({ where: { id } }),
    ]);

    return json({ ok: true });
  } catch (e) {
    return serverError(String(e));
  }
}

/** POST /api/sns/accounts/:id — refresh token for an account */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await getValidToken(id); // triggers refresh if needed
    const account = await prisma.snsAccount.findUnique({
      where: { id },
      select: {
        id: true,
        platform: true,
        displayName: true,
        tokenExpiresAt: true,
        isActive: true,
      },
    });
    return json(account);
  } catch (e) {
    return serverError(String(e));
  }
}
