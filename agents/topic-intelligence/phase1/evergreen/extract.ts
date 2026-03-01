// ============================================================================
// Evergreen fact extraction — Wikipedia + Spotify for non-news topics
//
// Used when topicType === "evergreen". Instead of scoring news articles,
// this module builds keyFacts and sources from encyclopedic content.
// ============================================================================

import { readFile } from "node:fs/promises";
import type { TopicSource } from "../../contracts.js";
import type { KeyFactCandidate } from "../facts/extract.js";
import {
  fetchWikipediaArticle,
  searchWikipedia,
  type WikiArticle,
} from "../../sources/wikipedia.js";
import type { SpotifyDataPack } from "../../spotify/types.js";

// ============================================================================
// Types
// ============================================================================

export interface EvergreenFactsResult {
  keyFacts: KeyFactCandidate[];
  sources: TopicSource[];
  wikiArticle?: WikiArticle;
  spotifyData?: SpotifyDataPack;
}

// ============================================================================
// Main extractor
// ============================================================================

/**
 * Extract facts for an evergreen topic from Wikipedia + Spotify.
 *
 * Flow:
 *  1. Wikipedia search for each entity + primaryTopic
 *  2. Extract key sentences from wiki sections
 *  3. Load Spotify data (if music category, from prefetch or direct)
 *  4. Combine into keyFacts + sources
 */
