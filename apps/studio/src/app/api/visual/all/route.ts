import { json, badRequest, serverError } from "@/lib/studio";
import { generateVisualAssets } from "@/lib/pipeline/visual-assets";

/**
 * POST /api/visual/all — Generate all visual assets for an article.
 *
 * Body:
 *   { topic, content, style?, brandColor?, skip?: { coverImage?, snsCards?, reels? } }
 *
 * Returns: { coverImage?, snsCards, reels? }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const topic = body.topic as string;
    const content = body.content as string;
    if (!topic || !content) return badRequest("topic and content are required");

    const result = await generateVisualAssets({
      topic,
      content,
      style: body.style as "editorial" | undefined,
      brandColor: body.brandColor as string | undefined,
      skip: body.skip as { coverImage?: boolean; snsCards?: boolean; reels?: boolean } | undefined,
    });

    return json(result);
  } catch (e) {
    return serverError(String(e));
  }
}
