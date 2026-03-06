import { prisma } from "@/lib/db";
import { json, badRequest, serverError } from "@/lib/studio";

/** GET /api/inbox/rules — list auto-reply rules */
export async function GET() {
  try {
    const rules = await prisma.autoReplyRule.findMany({
      orderBy: { createdAt: "desc" },
    });
    return json(rules);
  } catch (e) {
    return serverError(String(e));
  }
}

/** POST /api/inbox/rules — create auto-reply rule */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const snsAccountId = body.snsAccountId as string;
    const name = body.name as string;
    const triggerType = body.triggerType as string;
    const triggerValue = body.triggerValue as string;

    if (!snsAccountId || !name || !triggerType || !triggerValue) {
      return badRequest("snsAccountId, name, triggerType, and triggerValue are required");
    }

    const rule = await prisma.autoReplyRule.create({
      data: {
        snsAccountId,
        name,
        triggerType,
        triggerValue,
        replyTemplate: (body.replyTemplate as string) ?? "",
        useAi: (body.useAi as boolean) ?? false,
        aiInstructions: (body.aiInstructions as string) ?? null,
      },
    });
    return json(rule, 201);
  } catch (e) {
    return serverError(String(e));
  }
}
