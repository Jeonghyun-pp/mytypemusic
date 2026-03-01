import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/studio";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: planId } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const item = await prisma.planItem.create({
      data: {
        id: typeof body.id === "string" ? body.id : undefined,
        planId,
        date: String(body.date ?? ""),
        title: String(body.title ?? ""),
        description: String(body.description ?? ""),
        type: String(body.type ?? "post"),
        category: String(body.category ?? ""),
        tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
        reasoning: String(body.reasoning ?? ""),
        addedToCalendar: Boolean(body.addedToCalendar),
        calendarEventId: typeof body.calendarEventId === "string" ? body.calendarEventId : null,
      },
    });

    return json(item, 201);
  } catch (e) {
    return serverError(String(e));
  }
}
