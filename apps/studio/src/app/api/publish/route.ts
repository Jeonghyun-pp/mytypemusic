import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/studio";

/** GET /api/publish — list publications with optional filters */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const platform = url.searchParams.get("platform") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

    const pubs = await prisma.publication.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(platform ? { platform } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return json(pubs);
  } catch (e) {
    return serverError(String(e));
  }
}
