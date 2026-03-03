import { NextResponse } from "next/server";
import axios from "axios";

// ── Spotify auth (inline — avoids bundling agents/ in Next.js server) ──

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await axios.post<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }>(TOKEN_URL, "grant_type=client_credentials", {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 10_000,
  });

  cachedToken = {
    token: res.data.access_token,
    expiresAt: Date.now() + res.data.expires_in * 1000,
  };
  return cachedToken.token;
}

async function spotifyGet<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const token = await getAccessToken();
  const res = await axios.get<T>(`${API_BASE}${path}`, {
    params,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10_000,
  });
  return res.data;
}

// ── Types ────────────────────────────────────────────────

interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

interface SpotifyArtistRef {
  id: string;
  name: string;
  external_urls: { spotify: string };
}

interface SpotifyAlbumItem {
  id: string;
  name: string;
  artists: SpotifyArtistRef[];
  images: SpotifyImage[];
  release_date?: string;
  total_tracks?: number;
  album_type?: string;
  external_urls: { spotify: string };
}

interface SpotifyArtistItem {
  id: string;
  name: string;
  genres: string[];
  images: SpotifyImage[];
  popularity: number;
  followers: { total: number };
  external_urls: { spotify: string };
}

interface SpotifyTrackItem {
  id: string;
  name: string;
  artists: SpotifyArtistRef[];
  album: SpotifyAlbumItem;
  duration_ms: number;
  popularity: number;
  external_urls: { spotify: string };
}

type SearchType = "album" | "artist" | "track";

interface SearchRequestBody {
  action?: "search" | "download";
  query?: string;
  type?: SearchType;
  limit?: number;
  imageUrl?: string; // for download action
}

// ── Attribution builder (mirrors safe-image-acquisition/providers/spotify.ts) ──

function buildAttribution(artist: string): string {
  return `Album art via Spotify — ${artist || "Unknown Artist"}`;
}

const LICENSE_TEXT =
  "Spotify album cover art used for editorial/review purposes " +
  "under 한국 저작권법 제28조 (fair use for reporting/criticism).";

// ── Route handler ────────────────────────────────────────

export async function POST(req: Request) {
  let body: SearchRequestBody;
  try {
    body = (await req.json()) as SearchRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body" },
      { status: 400 },
    );
  }

  // ── Download action: fetch image as base64 ──
  if (body.action === "download") {
    const { imageUrl } = body;
    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "imageUrl is required for download action" },
        { status: 400 },
      );
    }

    try {
      const res = await axios.get<ArrayBuffer>(imageUrl, {
        timeout: 15_000,
        responseType: "arraybuffer",
      });
      const ct = res.headers["content-type"];
      const mimeType =
        typeof ct === "string" && ct.startsWith("image/")
          ? ct.split(";")[0]!
          : "image/jpeg";
      const base64 = Buffer.from(res.data).toString("base64");
      return NextResponse.json({
        imageDataUri: `data:${mimeType};base64,${base64}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Image download failed: ${msg}` },
        { status: 502 },
      );
    }
  }

  // ── Search action (default) ──
  const { query, type = "album", limit = 10 } = body;
  if (!query || typeof query !== "string") {
    return NextResponse.json(
      { error: "query is required" },
      { status: 400 },
    );
  }

  try {
    if (type === "album") {
      const data = await spotifyGet<{
        albums: { items: SpotifyAlbumItem[] };
      }>("/search", {
        q: query,
        type: "album",
        market: "KR",
        limit: String(limit),
      });

      const results = data.albums.items.map((album) => {
        const artist = album.artists.map((a) => a.name).join(", ");
        const image = album.images[0];
        return {
          spotifyId: album.id,
          name: album.name,
          artist,
          imageUrl: image?.url ?? "",
          imageWidth: image?.width ?? 0,
          imageHeight: image?.height ?? 0,
          spotifyUrl: album.external_urls.spotify,
          releaseDate: album.release_date ?? "",
          albumType: album.album_type ?? "",
          totalTracks: album.total_tracks ?? 0,
          attribution: buildAttribution(artist),
          license: { text: LICENSE_TEXT, editorialOnly: true },
          embedType: "album" as const,
        };
      });

      return NextResponse.json({ results });
    }

    if (type === "artist") {
      const data = await spotifyGet<{
        artists: { items: SpotifyArtistItem[] };
      }>("/search", {
        q: query,
        type: "artist",
        market: "KR",
        limit: String(limit),
      });

      const results = data.artists.items.map((a) => {
        const image = a.images[0];
        return {
          spotifyId: a.id,
          name: a.name,
          artist: a.name,
          imageUrl: image?.url ?? "",
          imageWidth: image?.width ?? 0,
          imageHeight: image?.height ?? 0,
          spotifyUrl: a.external_urls.spotify,
          genres: a.genres ?? [],
          popularity: a.popularity ?? 0,
          followers: a.followers?.total ?? 0,
          attribution: buildAttribution(a.name),
          license: { text: LICENSE_TEXT, editorialOnly: true },
          embedType: "artist" as const,
        };
      });

      return NextResponse.json({ results });
    }

    if (type === "track") {
      const data = await spotifyGet<{
        tracks: { items: SpotifyTrackItem[] };
      }>("/search", {
        q: query,
        type: "track",
        market: "KR",
        limit: String(limit),
      });

      const results = data.tracks.items.map((t) => {
        const artist = t.artists.map((a) => a.name).join(", ");
        const image = t.album.images[0];
        return {
          spotifyId: t.id,
          name: t.name,
          artist,
          albumName: t.album.name,
          imageUrl: image?.url ?? "",
          imageWidth: image?.width ?? 0,
          imageHeight: image?.height ?? 0,
          spotifyUrl: t.external_urls.spotify,
          durationMs: t.duration_ms,
          popularity: t.popularity,
          attribution: buildAttribution(artist),
          license: { text: LICENSE_TEXT, editorialOnly: true },
          embedType: "track" as const,
        };
      });

      return NextResponse.json({ results });
    }

    return NextResponse.json(
      { error: `Unsupported type: ${type}` },
      { status: 400 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Spotify search failed: ${msg}` },
      { status: 502 },
    );
  }
}
