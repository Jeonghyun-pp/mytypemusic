"use client";

import { useState } from "react";

interface Props {
  onCreated: () => void;
}

export default function ManualTopicForm({ onCreated }: Props) {
  const [topic, setTopic] = useState("");
  const [angle, setAngle] = useState("");
  const [contentType, setContentType] = useState("blog");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          angle: angle.trim(),
          contentType,
          sourceType: "manual",
        }),
      });
      if (res.ok) {
        setTopic("");
        setAngle("");
        onCreated();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <input
        style={s.input}
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="주제 제목"
        required
      />
      <input
        style={s.input}
        value={angle}
        onChange={(e) => setAngle(e.target.value)}
        placeholder="각도 (선택)"
      />
      <div style={s.row}>
        <select
          style={s.select}
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
        >
          <option value="blog">블로그</option>
          <option value="sns">SNS</option>
          <option value="carousel">카드뉴스</option>
          <option value="review">리뷰</option>
        </select>
        <button style={s.submitBtn} type="submit" disabled={saving || !topic.trim()}>
          {saving ? "저장 중..." : "추가"}
        </button>
      </div>
    </form>
  );
}

const s = {
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    padding: 12,
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border-light)",
  },
  input: {
    padding: "7px 10px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
  },
  row: {
    display: "flex",
    gap: 6,
  },
  select: {
    flex: 1,
    padding: "7px 10px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 12,
    outline: "none",
  },
  submitBtn: {
    padding: "7px 16px",
    borderRadius: 6,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
};
