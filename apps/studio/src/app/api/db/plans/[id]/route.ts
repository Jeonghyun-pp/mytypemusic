import { prisma } from "@/lib/db";
import { json, notFound, serverError } from "@/lib/studio";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.contentPlan.delete({ where: { id } });
    return json({ ok: true });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return notFound("Plan not found");
    return serverError(String(e));
  }
}
