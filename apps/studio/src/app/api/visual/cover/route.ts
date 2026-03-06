import { json, badRequest, serverError } from "@/lib/studio";
import { generateCoverImage, generateCoverImageSet } from "@/lib/pipeline/cover-image";

/**
 * POST /api/visual/cover — Generate AI cover image(s) via DALL-E 3.
 *
 * Body:
 *   { topic, content?, style?, aspectRatio?, brandColor?, generateSet? }
 *
 * If generateSet=true, generates landscape + square + portrait variants.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const topic = body.topic as string;
    if (!topic) return badRequest("topic is required");

    const opts = {
      topic,
      content: body.content as string | undefined,
      style: (body.style as "editorial") ?? "editorial",
      brandColor: body.brandColor as string | undefined,
    };

    if (body.generateSet) {
      const result = await generateCoverImageSet(opts);
      return json(result);
    }

    const result = await generateCoverImage({
      ...opts,
      aspectRatio: (body.aspectRatio as "landscape") ?? "landscape",
    });

    return json(result);
  } catch (e) {
    return serverError(String(e));
  }
}
