"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CONTENT_CATEGORIES } from "@/lib/studio/contentCategories";
import type { PlanItem } from "@/lib/studio/plan/types";

interface PlanItemPickerProps {
  /** IDs of plan items already linked to a project */
  linkedPlanItemIds: Set<string>;
  onSelect: (item: PlanItem) => void;
  onSkip: () => void;
  onClose: () => void;
}

interface PlanData {
  id: string;
  startDate: string;
  endDate: string;
  items: PlanItem[];
}

export default function PlanItemPicker({
  linkedPlanItemIds,
  onSelect,
  onSkip,
  onClose,
}: PlanItemPickerProps) {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/db/plans")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  // Flatten all plan items, sorted by date desc, excluding already-linked ones
  const allItems = plans
    .flatMap((p) => p.items)
    .filter((item) => !linkedPlanItemIds.has(item.id))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div ref={backdropRef} style={s.backdrop} onClick={handleBackdropClick}>
      <div style={s.modal}>
        {/* Header */}
        <div style={s.header}>
          <h3 style={s.title}>계획에서 선택</h3>
          <button type="button" style={s.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        <p style={s.desc}>
          콘텐츠 계획 항목을 선택하면 해당 정보로 프로젝트가 생성됩니다.
        </p>

        {/* Skip button */}
        <button type="button" style={s.skipBtn} onClick={onSkip}>
          빈 프로젝트로 시작
        </button>

        {/* Item list */}
        <div style={s.list}>
          {loading ? (
            <div style={s.empty}>불러오는 중...</div>
          ) : allItems.length === 0 ? (
            <div style={s.empty}>연결 가능한 계획 항목이 없습니다.</div>
          ) : (
            allItems.map((item) => (
              <PlanItemRow key={item.id} item={item} onSelect={onSelect} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Individual item row ─────────────────────────────── */

function PlanItemRow({
  item,
  onSelect,
}: {
  item: PlanItem;
  onSelect: (item: PlanItem) => void;
}) {
  const cat = CONTENT_CATEGORIES.find((c) => c.id === item.category);
  const typeLabel =
    item.type === "post" ? "Post" : item.type === "reels" ? "Reels" : "Promo";

  return (
    <button type="button" style={s.row} onClick={() => onSelect(item)}>
      <div style={s.rowTop}>
        <span style={s.rowDate}>{item.date}</span>
        <span style={s.rowType}>{typeLabel}</span>
        <span style={s.rowCat}>
          {cat?.label.replace(/^\[\d\]\s*/, "") ?? item.category}
        </span>
      </div>
      <span style={s.rowTitle}>{item.title}</span>
      {item.description && (
        <span style={s.rowDesc}>{item.description}</span>
      )}
    </button>
  );
}

/* ── Styles ──────────────────────────────────────────── */

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
    maxWidth: "520px",
    maxHeight: "80vh",
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

  desc: {
    fontSize: "12px",
    color: "var(--text-muted)",
    margin: "6px 20px 0",
    lineHeight: 1.4,
  } as React.CSSProperties,

  skipBtn: {
    margin: "12px 20px 0",
    padding: "10px",
    borderRadius: "10px",
    border: "1px dashed var(--border-light)",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  list: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "12px 20px 20px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  } as React.CSSProperties,

  empty: {
    padding: "30px 0",
    textAlign: "center" as const,
    color: "var(--text-muted)",
    fontSize: "13px",
  } as React.CSSProperties,

  row: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all var(--transition)",
  } as React.CSSProperties,

  rowTop: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  } as React.CSSProperties,

  rowDate: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-muted)",
    padding: "1px 6px",
    borderRadius: "4px",
    background: "var(--bg-input)",
  } as React.CSSProperties,

  rowType: {
    fontSize: "10px",
    fontWeight: 600,
    color: "#3DA66E",
    padding: "1px 6px",
    borderRadius: "4px",
    background: "rgba(61,166,110,0.1)",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,

  rowCat: {
    fontSize: "10px",
    fontWeight: 500,
    color: "var(--text-muted)",
  } as React.CSSProperties,

  rowTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  rowDesc: {
    fontSize: "11px",
    color: "var(--text-muted)",
    lineHeight: 1.4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
};
