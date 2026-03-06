import { prisma } from "@/lib/db";
import { json, badRequest, serverError } from "@/lib/studio";
import { enqueueJob } from "@/lib/jobs";
import type { JobType } from "@/lib/jobs";

const VALID_TYPES: JobType[] = [
  "publish",
  "autopilot_scan",
  "comment_monitor",
  "keyword_scan",
  "analytics_collect",
];

/** GET /api/jobs — list jobs with optional status/type filters */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const type = url.searchParams.get("type") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

    const jobs = await prisma.job.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return json(jobs);
  } catch (e) {
    return serverError(String(e));
  }
}

/** POST /api/jobs — create a new job manually */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const type = body.type as string;
    if (!type || !VALID_TYPES.includes(type as JobType)) {
      return badRequest(`Invalid job type. Valid types: ${VALID_TYPES.join(", ")}`);
    }

    const job = await enqueueJob({
      type: type as JobType,
      payload: (body.payload as Record<string, unknown>) ?? {},
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt as string) : undefined,
      priority: typeof body.priority === "number" ? body.priority : undefined,
    });
    return json(job, 201);
  } catch (e) {
    return serverError(String(e));
  }
}
