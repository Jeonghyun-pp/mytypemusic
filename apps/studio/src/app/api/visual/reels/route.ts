import { json, badRequest, serverError } from "@/lib/studio";
import { generateArticleReels } from "@/lib/pipeline/article-reels";

/**
 * POST /api/visual/reels — Generate Remotion carousel data from article content.
 *
 * Body:
 *   { topic, content, coverImageUrl?, additionalImageUrls?, slideDuration?, transition? }
 *
 * Returns: { props: CarouselProps, slideTexts: [...] }
 *
 * The returned props can be passed directly to /api/reels/render for video rendering.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const topic = body.topic as string;
    const content = body.content as string;
    if (!topic || !content) return badRequest("topic and content are required");

    const result = await generateArticleReels({
      topic,
      content,
      coverImageUrl: body.coverImageUrl as string | undefined,
      additionalImageUrls: body.additionalImageUrls as string[] | undefined,
      slideDuration: (body.slideDuration as number) ?? 4,
      transition: (body.transition as "fade") ?? "fade",
    });

    return json(result);
  } catch (e) {
    return serverError(String(e));
  }
}