export async function extractEvergreenFacts(params: {
  prompt: string;
  seedKeyword: string;
  entities: string[];
  category?: string;
  spotifyPrefetchPath?: string;
}): Promise<EvergreenFactsResult> {
  const { seedKeyword, entities, category, spotifyPrefetchPath } = params;

  const keyFacts: KeyFactCandidate[] = [];
  const sources: TopicSource[] = [];
  let primaryWikiArticle: WikiArticle | undefined;

  // ── 1. Wikipedia: search for primary topic ──
  try {
    const article = await fetchWikipediaArticle(seedKeyword);
    if (article) {
      primaryWikiArticle = article;
      sources.push({
        title: article.title,
        publisher: "Wikipedia",
        url: article.url,
      });

      // Extract facts from sections
      const wikiFacts = extractFactsFromWikiArticle(article);
      keyFacts.push(...wikiFacts);
    }
  } catch (err) {
    console.warn(
      `[Evergreen] Wikipedia fetch failed for "${seedKeyword}" (soft-fail): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // ── 2. Wikipedia: search for each entity (if different from seedKeyword) ──
  for (const entity of entities) {
    if (entity.toLowerCase() === seedKeyword.toLowerCase()) continue;

    try {
      const article = await fetchWikipediaArticle(entity);
      if (article) {
        // Avoid duplicate sources
        if (!sources.some((s) => s.url === article.url)) {
          sources.push({
            title: article.title,
            publisher: "Wikipedia",
            url: article.url,
          });
        }

        const wikiFacts = extractFactsFromWikiArticle(article);
        // Only add non-duplicate facts
        for (const fact of wikiFacts) {
          if (!keyFacts.some((kf) => kf.text === fact.text)) {
            keyFacts.push(fact);
          }
        }
      }
    } catch {
      // Soft-fail per entity
    }
  }

  // ── 3. Spotify data (music category only) ──
  let spotifyData: SpotifyDataPack | undefined;
  if (category === "music" && spotifyPrefetchPath) {
    try {
      const raw = JSON.parse(await readFile(spotifyPrefetchPath, "utf-8")) as {
        spotifyData?: SpotifyDataPack;
      };
      spotifyData = raw.spotifyData;

      if (spotifyData) {
        const spotifyFacts = extractFactsFromSpotify(spotifyData);
        keyFacts.push(...spotifyFacts);

        // Add Spotify artist URLs as sources
        if (spotifyData.artists) {
          for (const artist of spotifyData.artists.slice(0, 3)) {
            const artistUrl = artist.external_urls?.spotify;
            if (artistUrl) {
              sources.push({
                title: `${artist.name} - Spotify`,
                publisher: "Spotify",
                url: artistUrl,
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn(
        `[Evergreen] Spotify prefetch load failed (soft-fail): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // ── 4. If no facts at all, try broader Wikipedia search ──
  if (keyFacts.length === 0) {
    try {
      const searchResults = await searchWikipedia(seedKeyword, 3);
      for (const result of searchResults) {
        if (result.snippet.length >= 20) {
          keyFacts.push({
            text: result.snippet,
            evidenceUrls: [result.url],
          });
          if (!sources.some((s) => s.url === result.url)) {
            sources.push({
              title: result.title,
              publisher: "Wikipedia",
              url: result.url,
            });
          }
        }
      }
    } catch {
      // Final soft-fail
    }
  }

  return {
    keyFacts: keyFacts.slice(0, 15), // Cap at 15 facts
    sources,
    wikiArticle: primaryWikiArticle,
    spotifyData,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract key facts from a Wikipedia article's sections.
 *
 * Takes the first 1-2 sentences from each section with enough content.
 */
function extractFactsFromWikiArticle(article: WikiArticle): KeyFactCandidate[] {
  const facts: KeyFactCandidate[] = [];

  for (const section of article.sections) {
    // Split section content into sentences
    const sentences = splitIntoSentences(section.content);

    for (const sentence of sentences.slice(0, 2)) {
      if (sentence.length >= 30 && sentence.length <= 300) {
        facts.push({
          text: sentence,
          evidenceUrls: [article.url],
        });
      }
    }

    // Cap facts per article
    if (facts.length >= 10) break;
  }

  return facts;
}

/**
 * Extract facts from Spotify data (artist profiles, album info).
 */
function extractFactsFromSpotify(data: SpotifyDataPack): KeyFactCandidate[] {
  const facts: KeyFactCandidate[] = [];

  // Artist facts
  if (data.artists) {
    for (const artist of data.artists.slice(0, 2)) {
      const genres = artist.genres.slice(0, 3).join(", ");
      const artistUrl = artist.external_urls?.spotify ?? "https://open.spotify.com";

      if (genres) {
        facts.push({
          text: `${artist.name}의 주요 장르: ${genres} (Spotify 인기도: ${String(artist.popularity)})`,
          evidenceUrls: [artistUrl],
        });
      }

      if (artist.followers?.total && artist.followers.total > 0) {
        const formatted = formatNumber(artist.followers.total);
        facts.push({
          text: `${artist.name}의 Spotify 팔로워 수: ${formatted}명`,
          evidenceUrls: [artistUrl],
        });
      }
    }
  }

  // Album facts
  if (data.albums) {
    for (const album of data.albums.slice(0, 3)) {
      const artists = album.artists.map((a) => a.name).join(", ");
      const albumUrl = album.external_urls?.spotify ?? "https://open.spotify.com";

      if (album.release_date) {
        facts.push({
          text: `${album.name} (${artists}) — ${album.release_date} 발매, ${String(album.total_tracks)}곡 수록`,
          evidenceUrls: [albumUrl],
        });
      }
    }
  }

  // Top tracks
  if (data.tracks && data.tracks.length > 0) {
    const topTracks = data.tracks
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 5);
    const trackNames = topTracks.map((t) => t.name).join(", ");
    const trackUrl = topTracks[0]?.external_urls?.spotify ?? "https://open.spotify.com";

    facts.push({
      text: `Spotify 인기곡: ${trackNames}`,
      evidenceUrls: [trackUrl],
    });
  }

  return facts;
}

/** Split text into Korean/English sentences. */
function splitIntoSentences(text: string): string[] {
  // Split by Korean/English sentence endings
  return text
    .split(/(?<=[.!?。])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Format large numbers with Korean units (만/억). */
function formatNumber(n: number): string {
  if (n >= 100_000_000) {
    return `${(n / 100_000_000).toFixed(1)}억`;
  }
  if (n >= 10_000) {
    return `${(n / 10_000).toFixed(1)}만`;
  }
  return n.toLocaleString();
}
