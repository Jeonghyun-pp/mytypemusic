"use client";

import { useState, useCallback, type CSSProperties } from "react";

// ── Types ────────────────────────────────────────────────

interface DimensionScore {
  dimension: string;
  score: number;
  feedback: string;
}

interface CritiqueResult {
  scores: DimensionScore[];
  averageScore: number;
  verdict: "pass" | "refine" | "regenerate";
  refinementInstructions?: string;
  overallFeedback?: string;
  evaluationTimeMs?: number;
}

interface AiPolishPanelProps {
  /** Render current slide to PNG and return data URI */
  onRenderSlide: () => Promise<string | null>;
  /** Apply AI refinement instructions to the current design */
  onApplyRefinement?: (instructions: string) => void;
  /** Context for more accurate critique */
  context?: {
    contentType?: string;
    platform?: string;
    mood?: string;
    keyMessage?: string;
  };
}

// ── Dimension labels (Korean) ────────────────────────────

const DIMENSION_LABELS: Record<string, string> = {
  VISUAL_HIERARCHY: "시각적 위계",
  BRAND_CONSISTENCY: "브랜드 일관성",
  READABILITY: "가독성",
  AESTHETIC_QUALITY: "미적 품질",
  PLATFORM_FIT: "플랫폼 적합성",
};

const VERDICT_LABELS: Record<string, { text: string; color: string; bg: string }> = {
  pass: { text: "통과", color: "#059669", bg: "#ECFDF5" },
  refine: { text: "개선 필요", color: "#D97706", bg: "#FFFBEB" },
  regenerate: { text: "재생성 권장", color: "#DC2626", bg: "#FEF2F2" },
};

// ── Styles ───────────────────────────────────────────────

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
    padding: "16px",
    height: "100%",
    overflowY: "auto" as const,
  } satisfies CSSProperties,
  title: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text)",
    margin: 0,
  } satisfies CSSProperties,
  description: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    margin: 0,
    lineHeight: 1.5,
  } satisfies CSSProperties,
  analyzeBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px 16px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #6C5CE7 0%, #A29BFE 100%)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  } satisfies CSSProperties,
  scoreCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
  } satisfies CSSProperties,
  scoreRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  } satisfies CSSProperties,
  dimensionLabel: {
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text)",
    width: "100px",
    flexShrink: 0,
  } satisfies CSSProperties,
  barOuter: {
    flex: 1,
    height: "8px",
    borderRadius: "4px",
    background: "var(--border-light)",
    overflow: "hidden",
    position: "relative" as const,
  } satisfies CSSProperties,
  scoreNum: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text)",
    width: "28px",
    textAlign: "right" as const,
    flexShrink: 0,
  } satisfies CSSProperties,
  feedbackText: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    margin: "2px 0 0 0",
    paddingLeft: "110px",
  } satisfies CSSProperties,
  verdictBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
  } satisfies CSSProperties,
  avgScore: {
    fontSize: "32px",
    fontWeight: 700,
    color: "var(--text)",
    textAlign: "center" as const,
    margin: "4px 0",
  } satisfies CSSProperties,
  sectionTitle: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    margin: "8px 0 4px",
  } satisfies CSSProperties,
  instructionBox: {
    fontSize: "12px",
    color: "var(--text)",
    lineHeight: 1.6,
    padding: "10px 12px",
    borderRadius: "8px",
    background: "var(--bg-card)",
    border: "1px solid var(--border-light)",
    whiteSpace: "pre-wrap" as const,
  } satisfies CSSProperties,
  applyBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "8px",
    border: "1px solid var(--accent)",
    background: "transparent",
    color: "var(--accent)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  } satisfies CSSProperties,
  errorBox: {
    fontSize: "12px",
    color: "#DC2626",
    padding: "10px 12px",
    borderRadius: "8px",
    background: "#FEF2F2",
    border: "1px solid #FECACA",
  } satisfies CSSProperties,
  timeText: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    textAlign: "center" as const,
  } satisfies CSSProperties,
};

// ── Score bar color ──────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 8) return "#059669";
  if (score >= 6) return "#D97706";
  return "#DC2626";
}

