"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PlanItem } from "@/lib/studio/plan/types";

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  post: { bg: "rgba(61,166,110,0.12)", text: "#3DA66E" },
  reels: { bg: "rgba(147,51,234,0.12)", text: "#9333ea" },
  promotion: { bg: "rgba(234,179,8,0.12)", text: "#b8860b" },
};

const CATEGORY_COLORS: Record<string, string> = {
  "scene-news": "#3DA66E",
  "live-experience": "#ef4444",
  "artist-deep-dive": "#8b5cf6",
  "playlist": "#10b981",
  "nerd-analysis": "#f59e0b",
  "culture-crossover": "#ec4899",
  "seasonal-special": "#06b6d4",
  "song-spotlight": "#f97316",
};

interface PlanItemRowProps {
  item: PlanItem;
  isSelected: boolean;
  onSelect: () => void;
  onAddToCalendar: () => void;
  onRemoveFromCalendar: () => void;
}

export default function PlanItemRow({
  item,
  isSelected,
  onSelect,
  onAddToCalendar,
  onRemoveFromCalendar,
}: PlanItemRowProps) {
  const router = useRouter();
  const typeColor = TYPE_COLORS[item.type] ?? { bg: "rgba(61,166,110,0.12)", text: "#3DA66E" };
  const catColor = CATEGORY_COLORS[item.category] ?? "#888";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const encodedTopic = encodeURIComponent(item.title);

  return (
    <div
      style={{
        ...styles.row,
        ...(isSelected ? styles.rowSelected : {}),
      }}
      onClick={onSelect}
    >
      {/* Category dot */}
      <div style={{ ...styles.catDot, background: catColor }} />

      {/* Content */}
      <div style={styles.content}>
        <div style={styles.title}>{item.title}</div>
        <div style={styles.badges}>
          <span
            style={{
              ...styles.typeBadge,
              background: typeColor.bg,
              color: typeColor.text,
            }}
          >
            {item.type}
          </span>
          <span style={styles.categoryLabel}>{item.category}</span>
        </div>
      </div>

      {/* Create button with dropdown */}
      <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
        <button
          style={styles.createBtn}
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          title="만들기"
        >
          →
        </button>
        {menuOpen && (
          <div style={styles.dropdown}>
            <button style={styles.dropItem} onClick={(e) => { e.stopPropagation(); router.push(`/studio/design?quick=1&topic=${encodedTopic}`); }}>카드뉴스</button>
            <button style={styles.dropItem} onClick={(e) => { e.stopPropagation(); router.push(`/studio/blog?topic=${encodedTopic}`); }}>블로그</button>
            <button style={styles.dropItem} onClick={(e) => { e.stopPropagation(); router.push(`/studio/publish?text=${encodedTopic}`); }}>포스트</button>
          </div>
        )}
      </div>

      {/* Toggle calendar button */}
      <button
        style={{
          ...styles.addBtn,
          ...(item.addedToCalendar ? styles.addBtnDone : {}),
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (item.addedToCalendar) {
            onRemoveFromCalendar();
          } else {
            onAddToCalendar();
          }
        }}
      >
        {item.addedToCalendar ? "✓" : "+"}
      </button>
    </div>
  );
}

const styles = {
  row: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all var(--transition)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "transparent",
  } as React.CSSProperties,

  rowSelected: {
    background: "var(--bg-input)",
    borderColor: "var(--accent)",
  } as React.CSSProperties,

  catDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  } as React.CSSProperties,

  content: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  } as React.CSSProperties,

  title: {
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--text)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,

  badges: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
  } as React.CSSProperties,

  typeBadge: {
    fontSize: "10px",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "6px",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,

  categoryLabel: {
    fontSize: "11px",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  addBtn: {
    width: "32px",
    height: "32px",
    borderRadius: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--accent)",
    fontSize: "18px",
    fontWeight: 400,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all var(--transition)",
  } as React.CSSProperties,

  addBtnDone: {
    background: "var(--green)",
    color: "#fff",
    borderColor: "var(--green)",
  } as React.CSSProperties,

  createBtn: {
    width: "32px",
    height: "32px",
    borderRadius: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--accent)",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all var(--transition)",
  } as React.CSSProperties,

  dropdown: {
    position: "absolute" as const,
    top: "100%",
    right: 0,
    marginTop: 4,
    background: "var(--bg-card)",
    border: "1px solid var(--border-light)",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: 50,
    overflow: "hidden",
    minWidth: 100,
  } as React.CSSProperties,

  dropItem: {
    display: "block",
    width: "100%",
    padding: "8px 14px",
    border: "none",
    background: "none",
    color: "var(--text)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "background 0.1s",
  } as React.CSSProperties,
};
