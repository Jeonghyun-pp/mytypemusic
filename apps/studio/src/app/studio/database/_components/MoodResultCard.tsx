"use client";

interface StockResult {
  provider: "unsplash" | "pexels";
  id: string;
  previewUrl: string;
  fullUrl: string;
  sourceUrl: string;
  author: string;
  width: number;
  height: number;
  matchStrategy: "scene" | "mood" | "aesthetic";
}

interface MoodResultCardProps {
  result: StockResult;
  isSelected: boolean;
  onClick: () => void;
}

const STRATEGY_LABELS: Record<string, string> = {
  scene: "장면",
  mood: "무드",
  aesthetic: "미학",
};

export default function MoodResultCard({
  result,
  isSelected,
  onClick,
}: MoodResultCardProps) {
  return (
    <div
      style={{
        ...s.card,
        ...(isSelected ? s.cardSelected : {}),
      }}
      onClick={onClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={result.previewUrl} alt={result.author} style={s.img} />
      <div style={s.badges}>
        <span
          style={{
            ...s.providerBadge,
            background:
              result.provider === "unsplash"
                ? "rgba(0,0,0,0.7)"
                : "rgba(5,178,120,0.85)",
          }}
        >
          {result.provider === "unsplash" ? "U" : "P"}
        </span>
        <span style={s.strategyBadge}>
          {STRATEGY_LABELS[result.matchStrategy] ?? result.matchStrategy}
        </span>
      </div>
      <div style={s.credit}>
        <span style={s.creditText}>{result.author}</span>
      </div>
    </div>
  );
}

export type { StockResult };

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
    border: "2px solid var(--accent)",
    boxShadow: "var(--shadow-hover)",
  } as React.CSSProperties,

  img: {
    width: "100%",
    aspectRatio: "4/3",
    objectFit: "cover" as const,
    display: "block",
  } as React.CSSProperties,

  badges: {
    position: "absolute" as const,
    top: "6px",
    left: "6px",
    display: "flex",
    gap: "4px",
  } as React.CSSProperties,

  providerBadge: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#fff",
    width: "18px",
    height: "18px",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,

  strategyBadge: {
    fontSize: "9px",
    fontWeight: 600,
    color: "#fff",
    background: "rgba(0,0,0,0.55)",
    padding: "2px 6px",
    borderRadius: "4px",
    backdropFilter: "blur(4px)",
  } as React.CSSProperties,

  credit: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: "16px 8px 6px",
    background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
  } as React.CSSProperties,

  creditText: {
    fontSize: "10px",
    color: "rgba(255,255,255,0.85)",
    fontWeight: 500,
  } as React.CSSProperties,
};
