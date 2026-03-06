"use client";

import { useState, useEffect, useCallback } from "react";

interface SnsAccount {
  id: string;
  platform: string;
  displayName: string;
  profileImageUrl?: string;
  isActive: boolean;
}

interface Props {
  text: string;
  hashtags?: string[];
  mediaUrls?: string[];
  onPublished?: () => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  threads: "Threads",
  instagram: "Instagram",
  x: "X",
  linkedin: "LinkedIn",
  wordpress: "WordPress",
  youtube: "YouTube",
  tiktok: "TikTok",
};

export default function QuickPublishPanel({ text, hashtags = [], mediaUrls = [], onPublished }: Props) {
  const [accounts, setAccounts] = useState<SnsAccount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  useEffect(() => {
    fetch("/api/sns/accounts")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SnsAccount[]) => setAccounts(data.filter((a) => a.isActive)))
      .catch(() => {});
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === accounts.length ? new Set() : new Set(accounts.map((a) => a.id)),
    );
  }, [accounts]);

  async function handlePublish() {
    if (!selected.size || publishing) return;
    setPublishing(true);
    setResult(null);
    try {
      const res = await fetch("/api/publish/multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountIds: Array.from(selected),
          content: { text, hashtags, mediaUrls: mediaUrls.length ? mediaUrls : undefined },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const success = data.success?.length ?? 0;
        const failed = data.failed?.length ?? 0;
        setResult({ success, failed });
        if (success > 0) onPublished?.();
      }
    } finally {
      setPublishing(false);
    }
  }

  if (!accounts.length) return null;

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span style={s.title}>바로 발행</span>
        <button style={s.selectAll} onClick={selectAll}>
          {selected.size === accounts.length ? "전체 해제" : "전체 선택"}
        </button>
      </div>

      <div style={s.accountList}>
        {accounts.map((a) => (
          <label key={a.id} style={s.accountItem}>
            <input
              type="checkbox"
              checked={selected.has(a.id)}
              onChange={() => toggle(a.id)}
              style={s.checkbox}
            />
            <span style={s.platform}>{PLATFORM_LABELS[a.platform] ?? a.platform}</span>
            <span style={s.displayName}>{a.displayName}</span>
          </label>
        ))}
      </div>

      <div style={s.preview}>
        <div style={s.previewText}>
          {text.slice(0, 120)}{text.length > 120 ? "..." : ""}
        </div>
        {hashtags.length > 0 && (
          <div style={s.previewTags}>
            {hashtags.map((h, i) => <span key={i} style={s.tag}>#{h}</span>)}
          </div>
        )}
      </div>

      <button
        style={{ ...s.publishBtn, opacity: !selected.size || publishing ? 0.5 : 1 }}
        onClick={handlePublish}
        disabled={!selected.size || publishing}
      >
        {publishing
          ? "발행 중..."
          : `${selected.size}개 플랫폼에 발행`}
      </button>

      {result && (
        <div style={s.result}>
          {result.success > 0 && <span style={s.resultOk}>{result.success}개 성공</span>}
          {result.failed > 0 && <span style={s.resultFail}>{result.failed}개 실패</span>}
        </div>
      )}
    </div>
  );
}

const s = {
  panel: {
    padding: 16,
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "var(--bg-card)",
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 13, fontWeight: 600, color: "var(--text)" },
  selectAll: {
    fontSize: 11,
    color: "var(--accent)",
    background: "none",
    border: "none",
    cursor: "pointer",
    textDecoration: "underline" as const,
  },
  accountList: { display: "flex", flexDirection: "column" as const, gap: 6 },
  accountItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "var(--text)",
    cursor: "pointer",
  },
  checkbox: { accentColor: "var(--accent)" },
  platform: { fontWeight: 600, minWidth: 80 },
  displayName: { color: "var(--text-muted)", fontSize: 12 },
  preview: {
    padding: 10,
    borderRadius: 6,
    background: "var(--bg-input)",
    fontSize: 12,
    color: "var(--text-muted)",
    lineHeight: 1.5,
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  previewText: {},
  previewTags: { display: "flex", gap: 4, flexWrap: "wrap" as const },
  tag: { fontSize: 11, color: "var(--accent)" },
  publishBtn: {
    padding: "10px 20px",
    borderRadius: 6,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
  result: { display: "flex", gap: 8, fontSize: 12 },
  resultOk: { color: "#10b981", fontWeight: 600 },
  resultFail: { color: "#ef4444", fontWeight: 600 },
};
