/**
 * Image Sourcing — fetches relevant images from external APIs.
 *
 * Sources:
 *   1. Unsplash (free, requires UNSPLASH_ACCESS_KEY)
 *   2. Spotify album art (reuses existing Spotify client)
 *
 * Used by visual-assets to provide real photographs/album art
 * alongside AI-generated cover images.
 */
import { fetchWithTimeout } from "@/lib/fetch-utils";
import type { ResearchPacket } from "./types";

// ── Types ──────────────────────────────────────────────

export interface SourcedImage {
  url: string;
  width: number;
  height: number;
  source: "unsplash" | "spotify";
  attribution: string; // photographer credit or album info
  query: string; // what search produced this
}

// ── Unsplash ───────────────────────────────────────────

const UNSPLASH_API = "https://api.unsplash.com";

interface UnsplashPhoto {
  urls: { regular: string; small: string };
  width: number;
  height: number;
  user: { name: string; links: { html: string } };
  alt_description: string | null;
}

/**
 * Search Unsplash for photos matching a query.
 * Free: 50 requests/hour. Returns editorial-quality photos.
 * Requires UNSPLASH_ACCESS_KEY env var.
 */
async function searchUnsplash(
  query: string,
  limit = 3,
): Promise<SourcedImage[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];

  try {
    const url =
      `${UNSPLASH_API}/search/photos` +
      `?query=${encodeURIComponent(query)}&per_page=${limit}&orientation=landscape`;
    const res = await fetchWithTimeout(url, {
      timeout: 8_000,
      headers: { Authorization: `Client-ID ${key}` },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { results: UnsplashPhoto[] };

    return (data.results ?? []).map((photo) => ({
      url: photo.urls.regular,
      width: photo.width,
      height: photo.height,
      source: "unsplash" as const,
      attribution: `Photo by ${photo.user.name} on Unsplash`,
      query,
    }));
  } catch {
    return [];
  }
}

// ── Spotify Album Art ──────────────────────────────────

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API = "https://api.spotify.com/v1";

let spotifyToken: { token: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string | null> {
  if (spotifyToken && Date.now() < spotifyToken.expiresAt - 60_000) {
    return spotifyToken.token;
  }

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;

  try {
    const res = await fetchWithTimeout(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
      timeout: 8_000,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { access_token: string; expires_in: number };
    spotifyToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return spotifyToken.token;
  } catch {
    return null;
  }
}

/**
 * Fetch album art for artists found in the research packet.
 * Uses the first album image for each artist (highest resolution).
 */
async function fetchSpotifyAlbumArt(
  artistNames: string[],
): Promise<SourcedImage[]> {
  const token = await getSpotifyToken();
  if (!token || artistNames.length === 0) return [];

  const items: SourcedImage[] = [];

  for (const name of artistNames.slice(0, 3)) {
    try {
      // Search for the artist
      const searchUrl =
        `${SPOTIFY_API}/search?q=${encodeURIComponent(name)}&type=artist&limit=1&market=KR`;
      const searchRes = await fetchWithTimeout(searchUrl, {
        timeout: 8_000,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!searchRes.ok) continue;

      const searchData = (await searchRes.json()) as {
        artists: {
          items: Array<{
            id: string;
            name: string;
            images: Array<{ url: string; width: number; height: number }>;
          }>;
        };
      };

      const artist = searchData.artists?.items?.[0];
      if (!artist) continue;

      // Get latest albums for album art
      const albumsUrl =
        `${SPOTIFY_API}/artists/${artist.id}/albums?include_groups=album,single&market=KR&limit=3`;
      const albumsRes = await fetchWithTimeout(albumsUrl, {
        timeout: 8_000,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!albumsRes.ok) continue;

      const albumsData = (await albumsRes.json()) as {
        items: Array<{
          name: string;
          images: Array<{ url: string; width: number; height: number }>;
          artists: Array<{ name: string }>;
        }>;
      };

      for (const album of albumsData.items ?? []) {
        const img = album.images?.[0]; // highest resolution
        if (img) {
          items.push({
            url: img.url,
            width: img.width,
            height: img.height,
            source: "spotify",
            attribution: `${album.artists.map((a) => a.name).join(", ")} — ${album.name} (Spotify, 저작권법 제28조 보도·비평 목적 인용)`,
            query: name,
          });
        }
      }
    } catch {
      // Skip this artist
    }
  }

  return items;
}

// ── Public API ─────────────────────────────────────────

/**
 * Source relevant images from Unsplash + Spotify based on research data.
 * Returns a mix of stock photos and album artwork.
 */
export async function sourceImages(opts: {
  topic: string;
  research?: ResearchPacket | null;
  maxImages?: number;
}): Promise<SourcedImage[]> {
  const { topic, research, maxImages = 6 } = opts;
  const artistNames = research?.artists.map((a) => a.name) ?? [];

  const [unsplashImages, spotifyImages] = await Promise.all([
    searchUnsplash(topic, 3),
    fetchSpotifyAlbumArt(artistNames),
  ]);

  // Spotify images first (more relevant for music magazine), then Unsplash
  const combined = [...spotifyImages, ...unsplashImages];
  return combined.slice(0, maxImages);
}

/**
 * Source images by explicit keyword queries (for non-research contexts).
 */
export async function sourceImagesByQuery(
  queries: string[],
  limit = 3,
): Promise<SourcedImage[]> {
  const results = await Promise.allSettled(
    queries.slice(0, 3).map((q) => searchUnsplash(q, limit)),
  );

  const items: SourcedImage[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
  }
  return items;
}
