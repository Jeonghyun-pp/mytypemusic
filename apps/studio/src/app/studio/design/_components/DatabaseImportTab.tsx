"use client";

import { useState, useEffect, useCallback } from "react";
import { CONTENT_CATEGORIES } from "@/lib/studio/contentCategories";
import type { SlideSpec } from "@/lib/studio/designEditor/types";

interface DesignEntry {
  id: string;
  category: string;
  title: string;
  imageDataUri: string;
  html: string;
  fontMood: string;
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "scene-news": "#3DA66E",
  "live-experience": "#EF4444",
  "artist-deep-dive": "#8B5CF6",
  "playlist": "#EC4899",
  "nerd-analysis": "#F59E0B",
  "culture-crossover": "#10B981",
  "seasonal-special": "#6366F1",
};

interface DatabaseImportTabProps {
  onCustomHtmlChange: (html: string) => void;
  onSlideChange: (patch: Partial<SlideSpec>) => void;
  onFontMoodChange: (mood: string) => void;
  onSwitchToCodeTab: () => void;
}

export default function DatabaseImportTab({
  onCustomHtmlChange,
  onSlideChange,
  onFontMoodChange,
  onSwitchToCodeTab,
}: DatabaseImportTabProps) {
  const [entries, setEntries] = useState<DesignEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/db/designs");
        if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
        const data = (await res.json()) as DesignEntry[];
        if (!cancelled) setEntries(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered =
    categoryFilter === "all"
      ? entries
      : entries.filter((e) => e.category === categoryFilter);

  const handleEntryClick = useCallback(
    (entry: DesignEntry) => {
      onCustomHtmlChange(entry.html);
      onSlideChange({ heroImageDataUri: entry.imageDataUri });
      onFontMoodChange(entry.fontMood);
      onSwitchToCodeTab();
    },
    [onCustomHtmlChange, onSlideChange, onFontMoodChange, onSwitchToCodeTab],
  );

  if (loading) {
    return (
      <div style={s.center}>
        <span style={s.muted}>불러오는 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={s.center}>
        <span style={{ fontSize: "12px", color: "var(--red)" }}>{error}</span>
      </div>
    );
  }

  return (
    <div style={s.container}>
      {/* Category filter */}
      <select
        style={s.filterSelect}
        value={categoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value)}
      >
        <option value="all">전체 카테고리</option>
        {CONTENT_CATEGORIES.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.label}
          </option>
        ))}
      </select>

      {/* Entry count */}
      <div style={s.muted}>{filtered.length}개 디자인</div>

      {/* Thumbnail grid */}
      {filtered.length === 0 ? (
        <div style={s.center}>
          <span style={s.muted}>저장된 디자인이 없습니다</span>
        </div>
      ) : (
        <div style={s.grid}>
          {filtered.map((entry) => {
            const cat = CONTENT_CATEGORIES.find((c) => c.id === entry.category);
            const chipColor = CATEGORY_COLORS[entry.category] ?? "#888";
            return (
              <button
                key={entry.id}
                type="button"
                style={s.card}
                onClick={() => handleEntryClick(entry)}
              >
                <div style={s.imgWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entry.imageDataUri} alt={entry.title} style={s.img} />
                </div>
                <div style={s.cardBody}>
                  <span style={s.title}>{entry.title}</span>
                  <div style={s.chipRow}>
                    <span style={s.chip(chipColor)}>
                      {cat?.label.replace(/^\[\d\]\s*/, "") ?? entry.category}
                    </span>
                    {entry.fontMood && (
                      <span style={s.badge}>{entry.fontMood}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────── */

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    gap: "10px",
    minHeight: 0,
    overflowY: "auto" as const,
  } as React.CSSProperties,

  center: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  } as React.CSSProperties,

  muted: {
    fontSize: "12px",
    color: "var(--text-muted)",
    flexShrink: 0,
  } as React.CSSProperties,

  filterSelect: {
    padding: "7px 10px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "12px",
    cursor: "pointer",
    flexShrink: 0,
  } as React.CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    flex: 1,
    minHeight: 0,
    alignContent: "start",
  } as React.CSSProperties,

  card: {
    display: "flex",
    flexDirection: "column" as const,
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-sm)",
    overflow: "hidden",
    background: "var(--bg-card)",
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all var(--transition)",
    boxShadow: "var(--shadow-card)",
  } as React.CSSProperties,

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

  cardBody: {
    padding: "8px 10px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  } as React.CSSProperties,

  title: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  chipRow: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  chip: (color: string) =>
    ({
      display: "inline-block",
      fontSize: "10px",
      fontWeight: 500,
      padding: "2px 8px",
      borderRadius: "6px",
      color: "#fff",
      background: color,
    }) as React.CSSProperties,

  badge: {
    display: "inline-block",
    fontSize: "10px",
    fontWeight: 500,
    padding: "2px 6px",
    borderRadius: "6px",
    color: "var(--text-muted)",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border-light)",
  } as React.CSSProperties,
};
