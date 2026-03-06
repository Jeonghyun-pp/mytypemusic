import { prisma } from "@/lib/db";
import { json, notFound, serverError } from "@/lib/studio";

/** GET /api/campaigns/[id] — get campaign + logs */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const campaign = await prisma.keywordCampaign.findUnique({ where: { id } });
    if (!campaign) return notFound("Campaign not found");

    const logs = await prisma.keywordCommentLog.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return json({ campaign, logs });
  } catch (e) {
    return serverError(String(e));
  }
}

/** PATCH /api/campaigns/[id] — update campaign */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const updated = await prisma.keywordCampaign.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name as string } : {}),
        ...(body.keywords ? { keywords: body.keywords as string[] } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive as boolean } : {}),
        ...(body.tosWarningAcked !== undefined ? { tosWarningAcked: body.tosWarningAcked as boolean } : {}),
        ...(body.dailyLimit !== undefined ? { dailyLimit: body.dailyLimit as number } : {}),
        ...(body.aiInstructions !== undefined ? { aiInstructions: body.aiInstructions as string | null } : {}),
      },
    });
    return json(updated);
  } catch (e) {
    return serverError(String(e));
  }
}

/** DELETE /api/campaigns/[id] */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.keywordCommentLog.deleteMany({ where: { campaignId: id } });
    await prisma.keywordCampaign.delete({ where: { id } });
    return json({ deleted: true });
  } catch (e) {
    return serverError(String(e));
  }
}
