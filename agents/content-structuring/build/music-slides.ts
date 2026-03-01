import type { ContentSlide, SpotifyAlbumRef } from "../contracts.js";

// ============================================================================
// Music Slide Builders — create ContentSlide objects for music PostTypes
// ============================================================================

/**
 * Build an album cover slide.
 */
export function buildAlbumCoverSlide(albumRef: SpotifyAlbumRef): ContentSlide {
  return {
    kind: "album_cover",
    headline: `${albumRef.title} — ${albumRef.artist}`,
    albumRef,
    note: albumRef.releaseDate
      ? `Released: ${albumRef.releaseDate}`
      : undefined,
  };
}

/**
 * Build a tracklist slide.
 */
export function buildTracklistSlide(tracks: string[]): ContentSlide {
  return {
    kind: "tracklist",
    headline: "Tracklist",
    bullets: tracks,
  };
}

/**
 * Build a meme slide.
 */
export function buildMemeSlide(memeText: string, artist?: string): ContentSlide {
  return {
    kind: "meme",
    headline: artist ? `${artist} meme` : "Meme",
    memeText,
  };
}

/**
 * Build an album grid slide (2x2 album art).
 */
export function buildAlbumGridSlide(
  albums: SpotifyAlbumRef[],
  title?: string,
): ContentSlide {
  return {
    kind: "album_grid",
    headline: title ?? "추천 앨범",
    bullets: albums.map((a) => `${a.title} — ${a.artist}`),
  };
}

/**
 * Build a concert info slide.
 */
export function buildConcertSlide(details: {
  venue: string;
  date: string;
  lineup: string[];
}): ContentSlide {
  return {
    kind: "concert_info",
    headline: details.venue,
    concertDetails: details,
    bullets: details.lineup,
    note: details.date,
  };
}
