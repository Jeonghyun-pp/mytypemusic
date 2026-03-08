/**
 * Visual Asset Orchestrator — generates all visual assets for an article.
 *
 * Coordinates: cover image (DALL-E 3) + SNS cards + article reels data.
 */
import { generateCoverImage, type CoverImageOptions } from "./cover-image";
import { extractSnsQuotes, type SnsCardData } from "./sns-card";
import { generateArticleReels } from "./article-reels";
import type { CarouselProps } from "@/remotion/CarouselComp";

export interface VisualAssetInput {
  topic: string;
  content: string;
  style?: CoverImageOptions["style"];
  brandColor?: string;
  /** Skip specific asset types */
  skip?: {
    coverImage?: boolean;
    snsCards?: boolean;
    reels?: boolean;
  };
}

export interface VisualAssetResult {
  coverImage?: {
    imageUrl: string;
    revisedPrompt: string;
    dallePrompt: string;
    provider?: string;
    elapsedMs?: number;
  };
  snsCards: SnsCardData[];
  reels?: {
    props: CarouselProps;
    slideTexts: Array<{ text: string; type: string }>;
  };
}

/**
 * Generate all visual assets for an article in parallel.
 */
export async function generateVisualAssets(
  input: VisualAssetInput,
): Promise<VisualAssetResult> {
  const { topic, content, style, brandColor, skip } = input;

  const tasks: Promise<unknown>[] = [];
  let coverIdx = -1;
  let cardsIdx = -1;
  let reelsIdx = -1;

  if (!skip?.coverImage) {
    coverIdx = tasks.length;
    tasks.push(
      generateCoverImage({
        topic,
        content,
        style: style ?? "editorial",
        aspectRatio: "landscape",
        brandColor,
      }),
    );
  }

  if (!skip?.snsCards) {
    cardsIdx = tasks.length;
    tasks.push(
      extractSnsQuotes({
        topic,
        content,
        maxQuotes: 5,
        brandColor,
      }),
    );
  }

  if (!skip?.reels) {
    reelsIdx = tasks.length;
    tasks.push(
      generateArticleReels({ topic, content }),
    );
  }

  const results = await Promise.allSettled(tasks);

  const result: VisualAssetResult = { snsCards: [] };

  if (coverIdx >= 0 && results[coverIdx]?.status === "fulfilled") {
    const cover = (results[coverIdx] as PromiseFulfilledResult<unknown>).value as {
      imageUrl: string;
      revisedPrompt: string;
      dallePrompt: string;
    };
    result.coverImage = cover;

    // If reels were generated, inject cover image
    if (reelsIdx >= 0 && results[reelsIdx]?.status === "fulfilled") {
      const reelsData = (results[reelsIdx] as PromiseFulfilledResult<unknown>).value as {
        props: CarouselProps;
        slideTexts: Array<{ text: string; type: string }>;
      };
      // Set cover image as slide backgrounds
      for (const slide of reelsData.props.slides) {
        if (!slide.imageUrl) {
          slide.imageUrl = cover.imageUrl;
        }
      }
      result.reels = reelsData;
    }
  }

  // Handle reels without cover image
  if (reelsIdx >= 0 && !result.reels && results[reelsIdx]?.status === "fulfilled") {
    result.reels = (results[reelsIdx] as PromiseFulfilledResult<unknown>).value as {
      props: CarouselProps;
      slideTexts: Array<{ text: string; type: string }>;
    };
  }

  if (cardsIdx >= 0 && results[cardsIdx]?.status === "fulfilled") {
    result.snsCards = (results[cardsIdx] as PromiseFulfilledResult<unknown>).value as SnsCardData[];
  }

  return result;
}
