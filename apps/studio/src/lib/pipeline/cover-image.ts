/**
 * AI Cover Image Generator — DALL-E 3 based cover image generation.
 *
 * Generates a cover image prompt from article topic/content via LLM,
 * then calls DALL-E 3 to produce the image.
 */
import OpenAI from "openai";
import { callGptJson } from "@/lib/llm";

const openai = new OpenAI();

type AspectRatio = "landscape" | "square" | "portrait";

const SIZE_MAP: Record<AspectRatio, "1792x1024" | "1024x1024" | "1024x1792"> = {
  landscape: "1792x1024", // blog hero
  square: "1024x1024",    // SNS feed
  portrait: "1024x1792",  // story/reels
};

export interface CoverImageOptions {
  topic: string;
  content?: string;
  style?: "editorial" | "minimal" | "abstract" | "photographic" | "illustration";
  aspectRatio?: AspectRatio;
  brandColor?: string;
}

interface CoverImageResult {
  imageUrl: string;
  revisedPrompt: string;
  dallePrompt: string;
  aspectRatio: AspectRatio;
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
    { model: "gpt-4o-mini", temperature: 0.8 },
  );

  return result.prompt;
}

/**
 * Generate a cover image using DALL-E 3.
 */
export async function generateCoverImage(
  opts: CoverImageOptions,
): Promise<CoverImageResult> {
  const aspectRatio = opts.aspectRatio ?? "landscape";
  const dallePrompt = await generateImagePrompt(opts);

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: dallePrompt,
    n: 1,
    size: SIZE_MAP[aspectRatio],
    quality: "standard",
    style: opts.style === "photographic" ? "natural" : "vivid",
  });

  const first = response.data?.[0];
  const imageUrl = first?.url;
  if (!imageUrl) throw new Error("DALL-E returned no image");

  return {
    imageUrl,
    revisedPrompt: first?.revised_prompt ?? "",
    dallePrompt,
    aspectRatio,
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
