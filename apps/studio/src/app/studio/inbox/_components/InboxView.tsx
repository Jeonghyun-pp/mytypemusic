"use client";

import { useEffect, useState, useCallback } from "react";

interface Message {
  id: string;
  platform: string;
  senderName: string;
  senderHandle: string;
  messageType: string;
  body: string;
  classification: string | null;
  sentiment: string | null;
  priority: string;
  autoReplied: boolean;
  autoReplyText: string | null;
  isRead: boolean;
  receivedAt: string;
}

interface AutoReplyRule {
  id: string;
  snsAccountId: string;
  name: string;
  isActive: boolean;
  triggerType: string;
  triggerValue: string;
  replyTemplate: string;
  useAi: boolean;
}

interface SnsAccountInfo {
  id: string;
  platform: string;
  displayName: string;
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
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c55e",
  neutral: "#888",
  negative: "#ef4444",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#888",
  normal: "#3DA66E",
  high: "#f59e0b",
  urgent: "#ef4444",
};

type Tab = "messages" | "rules";

export default function InboxView() {
  const [tab, setTab] = useState<Tab>("messages");
  const [messages, setMessages] = useState<Message[]>([]);
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [accounts, setAccounts] = useState<SnsAccountInfo[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  // Reply state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);

  // New rule form
  const [ruleAccountId, setRuleAccountId] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [ruleTriggerType, setRuleTriggerType] = useState("classification");
  const [ruleTriggerValue, setRuleTriggerValue] = useState("question");
  const [ruleTemplate, setRuleTemplate] = useState("");
  const [ruleUseAi, setRuleUseAi] = useState(false);

  const loadMessages = useCallback(async () => {
    const query = filter === "unread" ? "?filter=unread" : filter !== "all" ? `?classification=${filter}` : "";
    const res = await fetch(`/api/inbox${query}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    }
  }, [filter]);

  const loadRules = useCallback(async () => {
    const res = await fetch("/api/inbox/rules");
    if (res.ok) setRules(await res.json());
  }, []);

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/sns/accounts");
    if (res.ok) setAccounts(await res.json());
  }, []);

  useEffect(() => {
    Promise.all([loadMessages(), loadRules(), loadAccounts()]).finally(() => setLoading(false));
  }, [loadMessages, loadRules, loadAccounts]);

  async function handleMarkRead(id: string) {
    await fetch(`/api/inbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    loadMessages();
  }

  async function handleReply(id: string) {
    if (!replyText.trim()) return;
    setReplySending(true);
    try {
      const res = await fetch(`/api/inbox/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText.trim() }),
      });
      if (res.ok) {
        setReplyingTo(null);
        setReplyText("");
        loadMessages();
      } else {
        const data = await res.json();
        alert(`전송 실패: ${data.error ?? "unknown error"}`);
      }
    } finally {
      setReplySending(false);
    }
  }

  function handleStartReply(id: string, suggestedText?: string | null) {
    setReplyingTo(id);
    setReplyText(suggestedText ?? "");
  }

  async function handleCreateRule() {
    if (!ruleAccountId || !ruleName) return;
    await fetch("/api/inbox/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snsAccountId: ruleAccountId,
        name: ruleName,
        triggerType: ruleTriggerType,
        triggerValue: ruleTriggerValue,
        replyTemplate: ruleTemplate,
        useAi: ruleUseAi,
      }),
    });
    setRuleName("");
    setRuleTemplate("");
    loadRules();
  }

  async function handleToggleRule(id: string, isActive: boolean) {
    await fetch(`/api/inbox/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    loadRules();
  }

  async function handleDeleteRule(id: string) {
    await fetch(`/api/inbox/rules/${id}`, { method: "DELETE" });
    loadRules();
  }

  if (loading) return <p style={s.desc}>불러오는 중...</p>;

  return (
    <div style={s.page}>
      <div style={s.section}>
        <h2 style={s.sectionTitle}>
          Inbox {unreadCount > 0 && <span style={s.badge("#ef4444")}>{unreadCount}</span>}
        </h2>
        <p style={s.desc}>SNS 댓글과 DM을 한 곳에서 관리하고, AI 자동 응답 규칙을 설정합니다.</p>
      </div>

      {/* Tab toggle */}
      <div style={s.row}>
        <button
          style={{ ...s.btnOutline, ...(tab === "messages" ? { background: "var(--bg-card)", fontWeight: 600 } : {}) }}
          onClick={() => setTab("messages")}
        >
          메시지
        </button>
        <button
          style={{ ...s.btnOutline, ...(tab === "rules" ? { background: "var(--bg-card)", fontWeight: 600 } : {}) }}
          onClick={() => setTab("rules")}
        >
          자동응답 규칙
        </button>
      </div>

      {tab === "messages" && (
        <>
          {/* Filter */}
          <div style={s.row}>
            {["all", "unread", "question", "praise", "complaint", "spam"].map((f) => (
              <button
                key={f}
                style={{ ...s.btnOutline, fontSize: 11, padding: "4px 10px", ...(filter === f ? { background: "var(--bg-card)", fontWeight: 600 } : {}) }}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "전체" : f === "unread" ? "읽지 않음" : f}
              </button>
            ))}
          </div>

          {messages.length === 0 ? (
            <p style={s.desc}>메시지가 없습니다.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    ...s.card,
                    opacity: msg.isRead ? 0.7 : 1,
                    borderLeftWidth: 3,
                    borderLeftColor: msg.isRead ? "var(--border)" : "var(--accent)",
                  }}
                >
                  <div style={s.row}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{msg.senderName}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>@{msg.senderHandle}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{msg.platform} · {msg.messageType}</span>
                    {msg.classification && (
                      <span style={s.badge(SENTIMENT_COLORS[msg.sentiment ?? "neutral"] ?? "#888")}>{msg.classification}</span>
                    )}
                    <span style={s.badge(PRIORITY_COLORS[msg.priority] ?? "#888")}>{msg.priority}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{msg.body}</div>
                  {msg.autoReplied && msg.autoReplyText && (
                    <div style={{ fontSize: 12, color: "var(--accent)", padding: "8px 12px", background: "var(--accent-light)", borderRadius: 6, lineHeight: 1.4 }}>
                      전송됨: {msg.autoReplyText}
                    </div>
                  )}
                  {!msg.autoReplied && msg.autoReplyText && (
                    <div style={{ fontSize: 12, color: "#f59e0b", padding: "8px 12px", background: "#f59e0b08", borderRadius: 6, lineHeight: 1.4 }}>
                      전송 대기: {msg.autoReplyText}
                    </div>
                  )}
                  <div style={s.row}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {new Date(msg.receivedAt).toLocaleString("ko")}
                    </span>
                    {!msg.isRead && (
                      <button style={{ ...s.btnOutline, fontSize: 11, padding: "2px 8px" }} onClick={() => handleMarkRead(msg.id)}>
                        읽음 처리
                      </button>
                    )}
                    {!msg.autoReplied && (
                      <button
                        style={{ ...s.btnOutline, fontSize: 11, padding: "2px 8px" }}
                        onClick={() => handleStartReply(msg.id)}
                      >
                        답장
                      </button>
                    )}
                    {!msg.autoReplied && msg.autoReplyText && (
                      <button
                        style={{ ...s.btnOutline, fontSize: 11, padding: "2px 8px", color: "#8b5cf6", borderColor: "#8b5cf633" }}
                        onClick={() => handleStartReply(msg.id, msg.autoReplyText)}
                      >
                        AI 추천 사용
                      </button>
                    )}
                  </div>
                  {/* Reply form */}
                  {replyingTo === msg.id && (
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 4 }}>
                      <textarea
                        style={{ ...s.input, minHeight: 60, resize: "vertical" }}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="답장 내용을 입력하세요..."
                        disabled={replySending}
                      />
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                        <button
                          style={{ ...s.btn, fontSize: 12, padding: "8px 16px", opacity: replySending ? 0.5 : 1 }}
                          onClick={() => handleReply(msg.id)}
                          disabled={replySending || !replyText.trim()}
                        >
                          {replySending ? "전송중..." : "전송"}
                        </button>
                        <button
                          style={{ ...s.btnOutline, fontSize: 11, padding: "4px 12px" }}
                          onClick={() => { setReplyingTo(null); setReplyText(""); }}
                          disabled={replySending}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "rules" && (
        <>
          {/* New rule form */}
          <div style={s.formCard}>
            <div style={s.row}>
              <select style={s.select} value={ruleAccountId} onChange={(e) => setRuleAccountId(e.target.value)}>
                <option value="">계정 선택</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.displayName}</option>
                ))}
              </select>
              <input style={{ ...s.input, maxWidth: 200 }} placeholder="규칙 이름" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
            </div>
            <div style={s.row}>
              <select style={s.select} value={ruleTriggerType} onChange={(e) => setRuleTriggerType(e.target.value)}>
                <option value="classification">분류 기반</option>
                <option value="keyword">키워드 기반</option>
                <option value="sentiment">감정 기반</option>
                <option value="all">모든 메시지</option>
              </select>
              <input style={s.input} placeholder="트리거 값 (예: question, 감사, negative)" value={ruleTriggerValue} onChange={(e) => setRuleTriggerValue(e.target.value)} />
            </div>
            <div style={s.row}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                <input type="checkbox" checked={ruleUseAi} onChange={(e) => setRuleUseAi(e.target.checked)} />
                AI 응답 생성
              </label>
            </div>
            {!ruleUseAi && (
              <input
                style={s.input}
                placeholder="응답 템플릿 ({{senderName}} 사용 가능)"
                value={ruleTemplate}
                onChange={(e) => setRuleTemplate(e.target.value)}
              />
            )}
            <button style={s.btn} onClick={handleCreateRule} disabled={!ruleAccountId || !ruleName}>
              규칙 추가
            </button>
          </div>

          {/* Existing rules */}
          {rules.length === 0 ? (
            <p style={s.desc}>등록된 규칙이 없습니다.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rules.map((rule) => (
                <div key={rule.id} style={s.card}>
                  <div style={s.row}>
                    <span style={s.badge(rule.isActive ? "#22c55e" : "#888")}>{rule.isActive ? "활성" : "비활성"}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{rule.name}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {rule.triggerType}: {rule.triggerValue}
                    </span>
                    {rule.useAi && <span style={s.badge("#8b5cf6")}>AI</span>}
                  </div>
                  {rule.replyTemplate && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{rule.replyTemplate}</div>
                  )}
                  <div style={s.row}>
                    <button style={s.btnOutline} onClick={() => handleToggleRule(rule.id, rule.isActive)}>
                      {rule.isActive ? "비활성화" : "활성화"}
                    </button>
                    <button style={{ ...s.btnOutline, color: "#e55", borderColor: "#e553" }} onClick={() => handleDeleteRule(rule.id)}>
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
