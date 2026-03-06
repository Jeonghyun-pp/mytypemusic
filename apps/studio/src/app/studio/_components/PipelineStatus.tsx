"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface StatusCounts {
  pendingPublish: number;
  pendingProposals: number;
  unreadMessages: number;
}

export default function PipelineStatus() {
  const [counts, setCounts] = useState<StatusCounts | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [pubRes, autoRes, inboxRes] = await Promise.all([
          fetch("/api/publish").then((r) => (r.ok ? r.json() : [])),
          fetch("/api/autopilot").then((r) => (r.ok ? r.json() : [])),
          fetch("/api/inbox").then((r) => (r.ok ? r.json() : { messages: [] })),
        ]);

        const pubs = Array.isArray(pubRes) ? pubRes : [];
        const pendingPublish = pubs.filter(
          (p: { status: string }) => p.status === "draft" || p.status === "scheduled",
        ).length;

        // Count pending proposals across all configs
        const configs = Array.isArray(autoRes) ? autoRes : [];
        let pendingProposals = 0;
        for (const cfg of configs) {
          if (cfg.proposals) {
            pendingProposals += (cfg.proposals as { status: string }[]).filter(
              (p) => p.status === "pending",
            ).length;
          }
        }

        const messages = Array.isArray(inboxRes.messages) ? inboxRes.messages : (Array.isArray(inboxRes) ? inboxRes : []);
        const unreadMessages = messages.filter(
          (m: { isRead: boolean }) => !m.isRead,
        ).length;

        setCounts({ pendingPublish, pendingProposals, unreadMessages });
      } catch {
        // Silently fail - status is non-essential
      }
    }
    load();
  }, []);

  if (!counts) return null;
  const { pendingPublish, pendingProposals, unreadMessages } = counts;
  if (pendingPublish === 0 && pendingProposals === 0 && unreadMessages === 0) return null;

  return (
    <div style={s.row}>
      {pendingPublish > 0 && (
        <Link href="/studio/publish" className="chip-hover" style={s.chip}>
          <span style={s.chipCount}>{pendingPublish}</span>
          <span style={s.chipLabel}>대기 중 발행물</span>
        </Link>
      )}
      {pendingProposals > 0 && (
        <Link href="/studio/autopilot" className="chip-hover" style={s.chip}>
          <span style={{ ...s.chipCount, background: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}>{pendingProposals}</span>
          <span style={s.chipLabel}>승인 대기 제안</span>
        </Link>
      )}
      {unreadMessages > 0 && (
        <Link href="/studio/inbox" className="chip-hover" style={s.chip}>
          <span style={{ ...s.chipCount, background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>{unreadMessages}</span>
          <span style={s.chipLabel}>미읽은 메시지</span>
        </Link>
      )}
    </div>
  );
}

const s = {
  row: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
  },
  chip: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: 10,
    background: "var(--bg-card)",
    border: "1px solid var(--border-light)",
    textDecoration: "none",
    transition: "all 0.15s",
  },
  chipCount: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--accent)",
    background: "var(--accent-light)",
    padding: "2px 8px",
    borderRadius: 6,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-muted)",
  },
};
