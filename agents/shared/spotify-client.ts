import axios from "axios";

// ============================================================================
// Shared Spotify Client — Client Credentials OAuth2 flow
//
// Single source of truth for Spotify API authentication and high-level methods.
// Used by Agent 1 (image provider) and Agent 5 (topic intelligence).
//
// Env vars: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
// ============================================================================

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

// ── Spotify API response types ──────────────────────────────

export interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

export interface SpotifyArtistRef {
  id: string;
  name: string;
  external_urls: { spotify: string };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: SpotifyArtistRef[];
  images: SpotifyImage[];
  release_date?: string;
  total_tracks?: number;
  album_type?: string;
  external_urls: { spotify: string };
}

export interface SpotifyAlbumDetail extends SpotifyAlbum {
  tracks: {
    items: Array<{
      id: string;
      name: string;
      track_number: number;
      duration_ms: number;
      artists: SpotifyArtistRef[];
      external_urls: { spotify: string };
    }>;
  };
  label?: string;
  popularity?: number;
  copyrights?: Array<{ text: string; type: string }>;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  images: SpotifyImage[];
  popularity: number;
  followers: { total: number };
  external_urls: { spotify: string };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtistRef[];
  album: SpotifyAlbum;
  duration_ms: number;
  popularity: number;
  track_number: number;
  preview_url?: string;
  external_urls: { spotify: string };
}

export interface SpotifyAudioFeatures {
  id: string;
  danceability: number;
  energy: number;
  valence: number;
  tempo: number;
  acousticness: number;
  instrumentalness: number;
  key: number;
  mode: number;
  time_signature: number;
}

// ── Client ──────────────────────────────────────────────────

export class SpotifyClient {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 60_000) {
      return this.cachedToken.token;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set",
      );
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

    this.cachedToken = {
      token: res.data.access_token,
      expiresAt: Date.now() + res.data.expires_in * 1000,
    };

    return this.cachedToken.token;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const token = await this.getAccessToken();

    const res = await axios.get<T>(`${API_BASE}${path}`, {
      params,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10_000,
    });

    return res.data;
  }

  // ── Search methods ──────────────────────────────────────

  async searchAlbums(
    query: string,
    market = "KR",
    limit = 10,
  ): Promise<SpotifyAlbum[]> {
    const data = await this.get<{ albums: { items: SpotifyAlbum[] } }>(
      "/search",
      { q: query, type: "album", market, limit: String(limit) },
    );
    return data.albums.items;
  }

  async searchArtists(
    query: string,
    market = "KR",
    limit = 10,
  ): Promise<SpotifyArtist[]> {
    const data = await this.get<{ artists: { items: SpotifyArtist[] } }>(
      "/search",
      { q: query, type: "artist", market, limit: String(limit) },
    );
    return data.artists.items;
  }

  async searchTracks(
    query: string,
    market = "KR",
    limit = 10,
  ): Promise<SpotifyTrack[]> {
    const data = await this.get<{ tracks: { items: SpotifyTrack[] } }>(
      "/search",
      { q: query, type: "track", market, limit: String(limit) },
    );
    return data.tracks.items;
  }

  // ── Detail methods ──────────────────────────────────────

  async getAlbum(albumId: string): Promise<SpotifyAlbumDetail> {
    return this.get<SpotifyAlbumDetail>(`/albums/${albumId}`);
  }

  async getArtist(artistId: string): Promise<SpotifyArtist> {
    return this.get<SpotifyArtist>(`/artists/${artistId}`);
  }

  async getArtistTopTracks(
    artistId: string,
    market = "KR",
  ): Promise<SpotifyTrack[]> {
    const data = await this.get<{ tracks: SpotifyTrack[] }>(
      `/artists/${artistId}/top-tracks`,
      { market },
    );
    return data.tracks;
  }

  async getArtistAlbums(
    artistId: string,
    limit = 20,
  ): Promise<SpotifyAlbum[]> {
    const data = await this.get<{ items: SpotifyAlbum[] }>(
      `/artists/${artistId}/albums`,
      { limit: String(limit), include_groups: "album,single" },
    );
    return data.items;
  }

  async getNewReleases(market = "KR", limit = 20): Promise<SpotifyAlbum[]> {
    const data = await this.get<{ albums: { items: SpotifyAlbum[] } }>(
      "/browse/new-releases",
      { country: market, limit: String(limit) },
    );
    return data.albums.items;
  }

  async getRelatedArtists(artistId: string): Promise<SpotifyArtist[]> {
    const data = await this.get<{ artists: SpotifyArtist[] }>(
      `/artists/${artistId}/related-artists`,
    );
    return data.artists;
  }

  async getTrackAudioFeatures(
    trackId: string,
  ): Promise<SpotifyAudioFeatures> {
    return this.get<SpotifyAudioFeatures>(`/audio-features/${trackId}`);
  }
}

// Singleton instance
export const spotifyClient = new SpotifyClient();
