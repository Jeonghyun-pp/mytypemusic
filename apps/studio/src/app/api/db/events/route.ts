import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/studio";

export async function GET() {
  try {
    const events = await prisma.calendarEvent.findMany({
      orderBy: { createdAt: "desc" },
    });
    return json(events);
  } catch (e) {
    return serverError(String(e));
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const event = await prisma.calendarEvent.create({
      data: {
        date: String(body.date ?? ""),
        title: String(body.title ?? ""),
        type: String(body.type ?? "post"),
        category: String(body.category ?? ""),
        status: String(body.status ?? "planned"),
        note: String(body.note ?? ""),
      },
    });
    return json(event, 201);
  } catch (e) {
    return serverError(String(e));
  }
}
