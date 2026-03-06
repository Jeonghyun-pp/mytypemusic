import { prisma } from "@/lib/db";
import { json, notFound, serverError } from "@/lib/studio";

/** GET /api/content/link-import/:id — get import details */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const record = await prisma.linkImport.findUnique({ where: { id } });
    if (!record) return notFound("Link import not found");
    return json(record);
  } catch (e) {
    return serverError(String(e));
  }
}
