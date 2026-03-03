"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONTENT_CATEGORIES } from "@/lib/studio/contentCategories";
import type { DesignEntry } from "./databaseStore";
import { CATEGORY_COLORS } from "./EntryCard";

/** localStorage key used to pass code to Design Editor */
const LOAD_KEY = "studio-database-load";

interface EntryDetailProps {
  entry: DesignEntry;
  onUpdate: (id: string, patch: Partial<DesignEntry>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function EntryDetail({ entry, onUpdate, onDelete, onClose }: EntryDetailProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [category, setCategory] = useState(entry.category);
  const [copied, setCopied] = useState(false);

  function handleOpenInEditor() {
    localStorage.setItem(LOAD_KEY, JSON.stringify({
      html: entry.html,
      fontMood: entry.fontMood,
      title: entry.title,
      imageDataUri: entry.imageDataUri,
    }));
    router.push("/studio/design?quick=1");
  }

  const cat = CONTENT_CATEGORIES.find((c) => c.id === entry.category);
  const chipColor = CATEGORY_COLORS[entry.category] ?? "#888";

  function handleCopy() {
    navigator.clipboard.writeText(entry.html).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* ignore */ });
  }

  function handleSaveEdit() {
    onUpdate(entry.id, { title, category });
    setEditing(false);
  }

  function handleDelete() {
    onDelete(entry.id);
    onClose();
  }

  const createdDate = new Date(entry.createdAt);
  const dateStr = `${createdDate.getFullYear()}.${String(createdDate.getMonth() + 1).padStart(2, "0")}.${String(createdDate.getDate()).padStart(2, "0")}`;

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <h3 style={s.headerTitle}>상세 보기</h3>
        <button type="button" style={s.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* Image */}
      <div style={s.imgWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.imageDataUri} alt={entry.title} style={s.img} />
      </div>

      {/* Info */}
      {editing ? (
        <div style={s.editSection}>
          <label style={s.label}>
            제목
            <input
              style={s.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label style={s.label}>
            카테고리
            <select
              style={s.select}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">선택 안함</option>
              {CONTENT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
          <div style={s.editActions}>
            <button type="button" style={s.cancelBtn} onClick={() => setEditing(false)}>취소</button>
            <button type="button" style={s.saveBtn} onClick={handleSaveEdit}>저장</button>
          </div>
        </div>
      ) : (
        <div style={s.infoSection}>
          <h4 style={s.entryTitle}>{entry.title}</h4>
          <div style={s.metaRow}>
            <span style={s.chip(chipColor)}>
              {cat?.label.replace(/^\[\d\]\s*/, "") ?? "미분류"}
            </span>
            <span style={s.moodBadge}>{entry.fontMood}</span>
            <span style={s.date}>{dateStr}</span>
          </div>
        </div>
      )}

      {/* Code */}
      <div style={s.codeSection}>
        <div style={s.codeLabelRow}>
          <span style={s.codeLabel}>HTML 코드</span>
          <button type="button" style={s.copyBtn} onClick={handleCopy}>
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
        <pre style={s.codeBlock}>{entry.html}</pre>
      </div>

      {/* Actions */}
      <div style={s.bottomActions}>
        <button type="button" style={s.openEditorBtn} onClick={handleOpenInEditor}>
          Design Editor에서 열기
        </button>
        {!editing && (
          <button type="button" style={s.editBtn} onClick={() => setEditing(true)}>
            편집
          </button>
        )}
        <button type="button" style={s.deleteBtn} onClick={handleDelete}>
          삭제
        </button>
      </div>
    </div>
  );
}

const s = {
  panel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "14px",
    padding: "20px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    boxShadow: "var(--shadow-card)",
    minWidth: "320px",
    maxHeight: "calc(100vh - 160px)",
    overflowY: "auto" as const,
  } as React.CSSProperties,

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  headerTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--text)",
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
    transition: "all var(--transition)",
  } as React.CSSProperties,

  imgWrap: {
    borderRadius: "var(--radius-sm)",
    overflow: "hidden",
    background: "var(--bg-secondary)",
  } as React.CSSProperties,

  img: {
    width: "100%",
    maxHeight: "280px",
    objectFit: "contain" as const,
    display: "block",
  } as React.CSSProperties,

  infoSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  } as React.CSSProperties,

  entryTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--text)",
  } as React.CSSProperties,

  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  chip: (color: string) =>
    ({
      fontSize: "10px",
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: "6px",
      color: "#fff",
      background: color,
    }) as React.CSSProperties,

  moodBadge: {
    fontSize: "10px",
    fontWeight: 500,
    padding: "3px 10px",
    borderRadius: "6px",
    background: "var(--bg-input)",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  date: {
    fontSize: "11px",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  editSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
  } as React.CSSProperties,

  label: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text-muted)",
  } as React.CSSProperties,

  input: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "13px",
    color: "var(--text)",
    outline: "none",
    transition: "border-color var(--transition)",
  } as React.CSSProperties,

  select: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "13px",
    color: "var(--text)",
    outline: "none",
    transition: "border-color var(--transition)",
  } as React.CSSProperties,

  editActions: {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
  } as React.CSSProperties,

  codeSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  } as React.CSSProperties,

  codeLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  codeLabel: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-muted)",
  } as React.CSSProperties,

  copyBtn: {
    fontSize: "11px",
    fontWeight: 500,
    padding: "4px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text-muted)",
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  codeBlock: {
    padding: "12px",
    borderRadius: "10px",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    overflow: "auto",
    maxHeight: "240px",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-all" as const,
    lineHeight: 1.5,
    border: "1px solid var(--border-light)",
  } as React.CSSProperties,

  bottomActions: {
    display: "flex",
    gap: "8px",
    borderTop: "1px solid var(--border-light)",
    paddingTop: "12px",
  } as React.CSSProperties,

  openEditorBtn: {
    padding: "8px 16px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  editBtn: {
    padding: "8px 16px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "transparent",
    color: "var(--text)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    marginLeft: "auto",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  deleteBtn: {
    padding: "8px 16px",
    borderRadius: "10px",
    border: "1px solid rgba(239,68,68,0.3)",
    background: "transparent",
    color: "var(--red)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  cancelBtn: {
    padding: "8px 16px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  saveBtn: {
    padding: "8px 16px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,
};
