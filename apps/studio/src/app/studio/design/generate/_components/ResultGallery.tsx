"use client";

import { useState, useCallback } from "react";
import type { DesignBrief } from "@/lib/design/types";
import type { GenerateResultItem, CritiqueResult } from "./DesignGenerateWizard";

// ── Dimension Labels ─────────────────────────────────────

const DIMENSION_LABELS: Record<string, string> = {
  VISUAL_HIERARCHY: "시각적 위계",
  BRAND_CONSISTENCY: "브랜드 일관성",
  READABILITY: "가독성",
  AESTHETIC_QUALITY: "미적 품질",
  PLATFORM_FIT: "플랫폼 적합성",
};

const VERDICT_STYLES: Record<string, { text: string; color: string; bg: string }> = {
  pass: { text: "통과", color: "#059669", bg: "#ECFDF5" },
  refine: { text: "개선 필요", color: "#D97706", bg: "#FFFBEB" },
  regenerate: { text: "재생성 권장", color: "#DC2626", bg: "#FEF2F2" },
};

// ── Props ────────────────────────────────────────────────

interface Props {
  brief: DesignBrief | null;
  results: GenerateResultItem[];
  critique: CritiqueResult | null;
  generationTimeMs: number;
  onCritique: () => Promise<void>;
  onRegenerate: () => void;
}

// ── Component ────────────────────────────────────────────

