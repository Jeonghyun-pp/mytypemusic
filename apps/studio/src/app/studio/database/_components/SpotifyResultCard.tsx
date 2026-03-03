"use client";

export interface SpotifyResult {
  spotifyId: string;
  name: string;
  artist: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  spotifyUrl: string;
  attribution: string;
  license: { text: string; editorialOnly: boolean };
  embedType: "album" | "artist" | "track";
  // album-specific
  releaseDate?: string;
  albumType?: string;
  totalTracks?: number;
  // artist-specific
  genres?: string[];
  popularity?: number;
  followers?: number;
  // track-specific
  albumName?: string;
  durationMs?: number;
}

interface SpotifyResultCardProps {
  result: SpotifyResult;
  isSelected: boolean;
  onClick: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  album: "앨범",
  artist: "아티스트",
  track: "트랙",
};

export default function SpotifyResultCard({
  result,
  isSelected,
  onClick,
}: SpotifyResultCardProps) {
  return (
    <div
      style={{
        ...s.card,
        ...(isSelected ? s.cardSelected : {}),
      }}
      onClick={onClick}
    >
      {result.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={result.imageUrl} alt={result.name} style={s.img} />
      ) : (
        <div style={s.noImage}>No Image</div>
      )}
      <div style={s.badges}>
        <span style={s.spotifyBadge}>S</span>
        <span style={s.typeBadge}>
          {TYPE_LABELS[result.embedType] ?? result.embedType}
        </span>
      </div>
      <div style={s.info}>
        <span style={s.name}>{result.name}</span>
        {result.embedType !== "artist" && (
          <span style={s.artist}>{result.artist}</span>
        )}
      </div>
    </div>
  );
}

const s = {
  card: {
    position: "relative" as const,
    borderRadius: "var(--radius-sm)",
    overflow: "hidden",
    cursor: "pointer",
    border: "2px solid transparent",
    transition: "all var(--transition)",
    background: "var(--bg-card)",
    boxShadow: "var(--shadow-card)",
  } as React.CSSProperties,

  cardSelected: {
    border: "2px solid #1DB954",
    boxShadow: "var(--shadow-hover)",
  } as React.CSSProperties,

  img: {
    width: "100%",
    aspectRatio: "1/1",
    objectFit: "cover" as const,
    display: "block",
  } as React.CSSProperties,

  noImage: {
    width: "100%",
    aspectRatio: "1/1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-input)",
    color: "var(--text-muted)",
    fontSize: "12px",
  } as React.CSSProperties,

  badges: {
    position: "absolute" as const,
    top: "6px",
    left: "6px",
    display: "flex",
    gap: "4px",
  } as React.CSSProperties,

  spotifyBadge: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#fff",
    width: "18px",
    height: "18px",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#1DB954",
  } as React.CSSProperties,

  typeBadge: {
    fontSize: "9px",
    fontWeight: 600,
    color: "#fff",
    background: "rgba(0,0,0,0.55)",
    padding: "2px 6px",
    borderRadius: "4px",
    backdropFilter: "blur(4px)",
  } as React.CSSProperties,

  info: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: "20px 8px 6px",
    background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
    display: "flex",
    flexDirection: "column" as const,
    gap: "1px",
  } as React.CSSProperties,

  name: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#fff",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  artist: {
    fontSize: "9px",
    color: "rgba(255,255,255,0.7)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
};
