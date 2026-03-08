"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { LineChart, BarChart } from "./MiniChart";

interface Demographics {
  age?: Record<string, number>;
  gender?: Record<string, number>;
  topCities?: Record<string, number>;
  topCountries?: Record<string, number>;
}

interface AccountMetrics {
  snsAccountId: string;
  platform: string;
  latestFollowers: number;
  followersGrowth: number;
  totalReach: number;
  totalEngagement: number;
  avgEngagementRate: number;
  dataPoints: number;
  demographics: Demographics | null;
  timeline: Array<{ date: string; followers: number; reach: number; engagement: number }>;
}

interface DashboardData {
  period: { days: number; since: string };
  accounts: AccountMetrics[];
  totalPublications: number;
  totalSnapshots: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const s = {
  page: { display: "flex", flexDirection: "column" as const, gap: 24 },
  section: { display: "flex", flexDirection: "column" as const, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 600, color: "var(--text)" },
  desc: { fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 },
  row: { display: "flex", gap: 8, alignItems: "center" },
  input: { width: "100%", padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: 13 },
  btn: { padding: "10px 24px", borderRadius: "var(--radius-sm)", border: "none", background: "var(--text)", color: "var(--bg)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnOutline: { padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: 12, fontWeight: 500, cursor: "pointer" },
  card: { padding: 16, borderRadius: "var(--radius-sm)", background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" as const, gap: 8 },
  statCard: { padding: 20, borderRadius: "var(--radius-sm)", background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" as const, gap: 4, textAlign: "center" as const },
  statValue: { fontSize: 28, fontWeight: 700, color: "var(--text)" },
  statLabel: { fontSize: 12, color: "var(--text-muted)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 },
  chatContainer: { display: "flex", flexDirection: "column" as const, gap: 8, maxHeight: 400, overflowY: "auto" as const, padding: 12, borderRadius: "var(--radius-sm)", background: "var(--bg-input)", border: "1px solid var(--border)" },
  chatBubble: (isUser: boolean) => ({
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.5,
    background: isUser ? "var(--text)" : "var(--bg-card)",
    color: isUser ? "var(--bg)" : "var(--text)",
    alignSelf: isUser ? "flex-end" as const : "flex-start" as const,
    maxWidth: "80%",
    whiteSpace: "pre-wrap" as const,
  }),
};

interface TopTopic {
  topic: string;
  reason: string;
  avgEngagementRate: number;
  postCount: number;
}

type Tab = "dashboard" | "chat";

export default function AnalyticsView() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [topTopics, setTopTopics] = useState<TopTopic[]>([]);
  const [loading, setLoading] = useState(true);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const [dashRes, topicsRes] = await Promise.all([
        fetch("/api/analytics/dashboard"),
        fetch("/api/analytics/top-topics"),
      ]);
      if (dashRes.ok) setDashboard(await dashRes.json());
      if (topicsRes.ok) {
        const data = await topicsRes.json();
        setTopTopics(data.topics ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function handleSendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/analytics/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) {
        setChatMessages([...newMessages, { role: "assistant", content: "오류가 발생했습니다." }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      setChatMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.content) {
                assistantContent += parsed.content;
                setChatMessages([...newMessages, { role: "assistant", content: assistantContent }]);
              }
            } catch {
              // Skip parse errors
            }
          }
        }
      }
    } finally {
      setChatLoading(false);
    }
  }

  if (loading) return <p style={s.desc}>불러오는 중...</p>;

  const totalFollowers = dashboard?.accounts.reduce((sum, a) => sum + a.latestFollowers, 0) ?? 0;
  const totalGrowth = dashboard?.accounts.reduce((sum, a) => sum + a.followersGrowth, 0) ?? 0;
  const totalReach = dashboard?.accounts.reduce((sum, a) => sum + a.totalReach, 0) ?? 0;
  const totalEngagement = dashboard?.accounts.reduce((sum, a) => sum + a.totalEngagement, 0) ?? 0;
  const avgRate = dashboard?.accounts.length
    ? dashboard.accounts.reduce((sum, a) => sum + a.avgEngagementRate, 0) / dashboard.accounts.length
    : 0;

  return (
    <div style={s.page}>
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Analytics</h2>
        <p style={s.desc}>SNS 성과를 분석하고 AI에게 인사이트를 물어보세요.</p>
      </div>

      <div style={s.row}>
        <button style={{ ...s.btnOutline, ...(tab === "dashboard" ? { background: "var(--bg-card)", fontWeight: 600 } : {}) }} onClick={() => setTab("dashboard")}>
          대시보드
        </button>
        <button style={{ ...s.btnOutline, ...(tab === "chat" ? { background: "var(--bg-card)", fontWeight: 600 } : {}) }} onClick={() => setTab("chat")}>
          AI 인사이트
        </button>
        <a
          href="/studio/analytics/design"
          style={{ ...s.btnOutline, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
        >
          디자인 분석
        </a>
      </div>

      {tab === "dashboard" && (
        <>
          {/* Summary stats */}
          <div style={s.grid}>
            <div style={s.statCard}>
              <div style={s.statValue}>{totalFollowers.toLocaleString()}</div>
              <div style={s.statLabel}>총 팔로워</div>
              {totalGrowth !== 0 && (
                <div style={{ fontSize: 12, color: totalGrowth > 0 ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                  {totalGrowth > 0 ? "+" : ""}{totalGrowth.toLocaleString()}
                </div>
              )}
            </div>
            <div style={s.statCard}>
              <div style={s.statValue}>{totalReach.toLocaleString()}</div>
              <div style={s.statLabel}>총 도달</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statValue}>{totalEngagement.toLocaleString()}</div>
              <div style={s.statLabel}>총 참여</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statValue}>{(avgRate * 100).toFixed(1)}%</div>
              <div style={s.statLabel}>평균 참여율</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statValue}>{dashboard?.totalPublications ?? 0}</div>
              <div style={s.statLabel}>발행 수</div>
            </div>
          </div>

          {/* Per-account breakdown */}
          {dashboard?.accounts.map((acc) => (
            <div key={acc.snsAccountId} style={s.card}>
              <div style={s.row}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{acc.platform}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  팔로워 {acc.latestFollowers.toLocaleString()}
                  {acc.followersGrowth !== 0 && (
                    <span style={{ color: acc.followersGrowth > 0 ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                      {" "}({acc.followersGrowth > 0 ? "+" : ""}{acc.followersGrowth.toLocaleString()})
                    </span>
                  )}
                  {" "}· 도달 {acc.totalReach.toLocaleString()} · 참여율 {(acc.avgEngagementRate * 100).toFixed(1)}%
                </span>
              </div>
              {/* Timeline charts */}
              {acc.timeline.length > 1 && (
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                  <LineChart
                    label="도달"
                    color="#3DA66E"
                    data={acc.timeline.map((t) => ({
                      label: t.date.slice(5),
                      value: t.reach,
                    }))}
                  />
                  <BarChart
                    label="참여"
                    color="#10b981"
                    data={acc.timeline.map((t) => ({
                      label: t.date.slice(5),
                      value: t.engagement,
                    }))}
                  />
                  <LineChart
                    label="팔로워"
                    color="#8b5cf6"
                    data={acc.timeline.map((t) => ({
                      label: t.date.slice(5),
                      value: t.followers,
                    }))}
                  />
                </div>
              )}
              {/* Demographics */}
              {acc.demographics && (
                <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {acc.demographics.gender && Object.keys(acc.demographics.gender).length > 0 && (
                    <div style={{ flex: "1 1 140px", minWidth: 140 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>성별</div>
                      {Object.entries(acc.demographics.gender).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
                          <span>{k === "M" ? "남성" : k === "F" ? "여성" : k}</span>
                          <span>{typeof v === "number" ? `${(v * 100).toFixed(1)}%` : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {acc.demographics.age && Object.keys(acc.demographics.age).length > 0 && (
                    <div style={{ flex: "1 1 140px", minWidth: 140 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>연령대</div>
                      {Object.entries(acc.demographics.age).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
                          <span>{k}</span>
                          <span>{typeof v === "number" ? `${(v * 100).toFixed(1)}%` : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {acc.demographics.topCities && Object.keys(acc.demographics.topCities).length > 0 && (
                    <div style={{ flex: "1 1 140px", minWidth: 140 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>상위 도시</div>
                      {Object.entries(acc.demographics.topCities).slice(0, 5).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
                          <span>{k}</span>
                          <span>{typeof v === "number" ? `${(v * 100).toFixed(1)}%` : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {acc.demographics.topCountries && Object.keys(acc.demographics.topCountries).length > 0 && (
                    <div style={{ flex: "1 1 140px", minWidth: 140 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>상위 국가</div>
                      {Object.entries(acc.demographics.topCountries).slice(0, 5).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
                          <span>{k}</span>
                          <span>{typeof v === "number" ? `${(v * 100).toFixed(1)}%` : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Top Topics */}
          {topTopics.length > 0 && (
            <div style={s.section}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>인기 주제 TOP {topTopics.length}</div>
              <div style={s.grid}>
                {topTopics.map((t, i) => (
                  <div key={i} style={s.card}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{t.topic}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>{t.reason}</div>
                    <Link
                      href={`/studio/create?topic=${encodeURIComponent(t.topic)}`}
                      style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--accent)", fontSize: 12, fontWeight: 600, textDecoration: "none", textAlign: "center" as const, marginTop: 4 }}
                    >
                      이 주제로 만들기 →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action: create content from insights */}
          {dashboard && dashboard.accounts.length > 0 && topTopics.length === 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Link
                href="/studio/create"
                style={{ padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
              >
                새 콘텐츠 만들기 →
              </Link>
            </div>
          )}

          {(!dashboard?.accounts.length) && (
            <p style={s.desc}>아직 분석 데이터가 없습니다. SNS 계정을 연결하고 콘텐츠를 발행하면 데이터가 수집됩니다.</p>
          )}
        </>
      )}

      {tab === "chat" && (
        <>
          <div style={s.chatContainer}>
            {chatMessages.length === 0 && (
              <p style={{ ...s.desc, textAlign: "center", padding: 20 }}>
                AI에게 SNS 성과에 대해 질문해보세요.<br />
                예: &quot;지난 주 참여율이 어떻게 변했나요?&quot;, &quot;어떤 시간대에 발행해야 할까요?&quot;
              </p>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} style={s.chatBubble(msg.role === "user")}>
                {msg.content}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div style={{ ...s.row, gap: 8 }}>
            <input
              style={s.input}
              placeholder="질문을 입력하세요..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
            />
            <button style={s.btn} onClick={handleSendChat} disabled={chatLoading || !chatInput.trim()}>
              {chatLoading ? "..." : "전송"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
