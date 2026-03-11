/**
 * AI Cover Image Generator — DALL-E 3 + Flux dual provider.
 *
 * Generates a cover image prompt from article topic/content via LLM,
 * then calls the best image generation provider for the use case.
 */
import { callGptJson } from "@/lib/llm";
import { generateImage, type AspectRatio, type ImageProvider, type ImagePurpose } from "@/lib/image-gen";

export interface CoverImageOptions {
  topic: string;
  content?: string;
  style?: "editorial" | "minimal" | "abstract" | "photographic" | "illustration";
  aspectRatio?: AspectRatio;
  brandColor?: string;
  /** Override auto-routing: force a specific provider */
  provider?: ImageProvider;
}

interface CoverImageResult {
  imageUrl: string;
  revisedPrompt: string;
  dallePrompt: string;
  aspectRatio: AspectRatio;
  provider: ImageProvider;
  elapsedMs: number;
}

/**
 * Generate a DALL-E prompt from article context using LLM.
 */
async function generateImagePrompt(opts: CoverImageOptions): Promise<string> {
  const styleGuide: Record<NonNullable<CoverImageOptions["style"]>, string> = {
    editorial: "sophisticated editorial magazine photography, clean composition, muted tones with one accent color",
    minimal: "minimalist design, lots of white space, geometric shapes, clean typography-friendly",
    abstract: "abstract artistic interpretation, bold colors, dynamic shapes, contemporary art style",
    photographic: "professional photography, natural lighting, shallow depth of field, magazine quality",
    illustration: "modern digital illustration, flat design elements, vibrant but harmonious colors",
  };

  const style = opts.style ?? "editorial";
  const contentHint = opts.content
    ? `\n\nArticle excerpt (for context only):\n${opts.content.slice(0, 500)}`
    : "";

  const result = await callGptJson<{ prompt: string }>(
    `Generate a DALL-E 3 image prompt for a magazine cover image.

Topic: ${opts.topic}${contentHint}

Style direction: ${styleGuide[style]}
${opts.brandColor ? `Brand accent color: ${opts.brandColor}` : ""}

Rules:
- NO text, letters, words, or typography in the image
- Focus on visual metaphor and mood that represents the topic
- Describe composition, lighting, color palette, and subject matter
- Keep it under 200 words
- The image should work as a background with text overlay

Return JSON: { "prompt": "your DALL-E prompt here" }`,
    { caller: "pipeline", model: "gpt-4o-mini", temperature: 0.8 },
  );

  return result.prompt;
}

/**
 * Map cover style to image generation purpose for auto-routing.
 */
function styleToPurpose(style?: CoverImageOptions["style"]): ImagePurpose {
  switch (style) {
    case "photographic": return "hero";
    case "editorial": return "editorial";
    case "abstract":
    case "illustration": return "background";
    default: return "editorial";
  }
}

/**
 * Generate a cover image using the best provider (DALL-E 3 or Flux).
 */
export async function generateCoverImage(
  opts: CoverImageOptions,
): Promise<CoverImageResult> {
  const aspectRatio = opts.aspectRatio ?? "landscape";
  const dallePrompt = await generateImagePrompt(opts);

  const result = await generateImage({
    prompt: dallePrompt,
    provider: opts.provider,
    purpose: styleToPurpose(opts.style),
    aspectRatio,
    dalleStyle: opts.style === "photographic" ? "natural" : "vivid",
  });

  return {
    imageUrl: result.imageUrl,
    revisedPrompt: result.revisedPrompt ?? "",
    dallePrompt,
    aspectRatio,
    provider: result.provider,
    elapsedMs: result.elapsedMs,
  };
}

/**
 * Generate multiple cover image variants for different platforms.
 */
export async function generateCoverImageSet(
  opts: Omit<CoverImageOptions, "aspectRatio">,
): Promise<{
  blog: CoverImageResult;
  sns: CoverImageResult;
  story: CoverImageResult;
}> {
  const [blog, sns, story] = await Promise.all([
    generateCoverImage({ ...opts, aspectRatio: "landscape" }),
    generateCoverImage({ ...opts, aspectRatio: "square" }),
    generateCoverImage({ ...opts, aspectRatio: "portrait" }),
  ]);

  return { blog, sns, story };
}
