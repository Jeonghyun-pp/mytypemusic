import { prisma } from "@/lib/db";
import { json, badRequest, serverError } from "@/lib/studio";

/** GET /api/campaigns — list keyword campaigns */
export async function GET() {
  try {
    const campaigns = await prisma.keywordCampaign.findMany({
      orderBy: { createdAt: "desc" },
    });
    return json(campaigns);
  } catch (e) {
    return serverError(String(e));
  }
}

/** POST /api/campaigns — create a keyword campaign */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const snsAccountId = body.snsAccountId as string;
    const name = body.name as string;

    if (!snsAccountId || !name) return badRequest("snsAccountId and name required");

    const campaign = await prisma.keywordCampaign.create({
      data: {
        snsAccountId,
        name,
        keywords: (body.keywords as string[]) ?? [],
        platforms: (body.platforms as string[]) ?? ["threads"],
        commentMode: (body.commentMode as string) ?? "ai",
        commentTemplate: (body.commentTemplate as string) ?? null,
        aiInstructions: (body.aiInstructions as string) ?? null,
        dailyLimit: (body.dailyLimit as number) ?? 10,
        operatingStart: (body.operatingStart as number) ?? 9,
        operatingEnd: (body.operatingEnd as number) ?? 22,
      },
    });
    return json(campaign, 201);
  } catch (e) {
    return serverError(String(e));
  }
}
