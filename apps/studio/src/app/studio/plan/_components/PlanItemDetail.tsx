"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PlanItem, ContentType, CategoryId } from "@/lib/studio/plan/types";
import { CONTENT_CATEGORIES } from "@/lib/studio/contentCategories";
import { openGoogleCalendar } from "@/lib/studio/plan/googleCalendarUrl";
import { downloadICS } from "@/lib/studio/plan/icsGenerator";
import { createDefaultDesignSpec } from "@/lib/studio/designEditor/defaultSlides";

interface PlanItemDetailProps {
  item: PlanItem;
  onAddToCalendar: () => void;
  onRemoveFromCalendar: () => void;
  onUpdate: (patch: Partial<PlanItem>) => void;
  onDelete: () => void;
}

const TYPES: { value: ContentType; label: string }[] = [
  { value: "post", label: "Post" },
  { value: "reels", label: "Reels" },
  { value: "promotion", label: "Promotion" },
];

export default function PlanItemDetail({
  item,
  onAddToCalendar,
  onRemoveFromCalendar,
  onUpdate,
  onDelete,
}: PlanItemDetailProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [date, setDate] = useState(item.date);
  const [type, setType] = useState<ContentType>(item.type);
  const [category, setCategory] = useState<string>(item.category);
  const [tagsText, setTagsText] = useState(item.tags.join(" "));
  const [designLoading, setDesignLoading] = useState(false);

  const handleDesignClick = useCallback(async () => {
    setDesignLoading(true);
    try {
      // Check if a project already exists for this plan item
      const res = await fetch(`/api/db/projects?planItemId=${item.id}`);
      if (res.ok) {
        const projects = (await res.json()) as { id: string }[];
        if (Array.isArray(projects) && projects.length > 0) {
          router.push(`/studio/design?project=${projects[0]!.id}`);
          return;
        }
      }
      // Create a new project linked to this plan item
      const createRes = await fetch("/api/db/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          category: item.category,
          planItemId: item.id,
          specJson: createDefaultDesignSpec(),
        }),
      });
      if (createRes.ok) {
        const created = (await createRes.json()) as { id: string };
        router.push(`/studio/design?project=${created.id}`);
      }
    } catch { /* ignore */ }
    setDesignLoading(false);
  }, [item.id, item.title, item.category, router]);

  // Sync local state when a different item is selected
  useEffect(() => {
    setTitle(item.title);
    setDescription(item.description);
    setDate(item.date);
    setType(item.type);
    setCategory(item.category);
    setTagsText(item.tags.join(" "));
    setEditing(false);
  }, [item.id, item.title, item.description, item.date, item.type, item.category, item.tags]);

  function handleSave() {
    const tags = tagsText
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    onUpdate({ title, description, date, type, category: category as CategoryId, tags });
    setEditing(false);
  }

  function handleCancel() {
    setTitle(item.title);
    setDescription(item.description);
    setDate(item.date);
    setType(item.type);
    setCategory(item.category);
    setTagsText(item.tags.join(" "));
    setEditing(false);
  }

  const categoryObj = CONTENT_CATEGORIES.find((c) => c.id === item.category);

  // ── View mode ──────────────────────────────────────────
  if (!editing) {
    return (
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <h3 style={styles.title}>{item.title}</h3>
          <button style={styles.editBtn} onClick={() => setEditing(true)}>
            편집
          </button>
        </div>

        <div style={styles.badgeRow}>
          <span style={styles.typeBadge}>
            {TYPES.find((t) => t.value === item.type)?.label ?? item.type}
          </span>
          <span style={styles.categoryBadge}>
            {categoryObj?.label ?? item.category}
          </span>
          <span style={styles.dateBadge}>{item.date}</span>
        </div>

        <div style={styles.section}>
          <label style={styles.sectionLabel}>설명</label>
          <p style={styles.description}>{item.description}</p>
        </div>

        <div style={styles.section}>
          <label style={styles.sectionLabel}>AI 선택 이유</label>
          <p style={styles.reasoning}>{item.reasoning}</p>
        </div>

        {item.tags.length > 0 && (
          <div style={styles.section}>
            <label style={styles.sectionLabel}>해시태그</label>
            <div style={styles.tagRow}>
              {item.tags.map((tag, i) => (
                <span key={i} style={styles.tag}>{tag}</span>
              ))}
            </div>
          </div>
        )}

        <div style={styles.actions}>
          <button
            style={{
              ...styles.primaryBtn,
              ...(item.addedToCalendar ? styles.primaryBtnRemove : {}),
            }}
            onClick={item.addedToCalendar ? onRemoveFromCalendar : onAddToCalendar}
          >
            {item.addedToCalendar ? "캘린더에서 제거" : "캘린더에 추가"}
          </button>
          <div style={styles.exportRow}>
            <button style={styles.exportBtn} onClick={() => openGoogleCalendar(item)}>
              Google Calendar
            </button>
            <button
              style={styles.exportBtn}
              onClick={() => downloadICS([item], `${item.title}.ics`)}
            >
              ICS 다운로드
            </button>
          </div>
          <button
            style={styles.designBtn}
            onClick={() => void handleDesignClick()}
            disabled={designLoading}
          >
            {designLoading ? "이동 중..." : "디자인 시작"}
          </button>
        </div>
      </div>
    );
  }

  // ── Edit mode ──────────────────────────────────────────
  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h3 style={styles.editTitle}>항목 편집</h3>
      </div>

      <div style={styles.field}>
        <label style={styles.sectionLabel}>제목</label>
        <input
          style={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.sectionLabel}>날짜</label>
        <input
          type="date"
          style={styles.input}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div style={styles.fieldRow}>
        <div style={{ ...styles.field, flex: 1 }}>
          <label style={styles.sectionLabel}>타입</label>
          <select
            style={styles.select}
            value={type}
            onChange={(e) => setType(e.target.value as ContentType)}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div style={{ ...styles.field, flex: 2 }}>
          <label style={styles.sectionLabel}>카테고리</label>
          <select
            style={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CONTENT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.sectionLabel}>설명</label>
        <textarea
          style={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.sectionLabel}>해시태그 (공백으로 구분)</label>
        <input
          style={styles.input}
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="#인디밴드 #콘서트 #플레이리스트"
        />
      </div>

      <div style={styles.editActions}>
        <button style={styles.saveBtn} onClick={handleSave}>저장</button>
        <button style={styles.cancelBtn} onClick={handleCancel}>취소</button>
        <button style={styles.deleteBtn} onClick={onDelete}>삭제</button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "14px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-light)",
    padding: "20px",
  } as React.CSSProperties,

  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  } as React.CSSProperties,

  title: {
    fontSize: "18px",
    fontWeight: 700,
    color: "var(--text)",
    lineHeight: 1.4,
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  editTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--text)",
  } as React.CSSProperties,

  editBtn: {
    padding: "5px 14px",
    borderRadius: "8px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-light)",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    flexShrink: 0,
    transition: "all var(--transition)",
  } as React.CSSProperties,

  badgeRow: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  typeBadge: {
    fontSize: "11px",
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: "8px",
    background: "rgba(61,166,110,0.12)",
    color: "#3DA66E",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,

  categoryBadge: {
    fontSize: "11px",
    fontWeight: 500,
    padding: "3px 10px",
    borderRadius: "8px",
    background: "var(--bg-input)",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  dateBadge: {
    fontSize: "11px",
    fontWeight: 500,
    padding: "3px 10px",
    borderRadius: "8px",
    background: "var(--bg-input)",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  } as React.CSSProperties,

  sectionLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } as React.CSSProperties,

  description: {
    fontSize: "14px",
    color: "var(--text)",
    lineHeight: 1.6,
    margin: 0,
  } as React.CSSProperties,

  reasoning: {
    fontSize: "13px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    margin: 0,
    fontStyle: "italic",
  } as React.CSSProperties,

  tagRow: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  tag: {
    fontSize: "12px",
    padding: "3px 10px",
    borderRadius: "8px",
    background: "var(--accent-light)",
    color: "var(--accent)",
    fontWeight: 500,
  } as React.CSSProperties,

  actions: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
    marginTop: "4px",
    paddingTop: "14px",
    borderTop: "1px solid var(--border-light)",
  } as React.CSSProperties,

  primaryBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: "12px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  primaryBtnRemove: {
    background: "rgba(239,68,68,0.08)",
    color: "var(--red)",
    border: "1px solid rgba(239,68,68,0.2)",
  } as React.CSSProperties,

  exportRow: {
    display: "flex",
    gap: "8px",
  } as React.CSSProperties,

  exportBtn: {
    flex: 1,
    padding: "10px",
    borderRadius: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  designBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg, #8B5CF6, #6366F1)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  // ── Edit mode styles ──────────────────────────────
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  } as React.CSSProperties,

  fieldRow: {
    display: "flex",
    gap: "10px",
  } as React.CSSProperties,

  input: {
    padding: "8px 12px",
    borderRadius: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "13px",
    outline: "none",
    fontFamily: "inherit",
  } as React.CSSProperties,

  select: {
    padding: "8px 12px",
    borderRadius: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "13px",
    outline: "none",
    fontFamily: "inherit",
  } as React.CSSProperties,

  textarea: {
    padding: "8px 12px",
    borderRadius: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "13px",
    outline: "none",
    fontFamily: "inherit",
    resize: "vertical" as const,
  } as React.CSSProperties,

  editActions: {
    display: "flex",
    gap: "8px",
    marginTop: "4px",
    paddingTop: "14px",
    borderTop: "1px solid var(--border-light)",
  } as React.CSSProperties,

  saveBtn: {
    flex: 2,
    padding: "10px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  cancelBtn: {
    flex: 1,
    padding: "10px",
    borderRadius: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text-muted)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  deleteBtn: {
    flex: 1,
    padding: "10px",
    borderRadius: "10px",
    border: "none",
    background: "rgba(239,68,68,0.08)",
    color: "var(--red)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,
};
