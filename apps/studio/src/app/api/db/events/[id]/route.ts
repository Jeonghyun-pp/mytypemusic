import { prisma } from "@/lib/db";
import { json, notFound, serverError } from "@/lib/studio";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const event = await prisma.calendarEvent.update({
      where: { id },
      data: body,
    });
    return json(event);
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return notFound("Event not found");
    return serverError(String(e));
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.calendarEvent.delete({ where: { id } });
    return json({ ok: true });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return notFound("Event not found");
    return serverError(String(e));
  }
}
