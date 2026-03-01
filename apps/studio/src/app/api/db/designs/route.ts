import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/studio";

export async function GET() {
  try {
    const entries = await prisma.designEntry.findMany({
      orderBy: { createdAt: "desc" },
    });
    return json(entries);
  } catch (e) {
    return serverError(String(e));
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const entry = await prisma.designEntry.create({
      data: {
        category: String(body.category ?? ""),
        title: String(body.title ?? ""),
        imageDataUri: String(body.imageDataUri ?? ""),
        html: String(body.html ?? ""),
        fontMood: String(body.fontMood ?? ""),
      },
    });
    return json(entry, 201);
  } catch (e) {
    return serverError(String(e));
  }
}
