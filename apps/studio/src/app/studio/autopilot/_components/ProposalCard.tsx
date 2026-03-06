"use client";

import { useState } from "react";
import QuickPublishPanel from "../../_components/QuickPublishPanel";

interface Proposal {
  id: string;
  topic: string;
  reasoning: string;
  content: { text?: string; hashtags?: string[] };
  platform: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
}

interface Props {
  proposal: Proposal;
  onAction: () => void;
}

const CHAR_LIMITS: Record<string, number> = {
  threads: 500,
  x: 280,
  instagram: 2200,
  linkedin: 3000,
  tiktok: 2200,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  approved: "#3DA66E",
  rejected: "#888",
  published: "#22c55e",
};

export default function ProposalCard({ proposal, onAction }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(proposal.content.text ?? "");
  const [hashtags, setHashtags] = useState((proposal.content.hashtags ?? []).join(", "));
  const [showQuickPublish, setShowQuickPublish] = useState(false);
  const [acting, setActing] = useState(false);

  const limit = CHAR_LIMITS[proposal.platform] ?? 500;
  const parsedHashtags = hashtags.split(",").map((h) => h.trim()).filter(Boolean);

  async function handleApproveSchedule() {
    setActing(true);
    try {
      await fetch(`/api/autopilot/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          content: { text, hashtags: parsedHashtags },
        }),
      });
      onAction();
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    setActing(true);
    try {
      await fetch(`/api/autopilot/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      onAction();
    } finally {
      setActing(false);
    }
  }

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={s.row}>
        <span style={s.badge(STATUS_COLORS[proposal.status] ?? "#888")}>{proposal.status}</span>
        <span style={s.meta}>{proposal.platform}</span>
        <span style={s.meta}>{new Date(proposal.createdAt).toLocaleString("ko")}</span>
      </div>

      {/* Topic */}
      <div style={s.topic}>{proposal.topic}</div>
      <div style={s.reasoning}>{proposal.reasoning}</div>

      {/* Content - editable or read-only */}
      {editing ? (
        <>
          <textarea
            style={s.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
          />
          <div style={s.charCount}>
            <span style={{ color: text.length > limit ? "#ef4444" : "var(--text-muted)" }}>
              {text.length}/{limit}
            </span>
          </div>
          <input
            style={s.input}
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="해시태그 (쉼표 구분)"
          />
          <button style={s.btnSmall} onClick={() => setEditing(false)}>편집 완료</button>
        </>
      ) : (
        <>
          <div style={s.contentText}>{text}</div>
          {parsedHashtags.length > 0 && (
            <div style={s.tags}>{parsedHashtags.map((h) => `#${h}`).join(" ")}</div>
          )}
        </>
      )}

      {proposal.scheduledAt && (
        <div style={s.scheduled}>예약: {new Date(proposal.scheduledAt).toLocaleString("ko")}</div>
      )}

      {/* Actions for pending proposals */}
      {proposal.status === "pending" && (
        <div style={s.actions}>
          {!editing && (
            <button style={s.btnOutline} onClick={() => setEditing(true)}>편집</button>
          )}
          <button
            style={s.btnPrimary}
            onClick={handleApproveSchedule}
            disabled={acting}
          >
            {acting ? "처리 중..." : "승인 + 최적시간 예약"}
          </button>
          <button
            style={s.btnAccent}
            onClick={() => setShowQuickPublish(!showQuickPublish)}
          >
            즉시 발행
          </button>
          <button style={s.btnOutline} onClick={handleReject} disabled={acting}>
            거절
          </button>
        </div>
      )}

      {/* Inline quick publish */}
      {showQuickPublish && proposal.status === "pending" && (
        <QuickPublishPanel
          text={text}
          hashtags={parsedHashtags}
          onPublished={() => {
            setShowQuickPublish(false);
            onAction();
          }}
        />
      )}
    </div>
  );
}

const s = {
  card: {
    padding: 16,
    borderRadius: "var(--radius-sm)",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  row: { display: "flex", gap: 8, alignItems: "center" },
  badge: (color: string) => ({
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600 as const,
    background: `${color}20`,
    color,
  }),
  meta: { fontSize: 12, color: "var(--text-muted)" },
  topic: { fontSize: 14, fontWeight: 600, color: "var(--text)" },
  reasoning: { fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 },
  contentText: { fontSize: 13, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" as const },
  tags: { fontSize: 12, color: "var(--accent)" },
  scheduled: { fontSize: 12, color: "var(--accent)" },
  textarea: {
    width: "100%",
    padding: 10,
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 13,
    lineHeight: 1.5,
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  input: {
    width: "100%",
    padding: 8,
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 12,
  },
  charCount: { fontSize: 11, textAlign: "right" as const },
  actions: { display: "flex", gap: 6, flexWrap: "wrap" as const, marginTop: 4 },
  btnPrimary: {
    padding: "6px 14px",
    borderRadius: 6,
    border: "none",
    background: "var(--text)",
    color: "var(--bg)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnAccent: {
    padding: "6px 14px",
    borderRadius: 6,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnOutline: {
    padding: "6px 14px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    fontSize: 12,
    cursor: "pointer",
  },
  btnSmall: {
    padding: "4px 10px",
    borderRadius: 4,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    fontSize: 11,
    cursor: "pointer",
    alignSelf: "flex-start" as const,
  },
};
