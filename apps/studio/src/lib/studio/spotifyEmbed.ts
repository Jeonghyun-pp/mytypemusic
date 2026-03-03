// ============================================================================
// Spotify Embed Utilities
//
// Pure functions for generating Spotify embed URLs and iframe HTML.
// Supports: album, track, playlist, artist
// ============================================================================

export type SpotifyEmbedType = "album" | "track" | "playlist" | "artist";

export interface SpotifyEmbedOptions {
  theme?: "dark" | "light"; // default: dark (0)
  compact?: boolean; // only for track, default: false
  width?: string; // default: "100%"
  height?: number; // auto-calculated if not provided
}

const DEFAULT_HEIGHTS: Record<SpotifyEmbedType, number> = {
  album: 352,
  track: 152,
  playlist: 352,
  artist: 352,
};

const COMPACT_TRACK_HEIGHT = 80;

/** Build the Spotify embed URL for use in an iframe src */
export function getSpotifyEmbedUrl(
  type: SpotifyEmbedType,
  spotifyId: string,
  theme: "dark" | "light" = "dark",
): string {
  const themeParam = theme === "dark" ? "0" : "1";
  return `https://open.spotify.com/embed/${type}/${spotifyId}?utm_source=generator&theme=${themeParam}`;
}

/** Build a complete iframe HTML string */
export function getSpotifyEmbedHtml(
  type: SpotifyEmbedType,
  spotifyId: string,
  opts: SpotifyEmbedOptions = {},
): string {
  const { theme = "dark", compact = false, width = "100%" } = opts;
  let height = opts.height ?? DEFAULT_HEIGHTS[type];
  if (type === "track" && compact) height = COMPACT_TRACK_HEIGHT;

  const src = getSpotifyEmbedUrl(type, spotifyId, theme);

  return [
    `<iframe`,
    `  style="border-radius:12px"`,
    `  src="${src}"`,
    `  width="${width}"`,
    `  height="${String(height)}"`,
    `  frameBorder="0"`,
    `  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"`,
    `  loading="lazy"`,
    `></iframe>`,
  ].join("\n");
}

/** Build the open.spotify.com link for external navigation */
export function getSpotifyOpenUrl(
  type: SpotifyEmbedType,
  spotifyId: string,
): string {
  return `https://open.spotify.com/${type}/${spotifyId}`;
}
