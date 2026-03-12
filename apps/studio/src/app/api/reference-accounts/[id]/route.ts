import { prisma } from "@/lib/db";
import { json, notFound, serverError } from "@/lib/studio";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/reference-accounts/:id — single account with recent feeds.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const account = await prisma.referenceAccount.findUnique({
      where: { id },
      include: {
        feeds: {
          orderBy: { timestamp: "desc" },
          take: 20,
        },
        _count: { select: { feeds: true } },
      },
    });

    if (!account) return notFound("Account not found");
    return json(account);
  } catch (e) {
    return serverError(String(e));
  }
}

/**
 * PATCH /api/reference-accounts/:id — update account fields.
 * Body: { category?, tags?, isActive? }
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      category?: string;
      tags?: string[];
      isActive?: boolean;
    };

    const account = await prisma.referenceAccount.update({
      where: { id },
      data: {
        ...(body.category !== undefined && { category: body.category }),
        ...(body.tags !== undefined && { tags: body.tags }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return json(account);
  } catch (e) {
    return serverError(String(e));
  }
}

/**
 * DELETE /api/reference-accounts/:id — delete account and cascade feeds.
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await prisma.referenceAccount.delete({ where: { id } });
    return json({ deleted: true });
  } catch (e) {
    return serverError(String(e));
  }
}
