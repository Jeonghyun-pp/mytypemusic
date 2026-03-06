import { prisma } from "@/lib/db";
import { json, badRequest, serverError } from "@/lib/studio";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonInput = any;

/** GET /api/autopilot — list all autopilot configs */
export async function GET() {
  try {
    const configs = await prisma.autopilotConfig.findMany({
      orderBy: { createdAt: "desc" },
    });
    return json(configs);
  } catch (e) {
    return serverError(String(e));
  }
}

/** POST /api/autopilot — create a new autopilot config */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const snsAccountId = body.snsAccountId as string;
    if (!snsAccountId) return badRequest("snsAccountId is required");

    const config = await prisma.autopilotConfig.create({
      data: {
        snsAccountId,
        personaId: (body.personaId as string) ?? null,
        platforms: (body.platforms as string[]) ?? [],
        postsPerDay: (body.postsPerDay as number) ?? 1,
        approvalMode: (body.approvalMode as string) ?? "manual",
        topicKeywords: (body.topicKeywords as string[]) ?? [],
        isActive: (body.isActive as boolean) ?? false,
      },
    });
    return json(config, 201);
  } catch (e) {
    return serverError(String(e));
  }
}
