import { prisma } from "@/lib/db";
import { json, notFound, serverError } from "@/lib/studio";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { itemId } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const item = await prisma.planItem.update({
      where: { id: itemId },
      data: body,
    });
    return json(item);
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return notFound("Item not found");
    return serverError(String(e));
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { itemId } = await params;
    await prisma.planItem.delete({ where: { id: itemId } });
    return json({ ok: true });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return notFound("Item not found");
    return serverError(String(e));
  }
}
