import { prisma } from "@/lib/db";
import { json, notFound, badRequest, serverError } from "@/lib/studio";

/** PATCH /api/jobs/:id — cancel a job */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return notFound("Job not found");

    if (body.status === "cancelled") {
      if (job.status !== "pending") {
        return badRequest("Only pending jobs can be cancelled");
      }
      const updated = await prisma.job.update({
        where: { id },
        data: { status: "cancelled", completedAt: new Date() },
      });
      return json(updated);
    }

    return badRequest("Only { status: 'cancelled' } is supported");
  } catch (e) {
    return serverError(String(e));
  }
}