// ── Component ────────────────────────────────────────────

export default function AiPolishPanel({
  onRenderSlide,
  onApplyRefinement,
  context,
}: AiPolishPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CritiqueResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const png = await onRenderSlide();
      if (!png) {
        setError("슬라이드 렌더링에 실패했습니다.");
        return;
      }

      const res = await fetch("/api/design/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: [png],
          context,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${String(res.status)}`);
      }

      const data = (await res.json()) as CritiqueResult;
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [onRenderSlide, context]);

  const handleApply = useCallback(() => {
    if (!result?.refinementInstructions || !onApplyRefinement) return;
    setApplying(true);
    onApplyRefinement(result.refinementInstructions);
    setTimeout(() => setApplying(false), 500);
  }, [result, onApplyRefinement]);

  return (
    <div style={s.container}>
      <p style={s.title}>AI 디자인 분석</p>
      <p style={s.description}>
        현재 슬라이드를 AI가 5가지 차원으로 평가하고 개선점을 제안합니다.
      </p>

      <button
        type="button"
        style={{
          ...s.analyzeBtn,
          opacity: loading ? 0.6 : 1,
          cursor: loading ? "wait" : "pointer",
        }}
        onClick={() => void handleAnalyze()}
        disabled={loading}
      >
        {loading ? (
          <>분석 중...</>
        ) : (
          <>디자인 분석하기</>
        )}
      </button>

      {error && <div style={s.errorBox}>{error}</div>}

      {result && (
        <>
          {/* Average score */}
          <div style={{ textAlign: "center" }}>
            <div style={s.avgScore}>
              <span style={{ color: scoreColor(result.averageScore) }}>
                {result.averageScore.toFixed(1)}
              </span>
              <span style={{ fontSize: "16px", color: "var(--text-secondary)", fontWeight: 400 }}>
                {" "}/ 10
              </span>
            </div>
            {(() => {
              const v = VERDICT_LABELS[result.verdict];
              return v ? (
                <span style={{ ...s.verdictBadge, color: v.color, background: v.bg }}>
                  {v.text}
                </span>
              ) : null;
            })()}
          </div>

          {/* Dimension scores */}
          <div style={s.scoreCard}>
            <p style={s.sectionTitle}>차원별 평가</p>
            {result.scores.map((dim) => (
              <div key={dim.dimension}>
                <div style={s.scoreRow}>
                  <span style={s.dimensionLabel}>
                    {DIMENSION_LABELS[dim.dimension] ?? dim.dimension}
                  </span>
                  <div style={s.barOuter}>
                    <div
                      style={{
                        height: "100%",
                        width: `${String(dim.score * 10)}%`,
                        borderRadius: "4px",
                        background: scoreColor(dim.score),
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                  <span style={{ ...s.scoreNum, color: scoreColor(dim.score) }}>
                    {dim.score}
                  </span>
                </div>
                {dim.feedback && dim.feedback !== "평가 누락 — 기본값 적용" && (
                  <p style={s.feedbackText}>{dim.feedback}</p>
                )}
              </div>
            ))}
          </div>

          {/* Overall feedback */}
          {result.overallFeedback && (
            <div>
              <p style={s.sectionTitle}>종합 피드백</p>
              <div style={s.instructionBox}>{result.overallFeedback}</div>
            </div>
          )}

          {/* Refinement instructions + apply button */}
          {result.refinementInstructions && (
            <div>
              <p style={s.sectionTitle}>개선 지침</p>
              <div style={s.instructionBox}>{result.refinementInstructions}</div>
              {onApplyRefinement && (
                <button
                  type="button"
                  style={{
                    ...s.applyBtn,
                    marginTop: "8px",
                    opacity: applying ? 0.5 : 1,
                  }}
                  onClick={handleApply}
                  disabled={applying}
                >
                  {applying ? "적용 중..." : "AI 자동 수정 적용"}
                </button>
              )}
            </div>
          )}

          {result.evaluationTimeMs && (
            <p style={s.timeText}>
              분석 시간: {(result.evaluationTimeMs / 1000).toFixed(1)}초
            </p>
          )}
        </>
      )}
    </div>
  );
}
