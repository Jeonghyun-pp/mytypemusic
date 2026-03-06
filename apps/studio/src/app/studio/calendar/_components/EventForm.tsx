"use client";

import { useState, useEffect } from "react";
import type { CalendarEvent, ContentType, EventStatus } from "./calendarStore";
import { CONTENT_CATEGORIES } from "@/lib/studio/contentCategories";

interface EventFormProps {
  selectedDate: string | null;
  events: CalendarEvent[];
  editingEvent: CalendarEvent | null;
  onSave: (data: Omit<CalendarEvent, "id" | "createdAt">) => void;
  onUpdate: (id: string, patch: Partial<CalendarEvent>) => void;
  onDelete: (id: string) => void;
  onEdit: (event: CalendarEvent | null) => void;
}

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "post", label: "Post" },
  { value: "reels", label: "Reels" },
  { value: "promotion", label: "Promotion" },
];

const STATUSES: { value: EventStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In Progress" },
  { value: "published", label: "Published" },
];

const TYPE_COLORS: Record<string, string> = {
  post: "#3DA66E",
  reels: "#8B5CF6",
  promotion: "#F59E0B",
};

const STATUS_ICON: Record<string, string> = {
  published: "✓",
  "in-progress": "●",
  planned: "○",
};

function formatDate(dateStr: string) {
  const parts = dateStr.split("-");
  return `${parts[0]}년 ${parseInt(parts[1] ?? "0")}월 ${parseInt(parts[2] ?? "0")}일`;
}

