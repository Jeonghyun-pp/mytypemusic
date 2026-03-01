import type { ContentPlan, ContentSlide, Agent2TopicPackage } from "../contracts.js";

const MAX_KEY_FACTS = 4;

// Music slide kinds that map to specific Agent2 template families
const MUSIC_SLIDE_KIND_TO_FAMILY: Record<string, string> = {
  album_cover: "music.album",
  tracklist: "music.album",
  meme: "music.meme",
  album_grid: "music.grid",
  concert_info: "music.concert",
};

/**
 * Convert a ContentPlan (+ optional keyFacts from TopicIntelPack)
 * to an Agent2-compatible TopicPackage.
 *
 * Priority for keyFacts:
 *  1. topicIntel keyFacts (full text, higher quality)
 *  2. Fallback: extract headlines from ContentPlan fact slides
 *
 * For music PostTypes, also resolves template family hints from slide kinds.
 */
export function toAgent2TopicPackage(params: {
  contentPlan: ContentPlan;
  keyFacts?: string[];
}): Agent2TopicPackage {
  const { contentPlan, keyFacts } = params;

  // Resolve keyFacts: prefer topicIntel facts, fallback to slide headlines
  let resolvedKeyFacts: string[] | undefined;

  if (keyFacts && keyFacts.length > 0) {
    resolvedKeyFacts = keyFacts.slice(0, MAX_KEY_FACTS);
  } else {
    // Include both standard fact slides and music-specific slides
    const factLikeSlides = contentPlan.slides.filter(
      (s) => s.kind === "fact" || s.kind === "album_cover" || s.kind === "tracklist",
    );
    if (factLikeSlides.length > 0) {
      resolvedKeyFacts = factLikeSlides
        .slice(0, MAX_KEY_FACTS)
        .map((s) => s.headline);
    }
  }

  const result: Agent2TopicPackage = {
    title: contentPlan.title,
    category: contentPlan.category,
  };

  if (contentPlan.subtitle) {
    result.subtitle = contentPlan.subtitle;
  }

  if (resolvedKeyFacts && resolvedKeyFacts.length > 0) {
    result.keyFacts = resolvedKeyFacts;
  }

  if (contentPlan.hashtags.length > 0) {
    result.hashtags = contentPlan.hashtags;
  }

  return result;
}

/**
 * Determine the primary template family hint from music slide kinds.
 * Used by Agent2 to select the appropriate template set.
 */
export function detectMusicTemplateFamily(slides: ContentSlide[]): string | undefined {
  for (const slide of slides) {
    const family = MUSIC_SLIDE_KIND_TO_FAMILY[slide.kind];
    if (family) return family;
  }
  return undefined;
}
