"use client";

import { useEffect, useState, useCallback } from "react";

interface SnsAccountInfo { id: string; platform: string; displayName: string; }

interface Campaign {
  id: string;
  snsAccountId: string;
  name: string;
  keywords: string[];
  platforms: string[];
  commentMode: string;
  dailyLimit: number;
  todayCount: number;
  operatingStart: number;
  operatingEnd: number;
  isActive: boolean;
  tosWarningAcked: boolean;
}

interface CommentLog {
  id: string;
  platform: string;
  targetPostUrl: string;
  commentText: string;
  status: string;
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
  warning: { padding: 12, borderRadius: "var(--radius-sm)", background: "#f59e0b10", border: "1px solid #f59e0b30", fontSize: 12, color: "#f59e0b", lineHeight: 1.5 },
};

export default function CampaignsView() {
  const [accounts, setAccounts] = useState<SnsAccountInfo[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<CommentLog[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // New campaign form
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [dailyLimit, setDailyLimit] = useState(10);
  const [aiInstructions, setAiInstructions] = useState("");

  const load = useCallback(async () => {
    try {
      const [accRes, cmpRes] = await Promise.all([
        fetch("/api/sns/accounts"),
        fetch("/api/campaigns"),
      ]);
      if (accRes.ok) setAccounts(await accRes.json());
      if (cmpRes.ok) setCampaigns(await cmpRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load logs when a campaign is selected
  useEffect(() => {
    if (!selectedCampaignId) return;
    fetch(`/api/campaigns/${selectedCampaignId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.logs) setLogs(data.logs); })
      .catch(() => {});
  }, [selectedCampaignId]);

  async function handleCreate() {
    if (!accountId || !name || !keywords) return;
    await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snsAccountId: accountId,
        name,
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        dailyLimit,
        aiInstructions: aiInstructions || null,
      }),
    });
    setName("");
    setKeywords("");
    setAiInstructions("");
    load();
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  async function handleAckTos(id: string) {
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tosWarningAcked: true }),
    });
    load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (selectedCampaignId === id) {
      setSelectedCampaignId(null);
      setLogs([]);
    }
    load();
  }

  if (loading) return <p style={s.desc}>불러오는 중...</p>;

  return (
    <div style={s.page}>
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Keyword Campaigns</h2>
        <p style={s.desc}>키워드 기반으로 관련 게시물을 찾아 AI 댓글을 자동으로 작성합니다.</p>
      </div>

      {/* TOS Warning */}
      <div style={s.warning}>
        자동 댓글 기능은 각 플랫폼의 이용약관(TOS)을 준수해야 합니다.
        과도한 사용은 계정 제한의 원인이 될 수 있습니다.
        일일 한도를 적절히 설정하고, 자연스러운 댓글 작성을 권장합니다.
      </div>

      {/* Create form */}
      <div style={s.formCard}>
        <div style={s.row}>
          <select style={s.select} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">계정 선택</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.displayName} ({a.platform})</option>
            ))}
          </select>
          <input style={{ ...s.input, maxWidth: 200 }} placeholder="캠페인 이름" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <input
          style={s.input}
          placeholder="키워드 (쉼표 구분: 디자인, 마케팅, 브랜딩)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        <div style={s.row}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>일일 한도:</label>
          <select style={s.select} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))}>
            {[5, 10, 15, 20, 30].map((n) => (
              <option key={n} value={n}>{n}회</option>
            ))}
          </select>
        </div>
        <input
          style={s.input}
          placeholder="AI 지시사항 (선택, 예: 전문적이고 도움이 되는 톤으로)"
          value={aiInstructions}
          onChange={(e) => setAiInstructions(e.target.value)}
        />
        <button style={s.btn} onClick={handleCreate} disabled={!accountId || !name || !keywords}>
          캠페인 생성
        </button>
      </div>

      {/* Campaign list */}
      {campaigns.length > 0 && (
        <div style={s.section}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>캠페인 목록</h3>
          <div style={s.grid}>
            {campaigns.map((c) => (
              <div
                key={c.id}
                style={{ ...s.card, cursor: "pointer", ...(selectedCampaignId === c.id ? { borderColor: "var(--accent)" } : {}) }}
                onClick={() => setSelectedCampaignId(c.id)}
              >
                <div style={s.row}>
                  <span style={s.badge(c.isActive ? "#22c55e" : "#888")}>{c.isActive ? "활성" : "비활성"}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{c.name}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  키워드: {c.keywords.join(", ")} · 오늘 {c.todayCount}/{c.dailyLimit}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  운영시간: {c.operatingStart}:00 ~ {c.operatingEnd}:00
                </div>
                <div style={s.row}>
                  {!c.tosWarningAcked ? (
                    <button style={{ ...s.btnOutline, color: "#f59e0b", borderColor: "#f59e0b40" }} onClick={(e) => { e.stopPropagation(); handleAckTos(c.id); }}>
                      TOS 경고 확인
                    </button>
                  ) : (
                    <button style={s.btnOutline} onClick={(e) => { e.stopPropagation(); handleToggle(c.id, c.isActive); }}>
                      {c.isActive ? "중지" : "시작"}
                    </button>
                  )}
                  <button style={{ ...s.btnOutline, color: "#e55", borderColor: "#e553" }} onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comment logs */}
      {selectedCampaignId && (
        <div style={s.section}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>댓글 로그</h3>
          {logs.length === 0 ? (
            <p style={s.desc}>아직 댓글 기록이 없습니다.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {logs.map((log) => (
                <div key={log.id} style={{ ...s.card, padding: 12 }}>
                  <div style={s.row}>
                    <span style={s.badge(log.status === "posted" ? "#22c55e" : log.status === "failed" ? "#ef4444" : "#888")}>
                      {log.status}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {log.platform} · {new Date(log.createdAt).toLocaleString("ko")}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.4 }}>{log.commentText}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