export default function EventForm({
  selectedDate,
  events,
  editingEvent,
  onSave,
  onUpdate,
  onDelete,
  onEdit,
}: EventFormProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ContentType>("post");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<EventStatus>("planned");
  const [note, setNote] = useState("");

  // sync form fields when editing
  useEffect(() => {
    if (editingEvent) {
      setTitle(editingEvent.title);
      setType(editingEvent.type);
      setCategory(editingEvent.category ?? "");
      setStatus(editingEvent.status);
      setNote(editingEvent.note);
    } else {
      setTitle("");
      setType("post");
      setCategory("");
      setStatus("planned");
      setNote("");
    }
  }, [editingEvent]);

  if (!selectedDate) {
    return (
      <div style={styles.panel}>
        <p style={styles.placeholder}>날짜를 선택하세요</p>
      </div>
    );
  }

  const dateEvents = events.filter((e) => e.date === selectedDate);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingEvent) {
      onUpdate(editingEvent.id, { title, type, category, status, note });
      onEdit(null);
    } else {
      onSave({ date: selectedDate!, title, type, category, status, note });
    }

    setTitle("");
    setType("post");
    setCategory("");
    setStatus("planned");
    setNote("");
  }

  return (
    <div style={styles.panel}>
      <h3 style={styles.dateTitle}>{formatDate(selectedDate)}</h3>

      {/* Event list */}
      {dateEvents.length > 0 && (
        <div style={styles.eventList}>
          {dateEvents.map((ev) => (
            <div
              key={ev.id}
              style={styles.eventItem(editingEvent?.id === ev.id)}
            >
              <div style={styles.eventHeader}>
                <span style={styles.eventChip(ev.type)}>
                  {STATUS_ICON[ev.status]} {ev.type}
                </span>
                <span style={styles.eventTitle}>{ev.title}</span>
              </div>
              {ev.note && <p style={styles.eventNote}>{ev.note}</p>}
              <div style={styles.eventActions}>
                <button
                  style={styles.btnSmall}
                  onClick={() => onEdit(editingEvent?.id === ev.id ? null : ev)}
                >
                  {editingEvent?.id === ev.id ? "Cancel" : "Edit"}
                </button>
                <button
                  style={{ ...styles.btnSmall, color: "var(--red)" }}
                  onClick={() => onDelete(ev.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} style={styles.form}>
        <h4 style={styles.formTitle}>
          {editingEvent ? "일정 편집" : "새 일정 추가"}
        </h4>

        <label style={styles.label}>
          제목
          <input
            style={styles.input}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="일정 제목"
            required
          />
        </label>

        <label style={styles.label}>
          타입
          <div style={styles.radioGroup}>
            {CONTENT_TYPES.map((ct) => (
              <label key={ct.value} style={styles.radioLabel}>
                <input
                  type="radio"
                  name="type"
                  value={ct.value}
                  checked={type === ct.value}
                  onChange={() => setType(ct.value)}
                />
                <span
                  style={{
                    ...styles.radioChip,
                    background:
                      type === ct.value ? TYPE_COLORS[ct.value] : "var(--bg-input)",
                    color: type === ct.value ? "#fff" : "var(--text-muted)",
                  }}
                >
                  {ct.label}
                </span>
              </label>
            ))}
          </div>
        </label>

        <label style={styles.label}>
          카테고리
          <select
            style={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">선택 안함</option>
            {CONTENT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          상태
          <select
            style={styles.select}
            value={status}
            onChange={(e) => setStatus(e.target.value as EventStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          메모
          <textarea
            style={styles.textarea}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="메모 (선택)"
            rows={3}
          />
        </label>

        <div style={styles.formActions}>
          {editingEvent && (
            <button
              type="button"
              style={styles.btnCancel}
              onClick={() => onEdit(null)}
            >
              취소
            </button>
          )}
          <button type="submit" style={styles.btnSubmit}>
            {editingEvent ? "수정" : "추가"}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  panel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    padding: "20px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    boxShadow: "var(--shadow-card)",
    minWidth: "300px",
    maxHeight: "calc(100vh - 160px)",
    overflowY: "auto" as const,
  } as React.CSSProperties,

  placeholder: {
    color: "var(--text-muted)",
    fontSize: "14px",
    textAlign: "center" as const,
    padding: "40px 0",
  } as React.CSSProperties,

  dateTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--text)",
  } as React.CSSProperties,

  eventList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  } as React.CSSProperties,

  eventItem: (active: boolean) =>
    ({
      padding: "12px",
      borderRadius: "10px",
      border: active ? "1.5px solid var(--accent)" : "1px solid var(--border-light)",
      background: active ? "var(--accent-light)" : "transparent",
      transition: "all var(--transition)",
    }) as React.CSSProperties,

  eventHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "4px",
  } as React.CSSProperties,

  eventChip: (type: string) =>
    ({
      fontSize: "10px",
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: "6px",
      color: "#fff",
      background: TYPE_COLORS[type] ?? "#888",
      whiteSpace: "nowrap" as const,
    }) as React.CSSProperties,

  eventTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text)",
  } as React.CSSProperties,

  eventNote: {
    fontSize: "12px",
    color: "var(--text-muted)",
    marginBottom: "6px",
  } as React.CSSProperties,

  eventActions: {
    display: "flex",
    gap: "8px",
  } as React.CSSProperties,

  btnSmall: {
    fontSize: "11px",
    fontWeight: 500,
    color: "var(--accent)",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "2px 4px",
    transition: "color var(--transition)",
  } as React.CSSProperties,

  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
    borderTop: "1px solid var(--border-light)",
    paddingTop: "16px",
  } as React.CSSProperties,

  formTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text)",
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

  textarea: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "13px",
    color: "var(--text)",
    outline: "none",
    resize: "vertical" as const,
    transition: "border-color var(--transition)",
  } as React.CSSProperties,

  radioGroup: {
    display: "flex",
    gap: "6px",
    marginTop: "2px",
  } as React.CSSProperties,

  radioLabel: {
    display: "flex",
    cursor: "pointer",
  } as React.CSSProperties,

  radioChip: {
    fontSize: "12px",
    fontWeight: 500,
    padding: "5px 12px",
    borderRadius: "8px",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  formActions: {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
  } as React.CSSProperties,

  btnSubmit: {
    padding: "9px 22px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  btnCancel: {
    padding: "9px 18px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,
};
