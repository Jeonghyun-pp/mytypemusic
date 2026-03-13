/**
 * Unified Image Search API — aggregates Unsplash, Pexels, and Spotify results.
 *
 * GET /api/design/images?q=sunset&source=all&page=1
 *
 * Sources: unsplash, pexels, spotify, all (default)
 * Returns unified ImageSearchResult[] with attribution.
 */

import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/fetch-utils";

// ── Types ────────────────────────────────────────────────

export interface ImageSearchResult {
  id: string;
  source: "unsplash" | "pexels" | "spotify";
  previewUrl: string;
  fullUrl: string;
  sourceUrl: string;
  author: string;
  attribution: string;
  width: number;
  height: number;
}

// ── Unsplash ─────────────────────────────────────────────

async function searchUnsplash(query: string, page: number): Promise<ImageSearchResult[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];

  try {
    const params = new URLSearchParams({
      query,
      per_page: "12",
      page: String(page),
    });
    const res = await fetchWithTimeout(
      `https://api.unsplash.com/search/photos?${params.toString()}`,
      { timeout: 8_000, headers: { Authorization: `Client-ID ${key}` } },
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      results: Array<{
        id: string;
        width: number;
        height: number;
        urls: { small: string; regular: string };
        links: { html: string };
        user: { name: string };
      }>;
    };

    return (data.results ?? []).map((p) => ({
      id: `unsplash-${p.id}`,
      source: "unsplash" as const,
      previewUrl: p.urls.small,
      fullUrl: p.urls.regular,
      sourceUrl: p.links.html,
      author: p.user.name,
      attribution: `Photo by ${p.user.name} on Unsplash`,
      width: p.width,
      height: p.height,
    }));
  } catch {
    return [];
  }
}

// ── Pexels ───────────────────────────────────────────────

async function searchPexels(query: string, page: number): Promise<ImageSearchResult[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];

  try {
    const params = new URLSearchParams({
      query,
      per_page: "12",
      page: String(page),
    });
    const res = await fetchWithTimeout(
      `https://api.pexels.com/v1/search?${params.toString()}`,
      { timeout: 8_000, headers: { Authorization: key } },
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      photos: Array<{
        id: number;
        width: number;
        height: number;
        url: string;
        photographer: string;
        src: { medium: string; large: string };
      }>;
    };

    return (data.photos ?? []).map((p) => ({
      id: `pexels-${String(p.id)}`,
      source: "pexels" as const,
      previewUrl: p.src.medium,
      fullUrl: p.src.large,
      sourceUrl: p.url,
      author: p.photographer,
      attribution: `Photo by ${p.photographer} on Pexels`,
      width: p.width,
      height: p.height,
    }));
  } catch {
    return [];
  }
}

// ── Spotify ──────────────────────────────────────────────

let spotifyToken: { token: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string | null> {
  if (spotifyToken && Date.now() < spotifyToken.expiresAt - 60_000) {
    return spotifyToken.token;
  }

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;

  try {
    const res = await fetchWithTimeout("https://accounts.spotify.com/api/token", {
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
    spotifyToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return spotifyToken.token;
  } catch {
    return null;
  }
}

async function searchSpotify(query: string): Promise<ImageSearchResult[]> {
  const token = await getSpotifyToken();
  if (!token) return [];

  try {
    const params = new URLSearchParams({
      q: query,
      type: "album",
      limit: "12",
      market: "KR",
    });
    const res = await fetchWithTimeout(
      `https://api.spotify.com/v1/search?${params.toString()}`,
      { timeout: 8_000, headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      albums: {
        items: Array<{
          id: string;
          name: string;
          artists: Array<{ name: string }>;
          images: Array<{ url: string; width: number; height: number }>;
          external_urls: { spotify: string };
        }>;
      };
    };

    return (data.albums?.items ?? [])
      .filter((a) => a.images.length > 0)
      .map((a) => {
        const img = a.images[0]!;
        const artistNames = a.artists.map((ar) => ar.name).join(", ");
        return {
          id: `spotify-${a.id}`,
          source: "spotify" as const,
          previewUrl: a.images[a.images.length > 1 ? 1 : 0]!.url,
          fullUrl: img.url,
          sourceUrl: a.external_urls.spotify,
          author: artistNames,
          attribution: `${artistNames} — ${a.name} (Spotify)`,
          width: img.width,
          height: img.height,
        };
      });
  } catch {
    return [];
  }
}

// ── Route handler ────────────────────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") ?? "";
  const source = url.searchParams.get("source") ?? "all";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  if (!query.trim()) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const searches: Promise<ImageSearchResult[]>[] = [];

  if (source === "all" || source === "unsplash") searches.push(searchUnsplash(query, page));
  if (source === "all" || source === "pexels") searches.push(searchPexels(query, page));
  if (source === "all" || source === "spotify") searches.push(searchSpotify(query));

  const settled = await Promise.allSettled(searches);
  const results = settled
    .filter((r): r is PromiseFulfilledResult<ImageSearchResult[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  // Interleave results from different sources for variety
  const bySource = new Map<string, ImageSearchResult[]>();
  for (const r of results) {
    const existing = bySource.get(r.source) ?? [];
    existing.push(r);
    bySource.set(r.source, existing);
  }

  const interleaved: ImageSearchResult[] = [];
  const sources = Array.from(bySource.values());
  const maxLen = Math.max(...sources.map((s) => s.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const group of sources) {
      if (i < group.length) interleaved.push(group[i]!);
    }
  }

  return NextResponse.json({
    results: interleaved,
    total: interleaved.length,
  });
}
