"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  category: string;
  thumbnailDataUri: string;
  updatedAt: string;
}

interface ProjectDestinationPickerProps {
  onSelectQuick: () => void;
  onSelectProject: (projectId: string) => void;
  onClose: () => void;
}

export default function ProjectDestinationPicker({
  onSelectQuick,
  onSelectProject,
  onClose,
}: ProjectDestinationPickerProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/db/projects?status=draft")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  return (
    <div ref={backdropRef} style={s.backdrop} onClick={handleBackdropClick}>
      <div style={s.modal}>
        <div style={s.header}>
          <h3 style={s.title}>어디에 적용할까요?</h3>
          <button type="button" style={s.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        <button type="button" style={s.quickBtn} onClick={onSelectQuick}>
          빠른 디자인으로 열기
          <span style={s.quickDesc}>새 에디터에서 바로 시작</span>
        </button>

        <div style={s.divider}>
          <span style={s.dividerLabel}>또는 기존 프로젝트에 적용</span>
        </div>

        <div style={s.list}>
          {loading ? (
            <div style={s.empty}>불러오는 중...</div>
          ) : projects.length === 0 ? (
            <div style={s.empty}>작업 중인 프로젝트가 없습니다.</div>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                type="button"
                style={s.row}
                onClick={() => onSelectProject(p.id)}
              >
                <div style={s.rowThumb}>
                  {p.thumbnailDataUri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnailDataUri} alt="" style={s.rowThumbImg} />
                  ) : (
                    <span style={s.rowThumbPlaceholder}>+</span>
                  )}
                </div>
                <div style={s.rowInfo}>
                  <span style={s.rowTitle}>{p.title}</span>
                  <span style={s.rowDate}>
                    {new Date(p.updatedAt).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  backdrop: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  } as React.CSSProperties,

  modal: {
    width: "100%",
    maxWidth: "420px",
    maxHeight: "70vh",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    boxShadow: "var(--shadow-hover)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  } as React.CSSProperties,

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px 0",
  } as React.CSSProperties,

  title: {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
  } as React.CSSProperties,

  closeBtn: {
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    border: "none",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "18px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,

  quickBtn: {
    margin: "14px 20px 0",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid var(--accent)",
    background: "rgba(91,95,199,0.06)",
    color: "var(--accent)",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  quickDesc: {
    fontSize: "11px",
    fontWeight: 400,
    opacity: 0.7,
  } as React.CSSProperties,

  divider: {
    margin: "14px 20px 0",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  } as React.CSSProperties,

  dividerLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-muted)",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  list: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "10px 20px 20px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  } as React.CSSProperties,

  empty: {
    padding: "24px 0",
    textAlign: "center" as const,
    color: "var(--text-muted)",
    fontSize: "13px",
  } as React.CSSProperties,

  row: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all var(--transition)",
  } as React.CSSProperties,

  rowThumb: {
    width: "40px",
    height: "40px",
    borderRadius: "8px",
    overflow: "hidden",
    background: "var(--bg-input)",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,

  rowThumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  } as React.CSSProperties,

  rowThumbPlaceholder: {
    fontSize: "16px",
    color: "var(--text-muted)",
    opacity: 0.3,
  } as React.CSSProperties,

  rowInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
    minWidth: 0,
    flex: 1,
  } as React.CSSProperties,

  rowTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  rowDate: {
    fontSize: "11px",
    color: "var(--text-muted)",
  } as React.CSSProperties,
};
