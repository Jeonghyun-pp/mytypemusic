import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/studio";

/** GET /api/inbox — list incoming messages with optional filters */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const filter = url.searchParams.get("filter"); // unread | classification
    const classification = url.searchParams.get("classification");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

    const where: Record<string, unknown> = {};
    if (filter === "unread") where.isRead = false;
    if (classification) where.classification = classification;

    const messages = await prisma.incomingMessage.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: limit,
    });

    const unreadCount = await prisma.incomingMessage.count({
      where: { isRead: false },
    });

    return json({ messages, unreadCount });
  } catch (e) {
    return serverError(String(e));
  }
}
