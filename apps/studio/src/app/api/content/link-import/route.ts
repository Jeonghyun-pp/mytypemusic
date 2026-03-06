import { prisma } from "@/lib/db";
import { json, badRequest, serverError } from "@/lib/studio";
import { extractFromUrls } from "@/lib/sns/linkExtractor";

/** GET /api/content/link-import — list all link imports */
export async function GET() {
  try {
    const imports = await prisma.linkImport.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return json(imports);
  } catch (e) {
    return serverError(String(e));
  }
}

/**
 * POST /api/content/link-import — start a batch link extraction.
 * Body: { urls: string[], commonInstructions?: string }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      urls?: string[];
      commonInstructions?: string;
    };

    if (!body.urls?.length) {
      return badRequest("urls array is required and must not be empty");
    }

    // Validate URLs
    const validUrls: string[] = [];
    for (const u of body.urls) {
      try {
        new URL(u);
        validUrls.push(u.trim());
      } catch {
        // skip invalid URLs
      }
    }
    if (!validUrls.length) return badRequest("No valid URLs provided");

    // Create import record
    const record = await prisma.linkImport.create({
      data: {
        urls: validUrls,
        commonInstructions: body.commonInstructions ?? "",
        status: "processing",
      },
    });

    // Extract content (runs inline — fast enough for <20 URLs)
    const results = await extractFromUrls(validUrls);

    // Update with results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await prisma.linkImport.update({
      where: { id: record.id },
      data: {
        status: "completed",
        results: results as any,
      },
    });

    return json(updated, 201);
  } catch (e) {
    return serverError(String(e));
  }
}
