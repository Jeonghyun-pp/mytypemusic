import { prisma } from "@/lib/db";
import { json, badRequest, serverError } from "@/lib/studio";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonInput = any;

/** GET /api/topics — list topic drafts */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const offset = Number(url.searchParams.get("offset")) || 0;

    const where = status ? { status } : {};

    const [drafts, total] = await Promise.all([
      prisma.topicDraft.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
        include: { _count: { select: { messages: true } } },
      }),
      prisma.topicDraft.count({ where }),
    ]);

    return json({ drafts, total });
  } catch (e) {
    return serverError(String(e));
  }
}

/** POST /api/topics — create a new topic draft */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const topic = body.topic as string;
    if (!topic?.trim()) return badRequest("topic is required");

    const draft = await prisma.topicDraft.create({
      data: {
        topic: topic.trim(),
        angle: (body.angle as string) ?? "",
        reasoning: (body.reasoning as string) ?? "",
        contentType: (body.contentType as string) ?? "blog",
        sourceType: (body.sourceType as string) ?? "manual",
        sourceData: (body.sourceData as JsonInput) ?? null,
        trendSources: (body.trendSources as string[]) ?? [],
        relatedEntities: (body.relatedEntities as string[]) ?? [],
        formats: (body.formats as JsonInput) ?? null,
        personaId: (body.personaId as string) ?? null,
      },
    });

    return json(draft, 201);
  } catch (e) {
    return serverError(String(e));
  }
}
