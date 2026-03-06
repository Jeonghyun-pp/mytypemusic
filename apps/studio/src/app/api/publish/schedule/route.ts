import { prisma } from "@/lib/db";
import { json, badRequest, notFound, serverError } from "@/lib/studio";
import { enqueueJob } from "@/lib/jobs";
import { adjustScheduleTime } from "@/lib/autopilot/scheduler";

/**
 * POST /api/publish/schedule — schedule a publication for a future time.
 * Body: { publicationId, scheduledAt } or same as /draft + scheduledAt
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const scheduledAt = body.scheduledAt as string;

    if (!scheduledAt) return badRequest("scheduledAt is required");
    const schedDate = new Date(scheduledAt);
    if (schedDate <= new Date()) {
      return badRequest("scheduledAt must be in the future");
    }

    let pubId: string;

    if (body.publicationId) {
      // Schedule existing draft
      pubId = body.publicationId as string;
      const pub = await prisma.publication.findUnique({ where: { id: pubId } });
      if (!pub) return notFound("Publication not found");
      if (pub.status !== "draft") {
        return badRequest("Only draft publications can be scheduled");
      }
    } else {
      // Create + schedule in one step
      const snsAccountId = body.snsAccountId as string;
      const platform = body.platform as string;
      const content = body.content as Record<string, unknown>;
      if (!snsAccountId || !platform || !content?.text) {
        return badRequest("snsAccountId, platform, and content.text are required");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pub = await prisma.publication.create({
        data: {
          snsAccountId,
          platform,
          content: content as any,
          projectId: (body.projectId as string) ?? null,
          status: "draft",
        },
      });
      pubId = pub.id;
    }

    // Adjust schedule time to avoid collisions with existing posts
    const accountId = body.snsAccountId as string ??
      (await prisma.publication.findUnique({ where: { id: pubId }, select: { snsAccountId: true } }))?.snsAccountId;
    const adjustedDate = accountId
      ? await adjustScheduleTime(accountId, schedDate)
      : schedDate;

    // Update to scheduled
    await prisma.publication.update({
      where: { id: pubId },
      data: { status: "scheduled", scheduledAt: adjustedDate },
    });

    // Enqueue job
    await enqueueJob({
      type: "publish",
      payload: { publicationId: pubId },
      scheduledAt: adjustedDate,
    });

    const updated = await prisma.publication.findUnique({ where: { id: pubId } });
    return json(updated);
  } catch (e) {
    return serverError(String(e));
  }
}
