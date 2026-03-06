import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/studio";

/** GET /api/sns/accounts — list all connected SNS accounts (tokens omitted) */
export async function GET() {
  try {
    const accounts = await prisma.snsAccount.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        platform: true,
        platformUserId: true,
        displayName: true,
        profileImageUrl: true,
        scopes: true,
        isActive: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return json(accounts);
  } catch (e) {
    return serverError(String(e));
  }
}
