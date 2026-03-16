"use client";

import type { DesignBrief } from "@/lib/design/types";

interface Props {
  message: string;
  brief: DesignBrief | null;
  onCancel: () => void;
}

export default function GenerationProgress({ message, brief, onCancel }: Props) {
  return (
    <div style={s.outer}>
      {/* Spinner + Message */}
      <div style={s.spinnerRow}>
        <div style={s.spinner} />
        <span style={s.message}>{message}</span>
      </div>

      {/* Brief Preview (if arrived) */}
      {brief && (
        <div style={s.briefCard}>
          <h4 style={s.briefTitle}>Design Brief</h4>
          <div style={s.briefGrid}>
            <div style={s.briefItem}>
              <span style={s.briefLabel}>유형</span>
              <span style={s.briefValue}>{brief.contentType}</span>
            </div>
            <div style={s.briefItem}>
              <span style={s.briefLabel}>무드</span>
              <span style={s.briefValue}>{brief.mood}</span>
            </div>
            <div style={s.briefItem}>
              <span style={s.briefLabel}>키 메시지</span>
              <span style={s.briefValue}>{brief.keyMessage}</span>
            </div>
            <div style={s.briefItem}>
              <span style={s.briefLabel}>비주얼 컨셉</span>
              <span style={s.briefValue}>{brief.visualConcept}</span>
            </div>
            <div style={s.briefItem}>
              <span style={s.briefLabel}>레이아웃</span>
              <span style={s.briefValue}>{brief.layoutStyle}</span>
            </div>
            <div style={s.briefItem}>
              <span style={s.briefLabel}>색상</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "4px",
                    background: brief.colorDirection.primary,
                    border: "1px solid var(--border-light)",
                  }}
                />
                <span style={s.briefValue}>
                  {brief.colorDirection.primary} ({brief.colorDirection.mood})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <button type="button" style={s.cancelBtn} onClick={onCancel}>
        취소
      </button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────

const s = {
  outer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "24px",
    padding: "48px 24px",
  } as React.CSSProperties,

  spinnerRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  } as React.CSSProperties,

  spinner: {
    width: "20px",
    height: "20px",
    border: "2.5px solid var(--border-light)",
    borderTopColor: "var(--accent)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  } as React.CSSProperties,

  message: {
    fontSize: "14px",
    color: "var(--text)",
    fontWeight: 500,
  } as React.CSSProperties,

  briefCard: {
    width: "100%",
    maxWidth: "480px",
    background: "var(--bg-card)",
    borderRadius: "12px",
    border: "1px solid var(--border-light)",
    padding: "20px",
  } as React.CSSProperties,

  briefTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text)",
    margin: "0 0 14px 0",
  } as React.CSSProperties,

  briefGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  } as React.CSSProperties,

  briefItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  } as React.CSSProperties,

  briefLabel: {
    fontSize: "11px",
    color: "var(--text-muted)",
    fontWeight: 500,
  } as React.CSSProperties,

  briefValue: {
    fontSize: "13px",
    color: "var(--text)",
    fontWeight: 500,
  } as React.CSSProperties,

  cancelBtn: {
    padding: "8px 20px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text-muted)",
    fontSize: "13px",
    cursor: "pointer",
  } as React.CSSProperties,
};
