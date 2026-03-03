import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/studio";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const planItemId = searchParams.get("planItemId");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (planItemId) where.planItemId = planItemId;

    const projects = await prisma.designProject.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        category: true,
        thumbnailDataUri: true,
        planItemId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return json(projects);
  } catch (e) {
    return serverError(String(e));
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const project = await prisma.designProject.create({
      data: {
        title: String(body.title ?? "새 프로젝트"),
        category: String(body.category ?? ""),
        specJson: (body.specJson as object) ?? {},
        planItemId: body.planItemId ? String(body.planItemId) : null,
      },
    });
    return json(project, 201);
  } catch (e) {
    return serverError(String(e));
  }
}
