import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/studio";

/** PATCH /api/inbox/[id] — mark as read, update classification, etc */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const updated = await prisma.incomingMessage.update({
      where: { id },
      data: {
        ...(body.isRead !== undefined ? { isRead: body.isRead as boolean } : {}),
        ...(body.classification ? { classification: body.classification as string } : {}),
        ...(body.priority ? { priority: body.priority as string } : {}),
      },
    });
    return json(updated);
  } catch (e) {
    return serverError(String(e));
  }
}
