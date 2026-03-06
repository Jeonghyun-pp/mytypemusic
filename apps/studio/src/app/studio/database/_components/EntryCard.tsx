"use client";

import { CONTENT_CATEGORIES } from "@/lib/studio/contentCategories";
import type { DesignEntry } from "./databaseStore";

const CATEGORY_COLORS: Record<string, string> = {
  "scene-news": "#3DA66E",
  "live-experience": "#EF4444",
  "artist-deep-dive": "#8B5CF6",
  "playlist": "#EC4899",
  "nerd-analysis": "#F59E0B",
  "culture-crossover": "#10B981",
  "seasonal-special": "#6366F1",
};

interface EntryCardProps {
  entry: DesignEntry;
  isSelected: boolean;
  onClick: () => void;
}

export default function EntryCard({ entry, isSelected, onClick }: EntryCardProps) {
  const cat = CONTENT_CATEGORIES.find((c) => c.id === entry.category);
  const chipColor = CATEGORY_COLORS[entry.category] ?? "#888";

  return (
    <button type="button" onClick={onClick} style={s.card(isSelected)}>
      <div style={s.imgWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.imageDataUri} alt={entry.title} style={s.img} />
      </div>
      <div style={s.body}>
        <span style={s.title}>{entry.title}</span>
        <span style={s.chip(chipColor)}>{cat?.label.replace(/^\[\d\]\s*/, "") ?? entry.category}</span>
      </div>
    </button>
  );
}

export { CATEGORY_COLORS };

const s = {
  card: (selected: boolean) =>
    ({
      display: "flex",
      flexDirection: "column" as const,
      border: selected ? "2px solid var(--accent)" : "1px solid var(--border-light)",
      borderRadius: "var(--radius-sm)",
      overflow: "hidden",
      background: "var(--bg-card)",
      cursor: "pointer",
      textAlign: "left" as const,
      transition: "all var(--transition)",
      boxShadow: selected ? "0 0 0 3px rgba(91,124,247,0.15)" : "var(--shadow-card)",
    }) as React.CSSProperties,

  imgWrap: {
    width: "100%",
    aspectRatio: "4 / 5",
    overflow: "hidden",
    background: "var(--bg-secondary)",
  } as React.CSSProperties,

  img: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    display: "block",
  } as React.CSSProperties,

  body: {
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "5px",
  } as React.CSSProperties,

  title: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  chip: (color: string) =>
    ({
      display: "inline-block",
      alignSelf: "flex-start",
      fontSize: "10px",
      fontWeight: 500,
      padding: "2px 8px",
      borderRadius: "6px",
      color: "#fff",
      background: color,
    }) as React.CSSProperties,
};
