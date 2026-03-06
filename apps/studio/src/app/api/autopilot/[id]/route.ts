import { prisma } from "@/lib/db";
import { json, notFound, serverError } from "@/lib/studio";

/** GET /api/autopilot/[id] — get config details + recent proposals */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const config = await prisma.autopilotConfig.findUnique({ where: { id } });
    if (!config) return notFound("Config not found");

    const proposals = await prisma.autopilotProposal.findMany({
      where: { autopilotConfigId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return json({ config, proposals });
  } catch (e) {
    return serverError(String(e));
  }
}

/** PATCH /api/autopilot/[id] — update config */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const updated = await prisma.autopilotConfig.update({
      where: { id },
      data: {
        ...(body.personaId !== undefined ? { personaId: body.personaId as string | null } : {}),
        ...(body.platforms ? { platforms: body.platforms as string[] } : {}),
        ...(body.postsPerDay !== undefined ? { postsPerDay: body.postsPerDay as number } : {}),
        ...(body.approvalMode ? { approvalMode: body.approvalMode as string } : {}),
        ...(body.topicKeywords ? { topicKeywords: body.topicKeywords as string[] } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive as boolean } : {}),
      },
    });
    return json(updated);
  } catch (e) {
    return serverError(String(e));
  }
}

/** DELETE /api/autopilot/[id] — delete config and its proposals */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.autopilotProposal.deleteMany({ where: { autopilotConfigId: id } });
    await prisma.autopilotConfig.delete({ where: { id } });
    return json({ deleted: true });
  } catch (e) {
    return serverError(String(e));
  }
}
