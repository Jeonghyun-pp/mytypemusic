import type { TopicPackage } from "./types.js";
import type { SlidePlan } from "./story-planner.js";
import { pickBodyVariation, type VariationId } from "./selector.js";
import { STYLE_PRESETS } from "./presets.js";
import type { PostType } from "../shared/post-types.js";

// ============================================================================
// Music Story Planner — PostType-specific slide sequence generation
//
// Does NOT touch existing buildSlidePlan(). Exports a separate function
// buildMusicSlidePlan() for music PostTypes.
// ============================================================================

export interface MusicSlidePlanOptions {
  seed?: string;
  memeText?: string;
  memePosition?: "top" | "center" | "bottom";
  albums?: Array<{ title: string; artist: string }>;
  concertVenue?: string;
  concertDate?: string;
  concertLineup?: string[];
  playlistTitle?: string;
}

/**
 * Build a slide plan for a music PostType.
 *
 * Each PostType generates a specific slide sequence:
 *
 * album_release:
 *   [music.album.cover.v1] → [body.fact.v1~v3 x 2~3] → [music.album.detail.v1] → [outro.cta.v1]
 *
 * meme:
 *   [music.meme.v1] (single slide)
 *
 * album_recommendation:
 *   [cover.hero.v1] → [music.grid.v1] → [body.fact.v1~v3 x 2~4] → [outro.cta.v1]
 *
 * concert_info:
 *   [music.concert.v1] → [body.fact.v1 (details)] → [outro.cta.v1]
 *
 * curated_playlist:
 *   [cover.hero.v1] → [music.grid.v1 x 1~2] → [outro.cta.v1]
 *
 * artist_spotlight:
 *   [music.album.cover.v1] → [body.fact.v1~v3 x 3] → [outro.cta.v1]
 */
export function buildMusicSlidePlan(
  postType: PostType,
  topic: TopicPackage,
  options?: MusicSlidePlanOptions,
): SlidePlan[] {
  const plans: SlidePlan[] = [];
  let idx = 1;

  const topicAny = topic as unknown as Record<string, unknown>;
  const topicId = typeof topicAny.topicId === "string" ? topicAny.topicId : undefined;
  const seed = options?.seed ?? topicId ?? topic.title;

  const preset = STYLE_PRESETS.music;

  switch (postType) {
    case "album_release": {
      // Album cover
      plans.push({
        index: idx++,
        kind: "cover",
        templateId: "music.album.cover.v1",
        payload: { presetId: "music" },
      });

      // Fact slides (up to 3)
      const facts = topic.keyFacts?.slice(0, 3) ?? [];
      for (let i = 0; i < facts.length; i++) {
        const variationId: VariationId = pickBodyVariation({ seed, index: i });
        plans.push({
          index: idx++,
          kind: "fact",
          templateId: `body.fact.${variationId}`,
          payload: {
            headline: preset.fact.headlineLabel,
            body: facts[i],
            variationId,
            presetId: "music",
          },
        });
      }

      // Tracklist detail
      plans.push({
        index: idx++,
        kind: "fact",
        templateId: "music.album.detail.v1",
        payload: { presetId: "music" },
      });

      // Outro
      plans.push({
        index: idx++,
        kind: "outro",
        templateId: "outro.cta.v1",
        payload: { cta: preset.outro.cta, presetId: "music" },
      });
      break;
    }

    case "meme": {
      // Single slide
      const templateId = options?.memeText && (options.memeText.length > 80)
        ? "music.meme.v2"  // Text-only card for longer text
        : "music.meme.v1"; // Image + overlay for shorter text
      plans.push({
        index: idx++,
        kind: "cover",
        templateId,
        payload: {
          memeText: options?.memeText ?? "",
          memePosition: options?.memePosition ?? "center",
          presetId: "music",
        },
      });
      break;
    }

    case "album_recommendation": {
      // Cover
      plans.push({
        index: idx++,
        kind: "cover",
        templateId: "cover.hero.v1",
        payload: { presetId: "music" },
      });

      // Album grid
      plans.push({
        index: idx++,
        kind: "cover",
        templateId: "music.grid.v1",
        payload: { albums: options?.albums ?? [], presetId: "music" },
      });

      // Fact slides (up to 4)
      const recFacts = topic.keyFacts?.slice(0, 4) ?? [];
      for (let i = 0; i < recFacts.length; i++) {
        const variationId: VariationId = pickBodyVariation({ seed, index: i });
        plans.push({
          index: idx++,
          kind: "fact",
          templateId: `body.fact.${variationId}`,
          payload: {
            headline: preset.fact.headlineLabel,
            body: recFacts[i],
            variationId,
            presetId: "music",
          },
        });
      }

      // Outro
      plans.push({
        index: idx++,
        kind: "outro",
        templateId: "outro.cta.v1",
        payload: { cta: preset.outro.cta, presetId: "music" },
      });
      break;
    }

    case "concert_info": {
      // Concert poster
      plans.push({
        index: idx++,
        kind: "cover",
        templateId: "music.concert.v1",
        payload: {
          venue: options?.concertVenue ?? "",
          date: options?.concertDate ?? "",
          lineup: options?.concertLineup ?? [],
          presetId: "music",
        },
      });

      // Detail fact
      if (topic.keyFacts && topic.keyFacts.length > 0) {
        plans.push({
          index: idx++,
          kind: "fact",
          templateId: "body.fact.v1",
          payload: {
            headline: "공연 정보",
            body: topic.keyFacts[0],
            presetId: "music",
          },
        });
      }

      // Outro
      plans.push({
        index: idx++,
        kind: "outro",
        templateId: "outro.cta.v1",
        payload: { cta: preset.outro.cta, presetId: "music" },
      });
      break;
    }

    case "curated_playlist": {
      // Cover
      plans.push({
        index: idx++,
        kind: "cover",
        templateId: "cover.hero.v1",
        payload: {
          playlistTitle: options?.playlistTitle ?? topic.title,
          presetId: "music",
        },
      });

      // Grid(s)
      plans.push({
        index: idx++,
        kind: "cover",
        templateId: "music.grid.v1",
        payload: { albums: options?.albums ?? [], presetId: "music" },
      });

      // Outro
      plans.push({
        index: idx++,
        kind: "outro",
        templateId: "outro.cta.v1",
        payload: { cta: preset.outro.cta, presetId: "music" },
      });
      break;
    }

    case "artist_spotlight": {
      // Album cover as hero
      plans.push({
        index: idx++,
        kind: "cover",
        templateId: "music.album.cover.v1",
        payload: { presetId: "music" },
      });

      // Fact slides (up to 3)
      const spotlightFacts = topic.keyFacts?.slice(0, 3) ?? [];
      for (let i = 0; i < spotlightFacts.length; i++) {
        const variationId: VariationId = pickBodyVariation({ seed, index: i });
        plans.push({
          index: idx++,
          kind: "fact",
          templateId: `body.fact.${variationId}`,
          payload: {
            headline: preset.fact.headlineLabel,
            body: spotlightFacts[i],
            variationId,
            presetId: "music",
          },
        });
      }

      // Outro
      plans.push({
        index: idx++,
        kind: "outro",
        templateId: "outro.cta.v1",
        payload: { cta: preset.outro.cta, presetId: "music" },
      });
      break;
    }

    default:
      // Fallback: shouldn't reach here for music PostTypes
      break;
  }

  return plans;
}
