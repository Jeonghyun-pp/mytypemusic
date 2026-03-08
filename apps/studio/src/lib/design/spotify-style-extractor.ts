/**
 * Spotify Style Extractor — auto-extracts StyleToken from Spotify album art.
 *
 * Integrates Spotify API with Style Transfer Agent and Style Memory:
 *   1. Fetch album/artist from Spotify
 *   2. Download album art
 *   3. Extract StyleToken via Vision API
 *   4. Cache in Style Memory
 *   5. Return token for use in design pipeline
 */

import { searchArtist, getArtist, getArtistAlbums, getAlbum } from "../pipeline/spotify";
import { extractStyleToken } from "./style-transfer";
import type { StyleTransferOptions } from "./style-transfer";
import type { StyleToken } from "./types";
import {
  saveStyleMemory,
  getStyleMemory,
  getArtistStyle,
  artistKey,
  albumKey,
} from "./style-memory";

// ── Options ─────────────────────────────────────────

export interface SpotifyStyleOptions extends StyleTransferOptions {
  /** Skip cache lookup, force re-extraction. */
  forceRefresh?: boolean;
  /** Also extract from the artist's top albums (up to this count). */
  extractAlbumCount?: number;
}

// ── Main functions ──────────────────────────────────

/**
 * Extract style from a Spotify album by ID.
 * Checks cache first, extracts on miss.
 */
export async function extractStyleFromAlbum(
  spotifyAlbumId: string,
  opts?: SpotifyStyleOptions,
): Promise<StyleToken> {
  const cacheKey = albumKey(spotifyAlbumId);

  // Check cache
  if (!opts?.forceRefresh) {
    const cached = getStyleMemory(cacheKey);
    if (cached) return cached;
  }

  // Fetch album from Spotify
  const album = await getAlbum(spotifyAlbumId);
  const imageUrl = album.images[0]?.url;
  if (!imageUrl) {
    throw new Error(`No album art found for album: ${album.name}`);
  }

  // Download and extract
  const base64 = await downloadImageAsBase64(imageUrl);
  const token = await extractStyleToken(base64, {
    ...opts,
    contextHint: `K-POP/Korean music album cover for "${album.name}" by ${album.artists[0]?.name ?? "unknown"}`,
  });

  token.sourceImageUrl = imageUrl;
  token.name = `${album.name} Style`;

  // Cache
  saveStyleMemory({
    key: cacheKey,
    token,
    source: "spotify_album_art",
    artistName: album.artists[0]?.name,
    albumName: album.name,
    spotifyArtistId: album.artists[0]?.id,
    spotifyAlbumId: album.id,
    confidence: 0.85,
    extractedAt: new Date(),
  });

  return token;
}

/**
 * Extract style from a Spotify artist (uses their latest album's art).
 * Checks cache first, extracts on miss.
 */
export async function extractStyleFromArtist(
  spotifyArtistId: string,
  opts?: SpotifyStyleOptions,
): Promise<StyleToken> {
  // Check cache
  if (!opts?.forceRefresh) {
    const cached = getArtistStyle(spotifyArtistId);
    if (cached) return cached;
  }

  // Fetch artist's albums
  const albums = await getArtistAlbums(spotifyArtistId, opts?.extractAlbumCount ?? 3);
  if (albums.length === 0) {
    throw new Error(`No albums found for artist: ${spotifyArtistId}`);
  }

  // Extract from the latest album
  const latest = albums[0]!;
  const token = await extractStyleFromAlbum(latest.id, opts);

  // Also cache at artist level
  const artist = await getArtist(spotifyArtistId);
  saveStyleMemory({
    key: artistKey(spotifyArtistId),
    token,
    source: "spotify_album_art",
    artistName: artist.name,
    albumName: latest.name,
    spotifyArtistId: spotifyArtistId,
    spotifyAlbumId: latest.id,
    confidence: 0.8,
    extractedAt: new Date(),
  });

  return token;
}

