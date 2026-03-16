"use client";

import { useState, useCallback, useRef } from "react";

// ── Types ────────────────────────────────────────────────

interface ImageResult {
  id: string;
  source: "unsplash" | "pexels" | "spotify" | "google";
  previewUrl: string;
  fullUrl: string;
  sourceUrl: string;
  author: string;
  attribution: string;
  width: number;
  height: number;
}

interface ImageSearchPanelProps {
  /** Called when user clicks an image to add it as a layer */
  onInsertImage: (url: string, attribution: string) => void;
  /** Called when user clicks "Use as background" */
  onSetBackground?: (url: string) => void;
}

type SourceFilter = "all" | "unsplash" | "pexels" | "spotify" | "google";

const SOURCE_LABELS: Record<SourceFilter, string> = {
  all: "전체",
  unsplash: "Unsplash",
  pexels: "Pexels",
  spotify: "앨범 아트",
  google: "웹 검색",
};

// ── Styles ───────────────────────────────────────────────

const s = {
  panel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
    height: "100%",
    padding: "12px",
  },
  searchRow: {
    display: "flex",
    gap: "6px",
  },
  input: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "13px",
    color: "var(--text)",
    outline: "none",
  },
  searchBtn: {
    padding: "8px 14px",
    borderRadius: "8px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600 as const,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  tabs: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap" as const,
  },
  tab: (active: boolean) => ({
    padding: "4px 10px",
    borderRadius: "6px",
    border: "1px solid var(--border-light)",
    background: active ? "var(--accent)" : "var(--bg-card)",
    color: active ? "#fff" : "var(--text-muted)",
    fontSize: "11px",
    cursor: "pointer",
    fontWeight: active ? 600 : 400,
    transition: "all 0.15s ease",
  }),
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "6px",
    overflowY: "auto" as const,
    flex: 1,
    minHeight: 0,
    paddingBottom: "8px",
  },
  imageCard: {
    position: "relative" as const,
    borderRadius: "6px",
    overflow: "hidden",
    cursor: "pointer",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    transition: "box-shadow 0.15s ease",
    aspectRatio: "1 / 1",
  },
  img: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    display: "block",
  },
  overlay: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: "4px 6px",
    background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
    color: "#fff",
    fontSize: "9px",
    lineHeight: "1.3",
  },
  sourceBadge: (source: string) => ({
    display: "inline-block",
    padding: "1px 4px",
    borderRadius: "3px",
    fontSize: "8px",
    fontWeight: 600 as const,
    background: source === "unsplash" ? "#111" : source === "pexels" ? "#05A081" : source === "spotify" ? "#1DB954" : "#4285F4",
    color: "#fff",
    marginRight: "4px",
  }),
  hoverActions: {
    position: "absolute" as const,
    top: "4px",
    right: "4px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "3px",
  },
  actionBtn: {
    padding: "3px 8px",
    borderRadius: "4px",
    border: "none",
    background: "rgba(0,0,0,0.65)",
    color: "#fff",
    fontSize: "10px",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    backdropFilter: "blur(4px)",
  },
  empty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    color: "var(--text-muted)",
    fontSize: "13px",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    color: "var(--text-muted)",
    fontSize: "13px",
  },
};

// ── Component ────────────────────────────────────────────

export default function ImageSearchPanel({ onInsertImage, onSetBackground }: ImageSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [results, setResults] = useState<ImageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q: query, source, page: "1" });
      const res = await fetch(`/api/design/images?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Search failed");
      const data = (await res.json()) as { results: ImageResult[] };
      setResults(data.results);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, source]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleSearch();
      }
      // Prevent canvas shortcuts from firing while typing
      e.stopPropagation();
    },
    [handleSearch],
  );

  return (
    <div style={s.panel}>
      {/* Search bar */}
      <div style={s.searchRow}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="이미지 검색... (예: sunset, album cover)"
          style={s.input}
        />
        <button
          type="button"
          style={{ ...s.searchBtn, opacity: loading ? 0.5 : 1 }}
          onClick={() => void handleSearch()}
          disabled={loading}
        >
          검색
        </button>
      </div>

      {/* Source filter tabs */}
      <div style={s.tabs}>
        {(Object.keys(SOURCE_LABELS) as SourceFilter[]).map((key) => (
          <button
            key={key}
            type="button"
            style={s.tab(source === key)}
            onClick={() => setSource(key)}
          >
            {SOURCE_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div style={s.loading}>검색 중...</div>
      ) : results.length === 0 ? (
        <div style={s.empty}>
          {searched ? "검색 결과가 없습니다" : "검색어를 입력하세요"}
        </div>
      ) : (
        <div style={s.grid}>
          {results.map((img) => (
            <div
              key={img.id}
              style={s.imageCard}
              onMouseEnter={() => setHoveredId(img.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onInsertImage(img.fullUrl, img.attribution)}
            >
              <img
                src={img.previewUrl}
                alt={img.attribution}
                style={s.img}
                loading="lazy"
                draggable={false}
              />

              {/* Hover actions */}
              {hoveredId === img.id && (
                <div style={s.hoverActions}>
                  <button
                    type="button"
                    style={s.actionBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onInsertImage(img.fullUrl, img.attribution);
                    }}
                  >
                    + 레이어
                  </button>
                  {onSetBackground && (
                    <button
                      type="button"
                      style={s.actionBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetBackground(img.fullUrl);
                      }}
                    >
                      배경으로
                    </button>
                  )}
                </div>
              )}

              {/* Attribution overlay */}
              <div style={s.overlay}>
                <span style={s.sourceBadge(img.source)}>
                  {img.source === "spotify" ? "Spotify" : img.source === "unsplash" ? "U" : img.source === "pexels" ? "P" : "G"}
                </span>
                {img.author}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
