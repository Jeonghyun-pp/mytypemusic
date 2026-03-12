import { prisma } from "@/lib/db";
import { json, notFound, serverError } from "@/lib/studio";
import { enqueueJob } from "@/lib/jobs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/reference-accounts/:id/sync — trigger manual feed sync.
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const account = await prisma.referenceAccount.findUnique({
      where: { id },
    });
    if (!account) return notFound("Account not found");

    await enqueueJob({
      type: "reference_feed_sync",
      payload: { accountId: id },
    });

    return json({ queued: true, accountId: id });
  } catch (e) {
    return serverError(String(e));
  }
}
