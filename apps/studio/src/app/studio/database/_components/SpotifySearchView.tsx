"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import SpotifyResultCard from "./SpotifyResultCard";
import type { SpotifyResult } from "./SpotifyResultCard";
import {
  getSpotifyEmbedUrl,
  getSpotifyEmbedHtml,
  getSpotifyOpenUrl,
  type SpotifyEmbedType,
} from "@/lib/studio/spotifyEmbed";

type SearchType = "album" | "artist" | "track";

const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
  album: "앨범",
  artist: "아티스트",
  track: "트랙",
};

export default function SpotifySearchView() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("album");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SpotifyResult[]>([]);
  const [selected, setSelected] = useState<SpotifyResult | null>(null);
  const [error, setError] = useState("");

  // Embed state
  const [embedType, setEmbedType] = useState<SpotifyEmbedType>("album");
  const [copied, setCopied] = useState<string | null>(null); // "embed" | "attribution" | null

  // Download state
  const [downloading, setDownloading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setSelected(null);

    try {
      const res = await fetch("/api/design/spotify-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), type: searchType }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(errData?.error ?? `검색 실패 (${String(res.status)})`);
        return;
      }

      const data = (await res.json()) as { results: SpotifyResult[] };
      setResults(data.results);
    } catch {
      setError("검색 중 오류가 발생했습니다");
    } finally {
      setSearching(false);
    }
  }, [query, searchType]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") void handleSearch();
    },
    [handleSearch],
  );

  const handleSelect = useCallback((result: SpotifyResult) => {
    setSelected(result);
    setEmbedType(result.embedType);
    setCopied(null);
  }, []);

  // Copy embed code
  const handleCopyEmbed = useCallback(async () => {
    if (!selected) return;
    const html = getSpotifyEmbedHtml(embedType, selected.spotifyId);
    try {
      await navigator.clipboard.writeText(html);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = html;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied("embed");
    setTimeout(() => setCopied(null), 2000);
  }, [selected, embedType]);

  // Copy attribution
  const handleCopyAttribution = useCallback(async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.attribution);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = selected.attribution;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied("attribution");
    setTimeout(() => setCopied(null), 2000);
  }, [selected]);

  // Download image and apply as heroImageDataUri
  const handleUseInDesign = useCallback(async () => {
    if (!selected || !selected.imageUrl) return;
    setDownloading(true);

    try {
      const res = await fetch("/api/design/spotify-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "download",
          imageUrl: selected.imageUrl,
        }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(errData?.error ?? "이미지 다운로드 실패");
        return;
      }

      const data = (await res.json()) as { imageDataUri: string };

      // Save to localStorage and navigate to design editor
      const loadData = {
        heroImageDataUri: data.imageDataUri,
        footerText: selected.attribution,
        source: "spotify",
        spotifyId: selected.spotifyId,
        spotifyUrl: selected.spotifyUrl,
      };
      localStorage.setItem("studio-spotify-load", JSON.stringify(loadData));
      router.push("/studio/design");
    } catch {
      setError("이미지 저장 중 오류가 발생했습니다");
    } finally {
      setDownloading(false);
    }
  }, [selected]);

  // Format duration
  function formatDuration(ms: number): string {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${String(min)}:${String(sec).padStart(2, "0")}`;
  }

  return (
    <div style={s.wrapper}>
      <div style={s.body}>
        {/* ── Left: Search + Results ── */}
        <div style={s.mainSection}>
          {/* Search bar */}
          <div style={s.searchRow}>
            <select
              style={s.typeSelect}
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as SearchType)}
            >
              {(Object.entries(SEARCH_TYPE_LABELS) as [SearchType, string][]).map(
                ([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ),
              )}
            </select>
            <input
              type="text"
              style={s.searchInput}
              placeholder="아티스트, 앨범, 트랙 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              style={{
                ...s.searchBtn,
                opacity: !query.trim() || searching ? 0.4 : 1,
              }}
              disabled={!query.trim() || searching}
              onClick={() => void handleSearch()}
            >
              {searching ? "검색 중..." : "검색"}
            </button>
          </div>

          {error && <p style={s.error}>{error}</p>}

          {/* Results grid */}
          {results.length > 0 && (
            <div style={s.resultGrid}>
              {results.map((r) => (
                <SpotifyResultCard
                  key={`${r.embedType}-${r.spotifyId}`}
                  result={r}
                  isSelected={selected?.spotifyId === r.spotifyId}
                  onClick={() => handleSelect(r)}
                />
              ))}
            </div>
          )}

          {/* Loading indicator */}
          {searching && (
            <div style={s.emptyMain}>
              <p style={s.emptyText}>Spotify에서 검색 중...</p>
            </div>
          )}

          {/* No results */}
          {results.length === 0 && !searching && query.trim() && !error && (
            <div style={s.emptyMain}>
              <p style={s.emptyText}>
                검색 결과가 없습니다.{"\n"}다른 키워드로 시도해보세요.
              </p>
            </div>
          )}

          {/* Initial state */}
          {results.length === 0 && !searching && !query.trim() && !error && (
            <div style={s.emptyMain}>
              <p style={s.emptyText}>
                Spotify에서 앨범, 아티스트, 트랙을 검색하세요
              </p>
            </div>
          )}
        </div>

        {/* ── Right: Detail panel ── */}
        <div style={s.sidePanel}>
          {selected ? (
            <div style={s.detailPanel}>
              <div style={s.detailHeader}>
                <h3 style={s.detailTitle}>상세 정보</h3>
                <button
                  type="button"
                  style={s.closeBtn}
                  onClick={() => setSelected(null)}
                >
                  ✕
                </button>
              </div>

              {/* Image */}
              {selected.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.imageUrl}
                  alt={selected.name}
                  style={s.detailImg}
                />
              )}

              {/* Metadata */}
              <div style={s.detailMeta}>
                <div style={s.detailRow}>
                  <span style={s.detailLabel}>이름</span>
                  <span style={s.detailValue}>{selected.name}</span>
                </div>
                {selected.embedType !== "artist" && (
                  <div style={s.detailRow}>
                    <span style={s.detailLabel}>아티스트</span>
                    <span style={s.detailValue}>{selected.artist}</span>
                  </div>
                )}
                {selected.releaseDate && (
                  <div style={s.detailRow}>
                    <span style={s.detailLabel}>발매일</span>
                    <span style={s.detailValue}>{selected.releaseDate}</span>
                  </div>
                )}
                {selected.albumName && (
                  <div style={s.detailRow}>
                    <span style={s.detailLabel}>앨범</span>
                    <span style={s.detailValue}>{selected.albumName}</span>
                  </div>
                )}
                {selected.durationMs && (
                  <div style={s.detailRow}>
                    <span style={s.detailLabel}>길이</span>
                    <span style={s.detailValue}>
                      {formatDuration(selected.durationMs)}
                    </span>
                  </div>
                )}
                {selected.genres && selected.genres.length > 0 && (
                  <div style={s.detailRow}>
                    <span style={s.detailLabel}>장르</span>
                    <span style={s.detailValue}>
                      {selected.genres.slice(0, 3).join(", ")}
                    </span>
                  </div>
                )}
                {selected.popularity != null && selected.popularity > 0 && (
                  <div style={s.detailRow}>
                    <span style={s.detailLabel}>인기도</span>
                    <span style={s.detailValue}>{selected.popularity}/100</span>
                  </div>
                )}
              </div>

              {/* License badge */}
              <div style={s.licenseBadge}>
                <span style={s.licenseIcon}>i</span>
                <span style={s.licenseText}>
                  Editorial Use — 한국 저작권법 제28조
                </span>
              </div>

              {/* Attribution */}
              <div style={s.attributionBox}>
                <span style={s.attributionLabel}>저작권 표기</span>
                <span style={s.attributionText}>{selected.attribution}</span>
              </div>

              {/* Spotify Embed Player */}
              <div style={s.embedSection}>
                <div style={s.embedHeader}>
                  <span style={s.embedTitle}>미리듣기</span>
                  <select
                    style={s.embedTypeSelect}
                    value={embedType}
                    onChange={(e) =>
                      setEmbedType(e.target.value as SpotifyEmbedType)
                    }
                  >
                    <option value="album">앨범</option>
                    <option value="track">트랙</option>
                    <option value="playlist">플레이리스트</option>
                    <option value="artist">아티스트</option>
                  </select>
                </div>
                <iframe
                  style={s.embedIframe}
                  src={getSpotifyEmbedUrl(embedType, selected.spotifyId)}
                  width="100%"
                  height={embedType === "track" ? 152 : 352}
                  frameBorder={0}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              </div>

              {/* Action buttons */}
              <div style={s.actionButtons}>
                <button
                  type="button"
                  style={{
                    ...s.primaryBtn,
                    opacity: downloading ? 0.5 : 1,
                  }}
                  disabled={downloading}
                  onClick={() => void handleUseInDesign()}
                >
                  {downloading ? "다운로드 중..." : "디자인에 사용"}
                </button>
                <button
                  type="button"
                  style={s.secondaryBtn}
                  onClick={() => void handleCopyEmbed()}
                >
                  {copied === "embed" ? "복사됨!" : "Embed 코드 복사"}
                </button>
                <button
                  type="button"
                  style={s.secondaryBtn}
                  onClick={() => void handleCopyAttribution()}
                >
                  {copied === "attribution" ? "복사됨!" : "저작권 표기 복사"}
                </button>
                <a
                  href={getSpotifyOpenUrl(selected.embedType, selected.spotifyId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={s.spotifyLink}
                >
                  Spotify에서 열기
                </a>
              </div>
            </div>
          ) : (
            <div style={s.placeholder}>
              <p style={s.placeholderText}>
                {results.length > 0
                  ? "결과에서 항목을 선택하세요"
                  : "Spotify에서 음악을 검색하고\n앨범 아트를 디자인에 활용하세요"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────

const s = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
  } as React.CSSProperties,

  body: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
  } as React.CSSProperties,

  mainSection: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: "14px",
  } as React.CSSProperties,

  searchRow: {
    display: "flex",
    gap: "8px",
  } as React.CSSProperties,

  typeSelect: {
    padding: "8px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "12px",
    color: "var(--text)",
    cursor: "pointer",
    flexShrink: 0,
  } as React.CSSProperties,

  searchInput: {
    flex: 1,
    padding: "8px 14px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "13px",
    color: "var(--text)",
    outline: "none",
    transition: "border-color var(--transition)",
  } as React.CSSProperties,

  searchBtn: {
    padding: "8px 20px",
    borderRadius: "10px",
    border: "none",
    background: "#1DB954",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
    transition: "all var(--transition)",
  } as React.CSSProperties,

  error: {
    fontSize: "12px",
    color: "var(--red)",
    margin: 0,
  } as React.CSSProperties,

  resultGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: "12px",
  } as React.CSSProperties,

  emptyMain: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "200px",
    borderRadius: "var(--radius-xl)",
    border: "2px dashed var(--border-light)",
  } as React.CSSProperties,

  emptyText: {
    fontSize: "13px",
    color: "var(--text-muted)",
    textAlign: "center" as const,
    lineHeight: 1.6,
  } as React.CSSProperties,

  sidePanel: {
    width: "360px",
    flexShrink: 0,
  } as React.CSSProperties,

  detailPanel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
    padding: "20px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    boxShadow: "var(--shadow-card)",
  } as React.CSSProperties,

  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  detailTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
  } as React.CSSProperties,

  closeBtn: {
    width: "30px",
    height: "30px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,

  detailImg: {
    width: "100%",
    borderRadius: "var(--radius-sm)",
    aspectRatio: "1/1",
    objectFit: "cover" as const,
  } as React.CSSProperties,

  detailMeta: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  } as React.CSSProperties,

  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  detailLabel: {
    fontSize: "12px",
    color: "var(--text-muted)",
    fontWeight: 500,
    flexShrink: 0,
  } as React.CSSProperties,

  detailValue: {
    fontSize: "12px",
    color: "var(--text)",
    fontWeight: 600,
    textAlign: "right" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    marginLeft: "12px",
  } as React.CSSProperties,

  licenseBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    background: "rgba(29,185,84,0.1)",
    borderRadius: "8px",
    border: "1px solid rgba(29,185,84,0.2)",
  } as React.CSSProperties,

  licenseIcon: {
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: "#1DB954",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as React.CSSProperties,

  licenseText: {
    fontSize: "11px",
    color: "#1DB954",
    fontWeight: 600,
  } as React.CSSProperties,

  attributionBox: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
    padding: "10px 12px",
    background: "var(--bg-input)",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
  } as React.CSSProperties,

  attributionLabel: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  } as React.CSSProperties,

  attributionText: {
    fontSize: "12px",
    color: "var(--text)",
    fontWeight: 500,
  } as React.CSSProperties,

  embedSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  } as React.CSSProperties,

  embedHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  embedTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text)",
  } as React.CSSProperties,

  embedTypeSelect: {
    padding: "4px 10px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "11px",
    color: "var(--text)",
    cursor: "pointer",
  } as React.CSSProperties,

  embedIframe: {
    borderRadius: "12px",
    border: "none",
  } as React.CSSProperties,

  actionButtons: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  } as React.CSSProperties,

  primaryBtn: {
    padding: "10px 0",
    borderRadius: "10px",
    border: "none",
    background: "#1DB954",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  secondaryBtn: {
    padding: "9px 0",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  spotifyLink: {
    display: "block",
    textAlign: "center" as const,
    padding: "9px 0",
    borderRadius: "10px",
    border: "1px solid #1DB954",
    background: "transparent",
    color: "#1DB954",
    fontSize: "12px",
    fontWeight: 600,
    textDecoration: "none",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  placeholder: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 20px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    boxShadow: "var(--shadow-card)",
  } as React.CSSProperties,

  placeholderText: {
    fontSize: "13px",
    color: "var(--text-muted)",
    textAlign: "center" as const,
    lineHeight: 1.6,
    whiteSpace: "pre-line" as const,
  } as React.CSSProperties,
};