/**
 * Search for an artist by name and extract their style.
 * Convenience wrapper combining search + extraction.
 */
export async function extractStyleByArtistName(
  artistName: string,
  opts?: SpotifyStyleOptions,
): Promise<StyleToken | null> {
  const artist = await searchArtist(artistName);
  if (!artist) return null;

  return extractStyleFromArtist(artist.id, opts);
}

/**
 * Batch extract styles from multiple albums.
 * Useful for building an artist's style evolution.
 */
export async function extractStylesFromArtistAlbums(
  spotifyArtistId: string,
  maxAlbums: number = 5,
  opts?: SpotifyStyleOptions,
): Promise<StyleToken[]> {
  const albums = await getArtistAlbums(spotifyArtistId, maxAlbums);
  const tokens: StyleToken[] = [];

  for (const album of albums) {
    try {
      const token = await extractStyleFromAlbum(album.id, opts);
      tokens.push(token);
    } catch (err) {
      console.error(`Failed to extract style from album "${album.name}":`, err);
    }
  }

  return tokens;
}

/**
 * Merge multiple StyleTokens into a representative "artist style".
 * Uses the most common values across tokens.
 */
export function mergeStyleTokens(tokens: StyleToken[]): StyleToken | null {
  if (tokens.length === 0) return null;
  if (tokens.length === 1) return tokens[0]!;

  // Aggregate all palette colors with their ratios
  const colorFreq = new Map<string, number>();
  for (const t of tokens) {
    for (let i = 0; i < t.colors.palette.length; i++) {
      const hex = t.colors.palette[i]!.toLowerCase();
      const ratio = t.colors.ratios[i] ?? 0;
      colorFreq.set(hex, (colorFreq.get(hex) ?? 0) + ratio);
    }
  }

  // Top 5 colors by frequency
  const sortedColors = Array.from(colorFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const totalWeight = sortedColors.reduce((s, [, w]) => s + w, 0);

  // Most common mood, weight, style (majority vote)
  const moodVotes = tokens.map((t) => t.typography.mood);
  const weightVotes = tokens.map((t) => t.typography.weight);
  const styleVotes = tokens.map((t) => t.typography.style);
  const densityVotes = tokens.map((t) => t.layout.density);
  const alignVotes = tokens.map((t) => t.layout.alignment);
  const wsVotes = tokens.map((t) => t.layout.whitespace);

  // All mood keywords
  const allKeywords = new Set(tokens.flatMap((t) => t.moodKeywords));
  const allEffects = new Set(tokens.flatMap((t) => t.effects));

  return {
    id: `style_merged_${Date.now()}`,
    name: `${tokens[0]!.name} (merged)`,
    sourceImageUrl: tokens[0]!.sourceImageUrl,
    colors: {
      palette: sortedColors.map(([hex]) => hex),
      ratios: sortedColors.map(([, w]) => Math.round((w / totalWeight) * 100) / 100),
      gradient: tokens[0]!.colors.gradient,
    },
    typography: {
      mood: majority(moodVotes),
      weight: majority(weightVotes),
      style: majority(styleVotes),
    },
    layout: {
      density: majority(densityVotes),
      alignment: majority(alignVotes),
      whitespace: majority(wsVotes),
    },
    effects: Array.from(allEffects).slice(0, 6),
    moodKeywords: Array.from(allKeywords).slice(0, 8),
  };
}

// ── Helpers ─────────────────────────────────────────

async function downloadImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") ?? "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function majority<T>(votes: T[]): T {
  const freq = new Map<T, number>();
  for (const v of votes) {
    freq.set(v, (freq.get(v) ?? 0) + 1);
  }
  let best: T = votes[0]!;
  let bestCount = 0;
  for (const [val, count] of freq) {
    if (count > bestCount) {
      best = val;
      bestCount = count;
    }
  }
  return best;
}