export default function ResultGallery({
  brief,
  results,
  critique,
  generationTimeMs,
  onCritique,
  onRegenerate,
}: Props) {
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [critiquing, setCritiquing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const allSlides = results.flatMap((r) => r.slides);
  const currentSlide = allSlides[selectedSlide];

  const handleCritique = useCallback(async () => {
    setCritiquing(true);
    await onCritique();
    setCritiquing(false);
  }, [onCritique]);

  const handleDownload = useCallback(
    async (png: string, index: number) => {
      const a = document.createElement("a");
      a.href = png;
      a.download = `slide-${String(index + 1).padStart(2, "0")}.png`;
      a.click();
    },
    [],
  );

  const handleDownloadAll = useCallback(async () => {
    setDownloading(true);
    for (let i = 0; i < allSlides.length; i++) {
      const slide = allSlides[i]!;
      if (slide.png) {
        await handleDownload(slide.png, i);
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    setDownloading(false);
  }, [allSlides, handleDownload]);

  return (
    <div style={s.outer}>
      {/* Summary Bar */}
      <div style={s.summaryBar}>
        <div style={s.summaryInfo}>
          <span style={s.summaryLabel}>
            {results.length}개 포맷 / {allSlides.length}장
          </span>
          <span style={s.summaryTime}>
            {(generationTimeMs / 1000).toFixed(1)}s
          </span>
        </div>
        <div style={s.summaryActions}>
          <button
            type="button"
            style={s.actionBtn}
            onClick={handleCritique}
            disabled={critiquing}
          >
            {critiquing ? "평가 중..." : "AI 평가"}
          </button>
          <button
            type="button"
            style={s.actionBtn}
            onClick={handleDownloadAll}
            disabled={downloading}
          >
            {downloading ? "다운로드 중..." : "전체 다운로드"}
          </button>
          <button type="button" style={s.actionBtnAccent} onClick={onRegenerate}>
            다시 생성
          </button>
        </div>
      </div>

      {/* Main Preview */}
      <div style={s.previewSection}>
        {/* Slide Preview */}
        <div style={s.previewArea}>
          {currentSlide?.png ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentSlide.png}
              alt={`slide-${selectedSlide + 1}`}
              style={s.previewImg}
            />
          ) : (
            <div style={s.noPreview}>렌더링 실패</div>
          )}
        </div>

        {/* Sidebar: Thumbnails + Brief + Critique */}
        <div style={s.sidebar}>
          {/* Thumbnails */}
          <div style={s.thumbList}>
            {allSlides.map((slide, i) => (
              <button
                key={i}
                type="button"
                style={s.thumbBtn(i === selectedSlide)}
                onClick={() => setSelectedSlide(i)}
              >
                {slide.png ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.png}
                    alt={`thumb-${i + 1}`}
                    style={s.thumbImg}
                  />
                ) : (
                  <div style={s.thumbPlaceholder}>{i + 1}</div>
                )}
                <span style={s.thumbLabel}>Slide {i + 1}</span>
              </button>
            ))}
          </div>

          {/* Download Single */}
          {currentSlide?.png && (
            <button
              type="button"
              style={s.downloadSingle}
              onClick={() => handleDownload(currentSlide.png!, selectedSlide)}
            >
              이 슬라이드 다운로드
            </button>
          )}

          {/* Brief Summary */}
          {brief && (
            <div style={s.infoCard}>
              <h4 style={s.infoTitle}>Design Brief</h4>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>키 메시지</span>
                <span style={s.infoValue}>{brief.keyMessage}</span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>무드</span>
                <span style={s.infoValue}>{brief.mood}</span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>비주얼</span>
                <span style={s.infoValue}>{brief.visualConcept}</span>
              </div>
            </div>
          )}

          {/* Critique Results */}
          {critique && (
            <div style={s.infoCard}>
              <div style={s.critiqueHeader}>
                <h4 style={s.infoTitle}>AI 평가</h4>
                <span
                  style={{
                    ...s.verdictBadge,
                    color: VERDICT_STYLES[critique.verdict]?.color,
                    background: VERDICT_STYLES[critique.verdict]?.bg,
                  }}
                >
                  {VERDICT_STYLES[critique.verdict]?.text}{" "}
                  {critique.averageScore.toFixed(1)}
                </span>
              </div>
              {critique.scores.map((sc) => (
                <div key={sc.dimension} style={s.scoreRow}>
                  <div style={s.scoreHeader}>
                    <span style={s.scoreLabel}>
                      {DIMENSION_LABELS[sc.dimension] ?? sc.dimension}
                    </span>
                    <span style={s.scoreValue}>{sc.score}/10</span>
                  </div>
                  <div style={s.scoreBar}>
                    <div
                      style={{
                        ...s.scoreBarFill,
                        width: `${sc.score * 10}%`,
                        background:
                          sc.score >= 8
                            ? "#059669"
                            : sc.score >= 6
                              ? "#D97706"
                              : "#DC2626",
                      }}
                    />
                  </div>
                  <span style={s.scoreFeedback}>{sc.feedback}</span>
                </div>
              ))}
              {critique.refinementInstructions && (
                <div style={s.refinementBox}>
                  <span style={s.refinementLabel}>개선 제안</span>
                  <p style={s.refinementText}>
                    {critique.refinementInstructions}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────

const s = {
  outer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
  } as React.CSSProperties,

  summaryBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    background: "var(--bg-card)",
    borderRadius: "12px",
    border: "1px solid var(--border-light)",
    flexWrap: "wrap" as const,
    gap: "8px",
  } as React.CSSProperties,

  summaryInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  } as React.CSSProperties,

  summaryLabel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text)",
  } as React.CSSProperties,

  summaryTime: {
    fontSize: "12px",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  summaryActions: {
    display: "flex",
    gap: "8px",
  } as React.CSSProperties,

  actionBtn: {
    padding: "7px 16px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
  } as React.CSSProperties,

  actionBtnAccent: {
    padding: "7px 16px",
    borderRadius: "8px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  } as React.CSSProperties,

  previewSection: {
    display: "grid",
    gridTemplateColumns: "1fr 300px",
    gap: "16px",
    alignItems: "start",
  } as React.CSSProperties,

  previewArea: {
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    background: "var(--bg-input)",
    borderRadius: "12px",
    border: "1px solid var(--border-light)",
    padding: "16px",
    minHeight: "400px",
  } as React.CSSProperties,

  previewImg: {
    maxWidth: "100%",
    maxHeight: "600px",
    objectFit: "contain" as const,
    borderRadius: "8px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
  } as React.CSSProperties,

  noPreview: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: "300px",
    color: "var(--text-muted)",
    fontSize: "14px",
  } as React.CSSProperties,

  sidebar: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  } as React.CSSProperties,

  thumbList: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
  } as React.CSSProperties,

  thumbBtn: (active: boolean) =>
    ({
      padding: "4px",
      borderRadius: "8px",
      border: active
        ? "2px solid var(--accent)"
        : "1px solid var(--border-light)",
      background: "var(--bg-card)",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: "4px",
      transition: "all var(--transition)",
    }) as React.CSSProperties,

  thumbImg: {
    width: "100%",
    aspectRatio: "1",
    objectFit: "cover" as const,
    borderRadius: "6px",
  } as React.CSSProperties,

  thumbPlaceholder: {
    width: "100%",
    aspectRatio: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-input)",
    borderRadius: "6px",
    fontSize: "14px",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  thumbLabel: {
    fontSize: "10px",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  downloadSingle: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "center" as const,
  } as React.CSSProperties,

  infoCard: {
    background: "var(--bg-card)",
    borderRadius: "12px",
    border: "1px solid var(--border-light)",
    padding: "14px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
  } as React.CSSProperties,

  infoTitle: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
  } as React.CSSProperties,

  infoRow: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  } as React.CSSProperties,

  infoLabel: {
    fontSize: "11px",
    color: "var(--text-muted)",
    fontWeight: 500,
  } as React.CSSProperties,

  infoValue: {
    fontSize: "12px",
    color: "var(--text)",
  } as React.CSSProperties,

  critiqueHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as React.CSSProperties,

  verdictBadge: {
    fontSize: "11px",
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: "6px",
  } as React.CSSProperties,

  scoreRow: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "3px",
  } as React.CSSProperties,

  scoreHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  scoreLabel: {
    fontSize: "11px",
    color: "var(--text)",
    fontWeight: 500,
  } as React.CSSProperties,

  scoreValue: {
    fontSize: "11px",
    color: "var(--text-muted)",
    fontWeight: 600,
  } as React.CSSProperties,

  scoreBar: {
    height: "4px",
    borderRadius: "2px",
    background: "var(--bg-input)",
    overflow: "hidden",
  } as React.CSSProperties,

  scoreBarFill: {
    height: "100%",
    borderRadius: "2px",
    transition: "width 0.4s ease",
  } as React.CSSProperties,

  scoreFeedback: {
    fontSize: "10px",
    color: "var(--text-muted)",
    lineHeight: "1.4",
  } as React.CSSProperties,

  refinementBox: {
    padding: "10px",
    borderRadius: "8px",
    background: "#FFFBEB",
    border: "1px solid #FDE68A",
  } as React.CSSProperties,

  refinementLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#92400E",
  } as React.CSSProperties,

  refinementText: {
    fontSize: "12px",
    color: "#78350F",
    margin: "4px 0 0 0",
    lineHeight: "1.5",
  } as React.CSSProperties,
};
