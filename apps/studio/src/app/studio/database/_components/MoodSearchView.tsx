"use client";

import { useState, useRef, useCallback } from "react";
import MoodResultCard from "./MoodResultCard";
import type { StockResult } from "./MoodResultCard";

interface MoodAnalysis {
  scene: { subject: string; environment: string; objects: string[] };
  mood: { primary: string; secondary: string; emotionalTone: string };
  visualTreatment: {
    lighting: string;
    colorTemperature: string;
    technique: string[];
    saturation: string;
  };
  colorAnalysis: {
    dominantColors: string[];
    colorFamily: string;
    unsplashColor: string;
    pexelsColor: string;
  };
  composition: { framing: string; perspective: string; focusArea: string };
  fontMoodMatch: string;
  searchStrategies: {
    sceneMatch: string[];
    moodMatch: string[];
    aestheticMatch: string[];
  };
}

interface InternalResult {
  id: string;
  title: string;
  imageDataUri: string;
  fontMood: string;
  category: string;
}

type ResultTab = "stock" | "internal";

export default function MoodSearchView() {
  const [imageDataUri, setImageDataUri] = useState("");
  const [searching, setSearching] = useState(false);
  const [analysis, setAnalysis] = useState<MoodAnalysis | null>(null);
  const [stockResults, setStockResults] = useState<StockResult[]>([]);
  const [internalResults, setInternalResults] = useState<InternalResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<StockResult | null>(
    null,
  );
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [resultTab, setResultTab] = useState<ResultTab>("stock");
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUri(reader.result as string);
      setAnalysis(null);
      setStockResults([]);
      setInternalResults([]);
      setSelectedResult(null);
      setError("");
    };
    reader.readAsDataURL(file);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) readFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  async function handleSearch() {
    if (!imageDataUri) return;
    setSearching(true);
    setError("");
    setSelectedResult(null);

    try {
      const res = await fetch("/api/design/mood-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUri }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(errData?.error ?? `분석 실패 (${String(res.status)})`);
        return;
      }

      const data = (await res.json()) as {
        analysis: MoodAnalysis;
        stockResults: StockResult[];
        internalResults: InternalResult[];
      };

      setAnalysis(data.analysis);
      setStockResults(data.stockResults);
      setInternalResults(data.internalResults);
    } catch {
      setError("검색 중 오류가 발생했습니다");
    } finally {
      setSearching(false);
    }
  }

  const moodTags = analysis
    ? [
        analysis.mood.primary,
        analysis.mood.secondary,
        ...analysis.visualTreatment.technique,
        analysis.composition.framing,
      ]
    : [];

  return (
    <div style={s.wrapper}>
      <div style={s.body}>
        {/* ── Left: Upload + Results ── */}
        <div style={s.mainSection}>
          {/* Drop zone */}
          <div
            style={s.dropZone(dragOver, !!imageDataUri)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            {imageDataUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageDataUri} alt="reference" style={s.previewImg} />
            ) : (
              <span style={s.dropText}>
                참고 이미지를 드래그하거나 클릭하여 업로드
              </span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>

          {/* Search button */}
          <button
            type="button"
            style={{
              ...s.searchBtn,
              opacity: !imageDataUri || searching ? 0.4 : 1,
            }}
            disabled={!imageDataUri || searching}
            onClick={() => void handleSearch()}
          >
            {searching ? "분석 중..." : "무드 검색"}
          </button>

          {error && <p style={s.error}>{error}</p>}

          {/* Analysis summary */}
          {analysis && (
            <div style={s.analysisSummary}>
              {/* Mood tags */}
              <div style={s.tagsRow}>
                {moodTags.map((tag) => (
                  <span key={tag} style={s.moodTag}>
                    {tag}
                  </span>
                ))}
              </div>

              {/* Color palette */}
              <div style={s.paletteRow}>
                {analysis.colorAnalysis.dominantColors.map((color) => (
                  <div
                    key={color}
                    style={{ ...s.colorSwatch, background: color }}
                    title={color}
                  />
                ))}
                <span style={s.colorFamily}>
                  {analysis.colorAnalysis.colorFamily}
                </span>
              </div>

              {/* Atmosphere */}
              <p style={s.atmosphere}>{analysis.mood.emotionalTone}</p>
            </div>
          )}

          {/* Result tabs */}
          {(stockResults.length > 0 || internalResults.length > 0) && (
            <>
              <div style={s.resultTabRow}>
                <button
                  type="button"
                  style={
                    resultTab === "stock"
                      ? s.resultTabActive
                      : s.resultTabInactive
                  }
                  onClick={() => setResultTab("stock")}
                >
                  스톡 이미지 ({stockResults.length})
                </button>
                <button
                  type="button"
                  style={
                    resultTab === "internal"
                      ? s.resultTabActive
                      : s.resultTabInactive
                  }
                  onClick={() => setResultTab("internal")}
                >
                  내부 레퍼런스 ({internalResults.length})
                </button>
              </div>

              {/* Stock results grid */}
              {resultTab === "stock" && (
                <div style={s.resultGrid}>
                  {stockResults.map((r) => (
                    <MoodResultCard
                      key={`${r.provider}-${r.id}`}
                      result={r}
                      isSelected={selectedResult?.id === r.id}
                      onClick={() => setSelectedResult(r)}
                    />
                  ))}
                  {stockResults.length === 0 && (
                    <p style={s.noResults}>
                      스톡 검색 결과가 없습니다
                    </p>
                  )}
                </div>
              )}

              {/* Internal results grid */}
              {resultTab === "internal" && (
                <div style={s.resultGrid}>
                  {internalResults.map((r) => (
                    <div
                      key={r.id}
                      style={s.internalCard}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.imageDataUri}
                        alt={r.title}
                        style={s.internalImg}
                      />
                      <div style={s.internalMeta}>
                        <span style={s.internalTitle}>{r.title}</span>
                        <span style={s.internalMood}>{r.fontMood}</span>
                      </div>
                    </div>
                  ))}
                  {internalResults.length === 0 && (
                    <p style={s.noResults}>
                      일치하는 내부 레퍼런스가 없습니다
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right: Detail panel ── */}
        <div style={s.sidePanel}>
          {selectedResult ? (
            <div style={s.detailPanel}>
              <div style={s.detailHeader}>
                <h3 style={s.detailTitle}>이미지 상세</h3>
                <button
                  type="button"
                  style={s.closeBtn}
                  onClick={() => setSelectedResult(null)}
                >
                  ✕
                </button>
              </div>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedResult.fullUrl}
                alt={selectedResult.author}
                style={s.detailImg}
              />

              <div style={s.detailMeta}>
                <div style={s.detailRow}>
                  <span style={s.detailLabel}>작가</span>
                  <span style={s.detailValue}>{selectedResult.author}</span>
                </div>
                <div style={s.detailRow}>
                  <span style={s.detailLabel}>출처</span>
                  <span style={s.detailValue}>
                    {selectedResult.provider === "unsplash"
                      ? "Unsplash"
                      : "Pexels"}
                  </span>
                </div>
                <div style={s.detailRow}>
                  <span style={s.detailLabel}>크기</span>
                  <span style={s.detailValue}>
                    {selectedResult.width} × {selectedResult.height}
                  </span>
                </div>
                <div style={s.detailRow}>
                  <span style={s.detailLabel}>매칭 전략</span>
                  <span style={s.detailValue}>
                    {selectedResult.matchStrategy}
                  </span>
                </div>
              </div>

              <a
                href={selectedResult.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={s.sourceLink}
              >
                원본 보기
              </a>
            </div>
          ) : (
            <div style={s.placeholder}>
              <p style={s.placeholderText}>
                {analysis
                  ? "결과에서 이미지를 선택하세요"
                  : "이미지를 업로드하고\n무드 검색을 시작하세요"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

  dropZone: (dragOver: boolean, hasImage: boolean) =>
    ({
      border: dragOver
        ? "2px dashed var(--accent)"
        : "2px dashed var(--border-light)",
      borderRadius: "var(--radius-sm)",
      padding: hasImage ? "0" : "40px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      background: dragOver ? "var(--accent-light)" : "var(--bg-input)",
      transition: "all var(--transition)",
      overflow: "hidden",
      minHeight: hasImage ? undefined : "140px",
    }) as React.CSSProperties,

  dropText: {
    fontSize: "13px",
    color: "var(--text-muted)",
    textAlign: "center" as const,
  } as React.CSSProperties,

  previewImg: {
    width: "100%",
    maxHeight: "260px",
    objectFit: "contain" as const,
    display: "block",
  } as React.CSSProperties,

  searchBtn: {
    padding: "10px 0",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  error: {
    fontSize: "12px",
    color: "var(--red)",
    margin: 0,
  } as React.CSSProperties,

  analysisSummary: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
    padding: "14px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border-light)",
  } as React.CSSProperties,

  tagsRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px",
  } as React.CSSProperties,

  moodTag: {
    fontSize: "11px",
    fontWeight: 500,
    padding: "3px 10px",
    borderRadius: "20px",
    background: "var(--accent-light)",
    color: "var(--accent)",
  } as React.CSSProperties,

  paletteRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  } as React.CSSProperties,

  colorSwatch: {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    border: "2px solid var(--border-light)",
    flexShrink: 0,
  } as React.CSSProperties,

  colorFamily: {
    fontSize: "11px",
    color: "var(--text-muted)",
    marginLeft: "4px",
  } as React.CSSProperties,

  atmosphere: {
    fontSize: "12px",
    color: "var(--text-muted)",
    margin: 0,
    fontStyle: "italic" as const,
  } as React.CSSProperties,

  resultTabRow: {
    display: "flex",
    gap: "4px",
    background: "var(--bg-input)",
    borderRadius: "10px",
    padding: "3px",
  } as React.CSSProperties,

  resultTabActive: {
    flex: 1,
    padding: "7px 0",
    borderRadius: "8px",
    border: "none",
    background: "var(--bg-card)",
    boxShadow: "var(--shadow-card)",
    color: "var(--text)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  resultTabInactive: {
    flex: 1,
    padding: "7px 0",
    borderRadius: "8px",
    border: "none",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  resultGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: "12px",
  } as React.CSSProperties,

  noResults: {
    fontSize: "13px",
    color: "var(--text-muted)",
    textAlign: "center" as const,
    gridColumn: "1 / -1",
    padding: "24px 0",
  } as React.CSSProperties,

  internalCard: {
    borderRadius: "var(--radius-sm)",
    overflow: "hidden",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    cursor: "pointer",
  } as React.CSSProperties,

  internalImg: {
    width: "100%",
    aspectRatio: "4/3",
    objectFit: "cover" as const,
    display: "block",
  } as React.CSSProperties,

  internalMeta: {
    padding: "8px 10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  internalTitle: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  internalMood: {
    fontSize: "9px",
    fontWeight: 500,
    padding: "2px 6px",
    borderRadius: "4px",
    background: "var(--bg-input)",
    color: "var(--text-muted)",
    flexShrink: 0,
    marginLeft: "6px",
  } as React.CSSProperties,

  sidePanel: {
    width: "360px",
    flexShrink: 0,
  } as React.CSSProperties,

  detailPanel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "14px",
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
    objectFit: "cover" as const,
    maxHeight: "300px",
  } as React.CSSProperties,

  detailMeta: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
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
  } as React.CSSProperties,

  detailValue: {
    fontSize: "12px",
    color: "var(--text)",
    fontWeight: 600,
  } as React.CSSProperties,

  sourceLink: {
    display: "block",
    textAlign: "center" as const,
    padding: "9px 0",
    borderRadius: "10px",
    border: "1px solid var(--accent)",
    background: "transparent",
    color: "var(--accent)",
    fontSize: "13px",
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
