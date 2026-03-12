"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import TopicChat from "./TopicChat";

interface TopicMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  topicUpdate?: Record<string, unknown> | null;
  createdAt: string;
}

interface TopicDraftFull {
  id: string;
  topic: string;
  angle: string;
  reasoning: string;
  contentType: string;
  status: string;
  sourceType: string;
  sourceData: unknown;
  trendSources: string[];
  relatedEntities: string[];
  formats: { sns?: string; blog?: string; carousel?: string } | null;
  personaId: string | null;
  pipelineRunId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: TopicMessage[];
}

interface Props {
  draftId: string;
  onUpdated: () => void;
  onDeleted: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  saved: "저장됨",
  refining: "다듬는 중",
  refined: "완료",
  sent: "발행됨",
};

const FORMAT_TABS = [
  { key: "sns", label: "SNS" },
  { key: "blog", label: "블로그" },
  { key: "carousel", label: "카드뉴스" },
] as const;

export default function TopicDraftDetail({ draftId, onUpdated, onDeleted }: Props) {
  const [draft, setDraft] = useState<TopicDraftFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [formatTab, setFormatTab] = useState<"sns" | "blog" | "carousel">("sns");
  const [launching, setLaunching] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDraft = useCallback(() => {
    setLoading(true);
    fetch(`/api/topics/${draftId}`)
      .then((r) => r.json())
      .then((d: TopicDraftFull) => setDraft(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [draftId]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  async function handleLaunch(target: string) {
    if (!draft || launching) return;
    setLaunching(target);
    try {
      const res = await fetch(`/api/topics/${draftId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, personaId: draft.personaId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { redirectUrl?: string };
        onUpdated();
        loadDraft();
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        }
      }
    } finally {
      setLaunching(null);
    }
  }

  async function handleDelete() {
    if (!confirm("이 주제를 삭제하시겠습니까?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/topics/${draftId}`, { method: "DELETE" });
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  async function handleMarkRefined() {
    await fetch(`/api/topics/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "refined" }),
    });
    loadDraft();
    onUpdated();
  }

  if (loading) {
    return <div style={s.loadingState}>불러오는 중...</div>;
  }
  if (!draft) {
    return <div style={s.loadingState}>주제를 찾을 수 없습니다</div>;
  }

  return (
    <div style={s.wrapper}>
      {/* Header: topic + status */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <h2 style={s.topicTitle}>{draft.topic}</h2>
          {draft.angle && <div style={s.angle}>{draft.angle}</div>}
        </div>
        <div style={s.headerRight}>
          <span style={s.statusBadge}>
            {STATUS_LABELS[draft.status] ?? draft.status}
          </span>
          <button
            style={s.deleteBtn}
            onClick={handleDelete}
            disabled={deleting}
          >
            삭제
          </button>
        </div>
      </div>

      {/* Metadata */}
      {draft.reasoning && (
        <div style={s.reasoning}>{draft.reasoning}</div>
      )}

      {draft.trendSources.length > 0 && (
        <div style={s.chipRow}>
          {draft.trendSources.map((ts, i) => (
            <span key={i} style={s.trendChip}>{ts}</span>
          ))}
        </div>
      )}

      {/* Format previews */}
      {draft.formats && (
        <div style={s.formatSection}>
          <div style={s.formatTabs}>
            {FORMAT_TABS.map((tab) => (
              <button
                key={tab.key}
                style={{
                  ...s.formatTab,
                  ...(formatTab === tab.key ? s.formatTabActive : {}),
                }}
                onClick={() => setFormatTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={s.formatContent}>
            {draft.formats[formatTab] || "미리보기 없음"}
          </div>
        </div>
      )}

      {/* Chat */}
      <div style={s.chatSection}>
        <div style={s.chatHeader}>대화</div>
        <TopicChat
          draftId={draftId}
          messages={draft.messages}
          onNewMessage={() => {
            loadDraft();
            onUpdated();
          }}
        />
      </div>

      {/* Actions */}
      <div style={s.actionSection}>
        {draft.status !== "refined" && draft.status !== "sent" && (
          <button style={s.refineBtn} onClick={handleMarkRefined}>
            다듬기 완료
          </button>
        )}
        <div style={s.launchRow}>
          <button
            style={s.launchBtn}
            onClick={() => handleLaunch("blog")}
            disabled={!!launching}
          >
            {launching === "blog" ? "..." : "블로그 생성"}
          </button>
          <Link
            href={`/studio/publish?text=${encodeURIComponent(draft.formats?.sns ?? draft.topic)}`}
            style={s.launchBtn}
          >
            SNS 발행
          </Link>
          <Link
            href={`/studio/design?quick=1&topic=${encodeURIComponent(draft.topic)}&carousel=${encodeURIComponent(draft.formats?.carousel ?? "")}`}
            style={s.launchBtn}
          >
            디자인 에디터
          </Link>
          <button
            style={{ ...s.launchBtn, ...s.launchE2e }}
            onClick={() => handleLaunch("e2e")}
            disabled={!!launching}
          >
            {launching === "e2e" ? "..." : "E2E 파이프라인"}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border-light)",
    padding: 20,
  },
  loadingState: {
    display: "flex",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    height: 400,
    color: "var(--text-muted)",
    fontSize: 14,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  topicTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
    lineHeight: 1.3,
  },
  angle: {
    fontSize: 13,
    color: "var(--text-muted)",
    marginTop: 4,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 6,
    background: "var(--accent-light)",
    color: "var(--accent)",
  },
  deleteBtn: {
    fontSize: 11,
    color: "var(--text-muted)",
    background: "none",
    border: "none",
    cursor: "pointer",
    textDecoration: "underline" as const,
  },
  reasoning: {
    fontSize: 13,
    color: "var(--text-muted)",
    lineHeight: 1.5,
    padding: "8px 12px",
    background: "var(--bg-input)",
    borderRadius: 6,
  },
  chipRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
  },
  trendChip: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 4,
    background: "var(--bg-input)",
    color: "var(--text-muted)",
  },
  formatSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  formatTabs: {
    display: "flex",
    gap: 4,
  },
  formatTab: {
    padding: "4px 12px",
    borderRadius: 6,
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text-muted)",
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
  },
  formatTabActive: {
    background: "var(--accent-light)",
    color: "var(--accent)",
    borderColor: "var(--accent)",
  },
  formatContent: {
    padding: "10px 12px",
    background: "var(--bg-input)",
    borderRadius: 6,
    fontSize: 12,
    color: "var(--text)",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap" as const,
  },
  chatSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  chatHeader: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
  },
  actionSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    paddingTop: 8,
    borderTop: "1px solid var(--border-light)",
  },
  refineBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid var(--green, #22c55e)",
    background: "rgba(34,197,94,0.1)",
    color: "var(--green, #22c55e)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    alignSelf: "flex-start" as const,
  },
  launchRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
  },
  launchBtn: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
    textAlign: "center" as const,
    minWidth: 120,
  },
  launchE2e: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
  },
};
