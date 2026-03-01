import type { SpotifyDataPack, ParsedIntent } from "./types.js";

// ============================================================================
// SpotifyKeywordGroup — structured keyword groups extracted from SpotifyDataPack
// ============================================================================

export interface SpotifyKeywordGroupArtist {
  name: string;
  spotifyId: string;
  imageUrl?: string;
  popularity?: number;
  genres?: string[];
}

export interface SpotifyKeywordGroupItem {
  name: string;
  type: "album" | "track";
  artistName: string;
  coverUrl?: string;
  releaseDate?: string;
}

export interface SpotifyKeywordGroupRelated {
  name: string;
  spotifyId: string;
  imageUrl?: string;
}

export interface SpotifyKeywordGroup {
  artists: SpotifyKeywordGroupArtist[];
  albumsAndTracks: SpotifyKeywordGroupItem[];
  genres: string[];
  relatedArtists: SpotifyKeywordGroupRelated[];
}

export interface SpotifyPrefetchResult {
  prompt: string;
  intent: ParsedIntent;
  keywords: SpotifyKeywordGroup;
  spotifyData: SpotifyDataPack;
  flatKeywords: string[];
  createdAt: string;
}

// ============================================================================
// Extraction logic
// ============================================================================

/**
 * Extract structured keyword groups from a SpotifyDataPack.
 */
export function extractKeywordsFromSpotifyData(
  data: SpotifyDataPack,
): SpotifyKeywordGroup {
  // Artists
  const artists: SpotifyKeywordGroupArtist[] = (data.artists ?? []).map((a) => ({
    name: a.name,
    spotifyId: a.id,
    imageUrl: a.images[0]?.url,
    popularity: a.popularity,
    genres: a.genres,
  }));

  // Albums → albumsAndTracks
  const albumItems: SpotifyKeywordGroupItem[] = (data.albums ?? []).map((a) => ({
    name: a.name,
    type: "album" as const,
    artistName: a.artists.map((ar) => ar.name).join(", "),
    coverUrl: a.images[0]?.url,
    releaseDate: a.release_date,
  }));

  // Tracks → albumsAndTracks
  const trackItems: SpotifyKeywordGroupItem[] = (data.tracks ?? []).map((t) => ({
    name: t.name,
    type: "track" as const,
    artistName: t.artists.map((ar) => ar.name).join(", "),
  }));

  const albumsAndTracks = [...albumItems, ...trackItems];

  // Genres: collect all unique genres from artists
  const genreSet = new Set<string>();
  for (const a of data.artists ?? []) {
    for (const g of a.genres) {
      genreSet.add(g);
    }
  }
  const genres = [...genreSet];

  // Related artists: only present if intent was related_artists
  // We extract from artists list beyond the first one if intent indicates related_artists
  const relatedArtists: SpotifyKeywordGroupRelated[] = [];
  if (data.intent.intentType === "related_artists" && data.artists) {
    // First artist is the seed; rest are related
    for (const a of data.artists.slice(1)) {
      relatedArtists.push({
        name: a.name,
        spotifyId: a.id,
        imageUrl: a.images[0]?.url,
      });
    }
  }

  return { artists, albumsAndTracks, genres, relatedArtists };
}

/**
 * Build a flat, deduplicated keyword list for downstream use.
 *
 * Priority: artists.name + albumsAndTracks.name(top5) + genres(top3) + relatedArtists.name(top3)
 */
export function buildFlatKeywords(group: SpotifyKeywordGroup): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  function add(kw: string) {
    const normalized = kw.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(kw.trim());
  }

  // 1. All artist names
  for (const a of group.artists) {
    add(a.name);
  }

  // 2. Top 5 album/track names
  for (const item of group.albumsAndTracks.slice(0, 5)) {
    add(item.name);
  }

  // 3. Top 3 genres
  for (const g of group.genres.slice(0, 3)) {
    add(g);
  }

  // 4. Top 3 related artists
  for (const r of group.relatedArtists.slice(0, 3)) {
    add(r.name);
  }

  return result;
}
