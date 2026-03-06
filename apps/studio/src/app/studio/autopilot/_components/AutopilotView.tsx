"use client";

import { useEffect, useState, useCallback } from "react";
import ProposalCard from "./ProposalCard";

interface SnsAccountInfo {
  id: string;
  platform: string;
  displayName: string;
}

interface AutopilotConfig {
  id: string;
  snsAccountId: string;
  personaId: string | null;
  platforms: string[];
  postsPerDay: number;
  approvalMode: string;
  isActive: boolean;
  topicKeywords: string[];
}

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

const s = {
  page: { display: "flex", flexDirection: "column" as const, gap: 24 },
  section: { display: "flex", flexDirection: "column" as const, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 600, color: "var(--text)" },
  desc: { fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 },
  row: { display: "flex", gap: 8, alignItems: "center" },
  input: { width: "100%", padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: 13 },
  select: { padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: 13 },
  btn: { padding: "10px 24px", borderRadius: "var(--radius-sm)", border: "none", background: "var(--text)", color: "var(--bg)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnOutline: { padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: 12, fontWeight: 500, cursor: "pointer" },
  card: { padding: 16, borderRadius: "var(--radius-sm)", background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" as const, gap: 8 },
  formCard: { padding: 20, borderRadius: "var(--radius-sm)", background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" as const, gap: 16 },
  badge: (color: string) => ({ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: `${color}20`, color }),
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 12 },
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  approved: "#3DA66E",
  rejected: "#888",
  published: "#22c55e",
};

export default function AutopilotView() {
  const [accounts, setAccounts] = useState<SnsAccountInfo[]>([]);
  const [configs, setConfigs] = useState<AutopilotConfig[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  // New config form
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [platforms, setPlatforms] = useState("threads");
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [approvalMode, setApprovalMode] = useState("manual");
  const [topicKeywords, setTopicKeywords] = useState("");

  const load = useCallback(async () => {
    try {
      const [accRes, cfgRes] = await Promise.all([
        fetch("/api/sns/accounts"),
        fetch("/api/autopilot"),
      ]);
      if (accRes.ok) setAccounts(await accRes.json());
      if (cfgRes.ok) {
        const cfgs: AutopilotConfig[] = await cfgRes.json();
        setConfigs(cfgs);
        // Load proposals for the first active config
        if (cfgs.length > 0) {
          const detailRes = await fetch(`/api/autopilot/${cfgs[0]!.id}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            setProposals(detail.proposals ?? []);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreateConfig() {
    if (!selectedAccountId) return;
    await fetch("/api/autopilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snsAccountId: selectedAccountId,
        platforms: platforms.split(",").map((p) => p.trim()).filter(Boolean),
        postsPerDay,
        approvalMode,
        topicKeywords: topicKeywords.split(",").map((k) => k.trim()).filter(Boolean),
        isActive: true,
      }),
    });
    setTopicKeywords("");
    load();
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/autopilot/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  async function handleDeleteConfig(id: string) {
    await fetch(`/api/autopilot/${id}`, { method: "DELETE" });
    load();
  }

  async function handleProposalAction(proposalId: string, status: "approved" | "rejected") {
    await fetch(`/api/autopilot/proposals/${proposalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  if (loading) return <p style={s.desc}>불러오는 중...</p>;

  return (
    <div style={s.page}>
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Autopilot</h2>
        <p style={s.desc}>AI가 트렌드를 분석하고 콘텐츠를 자동으로 제안/발행합니다.</p>
      </div>

      {/* Config form */}
      <div style={s.formCard}>
        <div style={s.row}>
          <select style={s.select} value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
            <option value="">계정 선택</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.displayName} ({a.platform})</option>
            ))}
          </select>
          <select style={s.select} value={approvalMode} onChange={(e) => setApprovalMode(e.target.value)}>
            <option value="manual">수동 승인</option>
            <option value="auto">자동 발행</option>
          </select>
          <select style={s.select} value={postsPerDay} onChange={(e) => setPostsPerDay(Number(e.target.value))}>
            {[1, 2, 3, 5].map((n) => (
              <option key={n} value={n}>일 {n}회</option>
            ))}
          </select>
        </div>
        <input
          style={s.input}
          placeholder="주제 키워드 (쉼표 구분: 디자인, 마케팅, AI)"
          value={topicKeywords}
          onChange={(e) => setTopicKeywords(e.target.value)}
        />
        <input
          style={s.input}
          placeholder="발행 플랫폼 (쉼표 구분: threads, instagram)"
          value={platforms}
          onChange={(e) => setPlatforms(e.target.value)}
        />
        <button style={s.btn} onClick={handleCreateConfig} disabled={!selectedAccountId}>
          Autopilot 설정 추가
        </button>
      </div>

      {/* Active configs */}
      {configs.length > 0 && (
        <div style={s.section}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>활성 설정</h3>
          <div style={s.grid}>
            {configs.map((cfg) => (
              <div key={cfg.id} style={s.card}>
                <div style={s.row}>
                  <span style={s.badge(cfg.isActive ? "#22c55e" : "#888")}>
                    {cfg.isActive ? "활성" : "비활성"}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {cfg.platforms.join(", ")} · 일 {cfg.postsPerDay}회 · {cfg.approvalMode === "manual" ? "수동 승인" : "자동 발행"}
                  </span>
                </div>
                {cfg.topicKeywords.length > 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    키워드: {cfg.topicKeywords.join(", ")}
                  </div>
                )}
                <div style={s.row}>
                  <button style={s.btnOutline} onClick={() => handleToggle(cfg.id, cfg.isActive)}>
                    {cfg.isActive ? "중지" : "시작"}
                  </button>
                  <button style={{ ...s.btnOutline, color: "#e55", borderColor: "#e553" }} onClick={() => handleDeleteConfig(cfg.id)}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proposals */}
      <div style={s.section}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>콘텐츠 제안</h3>
        {proposals.length === 0 ? (
          <p style={s.desc}>아직 제안이 없습니다. Autopilot이 활성화되면 트렌드 분석 후 제안이 생성됩니다.</p>
        ) : (
          <div style={s.grid}>
            {proposals.map((p) => (
              <ProposalCard key={p.id} proposal={p} onAction={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
