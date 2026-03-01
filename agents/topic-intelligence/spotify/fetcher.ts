import {
  spotifyClient,
  type SpotifyAlbum,
  type SpotifyArtist,
  type SpotifyTrack,
  type SpotifyAudioFeatures,
} from "../../shared/spotify-client.js";
import type { ParsedIntent, SpotifyDataPack } from "./types.js";

// ============================================================================
// Spotify Data Fetcher — ParsedIntent → Spotify API calls → SpotifyDataPack
// ============================================================================

export async function fetchSpotifyData(
  intent: ParsedIntent,
): Promise<SpotifyDataPack> {
  let albums: SpotifyAlbum[] | undefined;
  let artists: SpotifyArtist[] | undefined;
  let tracks: SpotifyTrack[] | undefined;
  let audioFeatures: SpotifyAudioFeatures[] | undefined;

  switch (intent.intentType) {
    case "album_detail":
      albums = await handleAlbumDetail(intent);
      break;

    case "new_releases":
      albums = await handleNewReleases(intent);
      break;

    case "top_tracks":
      ({ artists, tracks } = await handleTopTracks(intent));
      break;

    case "artist_compare":
      ({ artists, tracks } = await handleArtistCompare(intent));
      break;

    case "related_artists":
      artists = await handleRelatedArtists(intent);
      break;

    case "mood_playlist":
      tracks = await handleMoodPlaylist(intent);
      break;

    case "discography":
      ({ artists, albums } = await handleDiscography(intent));
      break;

    case "track_analysis":
      ({ tracks, audioFeatures } = await handleTrackAnalysis(intent));
      break;

    case "artist_profile":
      artists = await handleArtistProfile(intent);
      break;
  }

  return {
    intent,
    albums,
    artists,
    tracks,
    audioFeatures,
    fetchedAt: new Date().toISOString(),
  };
}

// ── Intent handlers ─────────────────────────────────────────

async function handleAlbumDetail(
  intent: ParsedIntent,
): Promise<SpotifyAlbum[]> {
  const query = intent.albumName
    ? `${intent.artistName ?? ""} ${intent.albumName}`.trim()
    : intent.artistName ?? "";

  if (!query) return [];

  const searchResults = await spotifyClient.searchAlbums(query, "KR", 5);
  if (searchResults.length === 0) return [];

  // Get full album detail for the top result
  const detail = await spotifyClient.getAlbum(searchResults[0]!.id);
  return [detail];
}

async function handleNewReleases(
  intent: ParsedIntent,
): Promise<SpotifyAlbum[]> {
  const limit = intent.limit ?? 20;

  if (intent.artistName) {
    // New releases by a specific artist
    const artistResults = await spotifyClient.searchArtists(
      intent.artistName,
      "KR",
      1,
    );
    if (artistResults.length === 0) return [];

    const albums = await spotifyClient.getArtistAlbums(
      artistResults[0]!.id,
      limit,
    );
    // Sort by release date descending
    return albums.sort((a, b) =>
      (b.release_date ?? "").localeCompare(a.release_date ?? ""),
    );
  }

  return spotifyClient.getNewReleases("KR", limit);
}

async function handleTopTracks(
  intent: ParsedIntent,
): Promise<{ artists: SpotifyArtist[]; tracks: SpotifyTrack[] }> {
  if (!intent.artistName) return { artists: [], tracks: [] };

  const artistResults = await spotifyClient.searchArtists(
    intent.artistName,
    "KR",
    1,
  );
  if (artistResults.length === 0) return { artists: [], tracks: [] };

  const artist = artistResults[0]!;
  let topTracks = await spotifyClient.getArtistTopTracks(artist.id, "KR");

  if (intent.limit) {
    topTracks = topTracks.slice(0, intent.limit);
  }

  return { artists: [artist], tracks: topTracks };
}

async function handleArtistCompare(
  intent: ParsedIntent,
): Promise<{ artists: SpotifyArtist[]; tracks: SpotifyTrack[] }> {
  const names = [intent.artistName, intent.compareWith].filter(Boolean) as string[];
  if (names.length < 2) return { artists: [], tracks: [] };

  const allArtists: SpotifyArtist[] = [];
  const allTracks: SpotifyTrack[] = [];

  for (const name of names) {
    const results = await spotifyClient.searchArtists(name, "KR", 1);
    if (results.length === 0) continue;

    const artist = results[0]!;
    allArtists.push(artist);

    const topTracks = await spotifyClient.getArtistTopTracks(artist.id, "KR");
    allTracks.push(...topTracks.slice(0, 5));
  }

  return { artists: allArtists, tracks: allTracks };
}

async function handleRelatedArtists(
  intent: ParsedIntent,
): Promise<SpotifyArtist[]> {
  if (!intent.artistName) return [];

  const results = await spotifyClient.searchArtists(
    intent.artistName,
    "KR",
    1,
  );
  if (results.length === 0) return [];

  const related = await spotifyClient.getRelatedArtists(results[0]!.id);
  const limit = intent.limit ?? 10;
  return related.slice(0, limit);
}

async function handleMoodPlaylist(
  intent: ParsedIntent,
): Promise<SpotifyTrack[]> {
  const query = intent.mood
    ? `${intent.mood} ${intent.artistName ?? ""}`.trim()
    : intent.artistName ?? "";

  if (!query) return [];

  const limit = intent.limit ?? 20;
  return spotifyClient.searchTracks(query, "KR", limit);
}

async function handleDiscography(
  intent: ParsedIntent,
): Promise<{ artists: SpotifyArtist[]; albums: SpotifyAlbum[] }> {
  if (!intent.artistName) return { artists: [], albums: [] };

  const results = await spotifyClient.searchArtists(
    intent.artistName,
    "KR",
    1,
  );
  if (results.length === 0) return { artists: [], albums: [] };

  const artist = results[0]!;
  const limit = intent.limit ?? 50;
  const albums = await spotifyClient.getArtistAlbums(artist.id, limit);

  return { artists: [artist], albums };
}

async function handleTrackAnalysis(
  intent: ParsedIntent,
): Promise<{ tracks: SpotifyTrack[]; audioFeatures: SpotifyAudioFeatures[] }> {
  const query = intent.trackName
    ? `${intent.artistName ?? ""} ${intent.trackName}`.trim()
    : intent.artistName ?? "";

  if (!query) return { tracks: [], audioFeatures: [] };

  const trackResults = await spotifyClient.searchTracks(query, "KR", 5);
  if (trackResults.length === 0) return { tracks: [], audioFeatures: [] };

  const features: SpotifyAudioFeatures[] = [];
  for (const track of trackResults.slice(0, intent.limit ?? 5)) {
    try {
      const af = await spotifyClient.getTrackAudioFeatures(track.id);
      features.push(af);
    } catch {
      // Audio features may not be available for all tracks
    }
  }

  return { tracks: trackResults.slice(0, intent.limit ?? 5), audioFeatures: features };
}

async function handleArtistProfile(
  intent: ParsedIntent,
): Promise<SpotifyArtist[]> {
  if (!intent.artistName) return [];

  const results = await spotifyClient.searchArtists(
    intent.artistName,
    "KR",
    1,
  );
  if (results.length === 0) return [];

  // Get full artist details
  const artist = await spotifyClient.getArtist(results[0]!.id);
  return [artist];
}
