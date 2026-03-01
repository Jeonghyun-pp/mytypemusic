import { prisma } from "@/lib/db";
import { json, notFound, serverError } from "@/lib/studio";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const entry = await prisma.designEntry.update({
      where: { id },
      data: body,
    });
    return json(entry);
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return notFound("Entry not found");
    return serverError(String(e));
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.designEntry.delete({ where: { id } });
    return json({ ok: true });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return notFound("Entry not found");
    return serverError(String(e));
  }
}
