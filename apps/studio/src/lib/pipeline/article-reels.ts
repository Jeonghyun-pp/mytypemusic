/**
 * Article Reels Generator — converts blog articles into Remotion carousel data.
 *
 * Takes article content, extracts key points, pairs with cover images,
 * and produces CarouselProps for Remotion rendering.
 */
import { callGptJson } from "@/lib/llm";
import type { CarouselProps } from "@/remotion/CarouselComp";

interface ArticleReelsOptions {
  topic: string;
  content: string;
  coverImageUrl?: string;
  additionalImageUrls?: string[];
  /** Seconds per slide (default: 4) */
  slideDuration?: number;
  transition?: CarouselProps["transition"];
}

interface ReelsSlide {
  text: string;
  type: "hook" | "point" | "quote" | "cta";
}

/**
 * Extract key points from article for reels slides.
 */
async function extractReelsSlides(
  topic: string,
  content: string,
): Promise<ReelsSlide[]> {
  const result = await callGptJson<{ slides: ReelsSlide[] }>(
    `Convert this article into 5-8 short-form video slides for Instagram Reels / TikTok.

Topic: ${topic}
Content:
${content.slice(0, 3000)}

Rules:
- First slide: attention-grabbing hook (question or bold statement)
- Middle slides: key insights (1-2 sentences each, max 60 chars Korean)
- Last slide: call-to-action (follow, save, comment prompt)
- Each slide text should be impactful standalone
- Write in Korean, keep it punchy and conversational
- Mark each slide type: "hook", "point", "quote", or "cta"

Return JSON:
{
  "slides": [
    { "text": "slide text", "type": "hook" },
    { "text": "key point 1", "type": "point" },
    ...
  ]
}`,
    { caller: "pipeline", model: "gpt-4o-mini", temperature: 0.7 },
  );

  return result.slides;
}

/**
 * Generate Remotion CarouselProps from article content.
 */
export async function generateArticleReels(
  opts: ArticleReelsOptions,
): Promise<{
  props: CarouselProps;
  slideTexts: ReelsSlide[];
}> {
  const fps = 30;
  const slideDuration = opts.slideDuration ?? 4;
  const durationFrames = fps * slideDuration;
  const transition = opts.transition ?? "fade";

  const slideTexts = await extractReelsSlides(opts.topic, opts.content);

  // Build image list: cover image first, then additional, cycle if needed
  const availableImages = [
    opts.coverImageUrl,
    ...(opts.additionalImageUrls ?? []),
  ].filter(Boolean) as string[];

  const slides = slideTexts.map((_, i) => ({
    imageUrl: availableImages.length > 0
      ? availableImages[i % availableImages.length]!
      : "",
    durationFrames,
  }));

  // Build subtitle entries matching each slide
  const subtitles = slideTexts.map((slide, i) => {
    const overlappingTransitions = i > 0 ? 15 : 0; // transitionDurationFrames
    const startFrame = i * (durationFrames - 15) + overlappingTransitions;
    return {
      text: slide.text,
      startFrame: Math.max(0, startFrame),
      durationFrames: durationFrames - 20, // leave room for transition
    };
  });

  return {
    props: {
      slides,
      transition,
      transitionDurationFrames: 15,
      backgroundMusicVolume: 0.3,
      subtitles,
    },
    slideTexts,
  };
}
