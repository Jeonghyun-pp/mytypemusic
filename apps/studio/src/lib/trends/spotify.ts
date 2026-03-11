import type { TrendProvider, TrendItem } from "./types";
import { fetchWithTimeout } from "@/lib/fetch-utils";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("SPOTIFY credentials not set");

  const res = await fetchWithTimeout(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
    timeout: 8_000,
  });

  if (!res.ok) throw new Error(`Spotify token error: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

async function spotifyGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10_000,
  });
  if (!res.ok) throw new Error(`Spotify API ${res.status}: ${path}`);
  return (await res.json()) as T;
}

// -- Spotify API response types --

interface SpotifyAlbumSimple {
  id: string;
  name: string;
  album_type: string;
  release_date: string;
  total_tracks: number;
  artists: Array<{ id: string; name: string }>;
  external_urls: { spotify: string };
}

interface SpotifyTrackItem {
  id: string;
  name: string;
  popularity: number;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    release_date: string;
    external_urls: { spotify: string };
  };
  external_urls: { spotify: string };
}

/**
 * Spotify trend provider — New Releases + keyword artist/track search.
 * Requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.
 * Uses Client Credentials flow (no user login).
 */
export const spotifyProvider: TrendProvider = {
  name: "spotify",
  async fetch(opts) {
    const id = process.env.SPOTIFY_CLIENT_ID;
    const secret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!id || !secret) return [];

    const [newReleases, keywordItems] = await Promise.all([
      fetchNewReleases(opts?.geo ?? "KR"),
      fetchKeywordTrends(opts?.keywords ?? []),
    ]);

    return [...newReleases, ...keywordItems];
  },
};

/**
 * Fetch latest album/single releases in the Korean market.
 * Endpoint: GET /browse/new-releases?country=KR&limit=10
 */
async function fetchNewReleases(country: string): Promise<TrendItem[]> {
  try {
    const data = await spotifyGet<{
      albums: { items: SpotifyAlbumSimple[] };
    }>(`/browse/new-releases?country=${country}&limit=10`);

    return (data.albums?.items ?? []).map(
      (album, i): TrendItem => ({
        title: `${album.artists.map((a) => a.name).join(", ")} — ${album.name}`,
        source: "spotify",
        url: album.external_urls.spotify,
        description: `${album.album_type} | ${album.release_date} | ${album.total_tracks}곡`,
        rank: i + 1,
        fetchedAt: new Date(),
      }),
    );
  } catch {
    return [];
  }
}

/**
 * Search Spotify for tracks matching keywords.
 * Max 3 keywords, parallel calls.
 * Endpoint: GET /search?q={keyword}&type=track&market=KR&limit=5
 */
async function fetchKeywordTrends(keywords: string[]): Promise<TrendItem[]> {
  if (keywords.length === 0) return [];

  const results = await Promise.allSettled(
    keywords.slice(0, 3).map(async (kw) => {
      const data = await spotifyGet<{
        tracks: { items: SpotifyTrackItem[] };
      }>(
        `/search?q=${encodeURIComponent(kw)}&type=track&market=KR&limit=5`,
      );

      return (data.tracks?.items ?? []).map(
        (track, i): TrendItem => ({
          title: `${track.artists.map((a) => a.name).join(", ")} — ${track.name}`,
          source: "spotify-search",
          url: track.external_urls.spotify,
          description: `앨범: ${track.album.name} | 인기도: ${track.popularity}/100`,
          keyword: kw,
          rank: i + 1,
          fetchedAt: new Date(),
        }),
      );
    }),
  );

  const items: TrendItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
  }
  return items;
}
