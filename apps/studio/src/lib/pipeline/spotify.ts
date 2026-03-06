/**
 * Spotify Web API client for Knowledge Graph data population.
 * Uses Client Credentials flow (no user login required).
 */

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("SPOTIFY_CLIENT_ID/SECRET not set");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
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
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify API ${res.status}: ${path}`);
  return (await res.json()) as T;
}

// -- Type definitions for Spotify API responses --

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  followers: { total: number };
  images: Array<{ url: string; width: number; height: number }>;
  external_urls: { spotify: string };
}

interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: string;
  release_date: string;
  total_tracks: number;
  label: string;
  genres: string[];
  popularity: number;
  images: Array<{ url: string }>;
  artists: Array<{ id: string; name: string }>;
}

interface SpotifyTrack {
  id: string;
  name: string;
  track_number: number;
  duration_ms: number;
  popularity: number;
  preview_url: string | null;
}

interface SpotifyAudioFeatures {
  id: string;
  danceability: number;
  energy: number;
  valence: number;
  tempo: number;
  acousticness: number;
  instrumentalness: number;
}

// -- Public API --

export async function searchArtist(query: string): Promise<SpotifyArtist | null> {
  const data = await spotifyGet<{ artists: { items: SpotifyArtist[] } }>(
    `/search?q=${encodeURIComponent(query)}&type=artist&limit=1`,
  );
  return data.artists.items[0] ?? null;
}

export async function getArtist(spotifyId: string): Promise<SpotifyArtist> {
  return spotifyGet<SpotifyArtist>(`/artists/${spotifyId}`);
}

export async function getArtistAlbums(
  spotifyId: string,
  limit = 20,
): Promise<SpotifyAlbum[]> {
  const data = await spotifyGet<{ items: SpotifyAlbum[] }>(
    `/artists/${spotifyId}/albums?include_groups=album,single,ep&market=KR&limit=${limit}`,
  );
  return data.items;
}

export async function getAlbumTracks(albumSpotifyId: string): Promise<SpotifyTrack[]> {
  const data = await spotifyGet<{ items: SpotifyTrack[] }>(
    `/albums/${albumSpotifyId}/tracks?limit=50`,
  );
  return data.items;
}

export async function getAudioFeatures(trackIds: string[]): Promise<SpotifyAudioFeatures[]> {
  if (trackIds.length === 0) return [];
  // API supports max 100 IDs per request
  const batch = trackIds.slice(0, 100);
  const data = await spotifyGet<{ audio_features: (SpotifyAudioFeatures | null)[] }>(
    `/audio-features?ids=${batch.join(",")}`,
  );
  return data.audio_features.filter((f): f is SpotifyAudioFeatures => f !== null);
}

export async function getRelatedArtists(spotifyId: string): Promise<SpotifyArtist[]> {
  const data = await spotifyGet<{ artists: SpotifyArtist[] }>(
    `/artists/${spotifyId}/related-artists`,
  );
  return data.artists;
}

export async function getAlbum(albumSpotifyId: string): Promise<SpotifyAlbum> {
  return spotifyGet<SpotifyAlbum>(`/albums/${albumSpotifyId}`);
}
