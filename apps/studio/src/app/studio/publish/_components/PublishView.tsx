"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface SnsAccountInfo {
  id: string;
  platform: string;
  displayName: string;
  profileImageUrl: string;
  isActive: boolean;
}

interface Publication {
  id: string;
  platform: string;
  snsAccountId: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  platformPostUrl: string | null;
  content: { text?: string; hashtags?: string[] };
  error: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#888",
  scheduled: "#3DA66E",
  publishing: "#f59e0b",
  published: "#22c55e",
  failed: "#ef4444",
};

const s = {
  page: { display: "flex", flexDirection: "column" as const, gap: 24 },
  section: { display: "flex", flexDirection: "column" as const, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 600, color: "var(--text)" },
  desc: { fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 },
  row: { display: "flex", gap: 8, alignItems: "center" },
  input: { width: "100%", padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: 13 },
  textarea: { width: "100%", minHeight: 120, padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: 13, fontFamily: "inherit", resize: "vertical" as const, lineHeight: 1.6 },
  select: { padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: 13 },
  btn: { padding: "10px 24px", borderRadius: "var(--radius-sm)", border: "none", background: "var(--text)", color: "var(--bg)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnOutline: { padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: 12, fontWeight: 500, cursor: "pointer" },
  card: { padding: 16, borderRadius: "var(--radius-sm)", background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" as const, gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: 600, color: "var(--text)" },
  cardMeta: { fontSize: 12, color: "var(--text-muted)" },
  badge: (color: string) => ({ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: `${color}20`, color }),
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 12 },
  formCard: { padding: 20, borderRadius: "var(--radius-sm)", background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" as const, gap: 16 },
};

export default function PublishView() {
  const [accounts, setAccounts] = useState<SnsAccountInfo[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);

  // New publish form
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [text, setText] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [optimalTimes, setOptimalTimes] = useState<
    Array<{ dayLabel: string; timeLabel: string; avgEngagementRate: number; dataPoints: number }>
  >([]);

  const load = useCallback(async () => {
    try {
      const [accRes, pubRes] = await Promise.all([
        fetch("/api/sns/accounts"),
        fetch("/api/publish"),
      ]);
      if (accRes.ok) setAccounts(await accRes.json());
      if (pubRes.ok) setPublications(await pubRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pre-fill from query params (from Design/Blog/AI suggestions)
  const searchParams = useSearchParams();
  useEffect(() => {
    const qText = searchParams.get("text");
    const qHashtags = searchParams.get("hashtags");
    if (qText) setText(decodeURIComponent(qText));
    if (qHashtags) setHashtags(decodeURIComponent(qHashtags));
  }, [searchParams]);

  // Fetch optimal posting times when account changes
  useEffect(() => {
    if (!selectedAccountId) {
      setOptimalTimes([]);
      return;
    }
    fetch(`/api/analytics/optimal-times/${selectedAccountId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.recommendations) setOptimalTimes(data.recommendations);
        else setOptimalTimes([]);
      })
      .catch(() => setOptimalTimes([]));
  }, [selectedAccountId]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  async function handlePublishNow() {
    if (!selectedAccountId || !text.trim()) return;
    setPublishing(true);
    try {
      const content = {
        text: text.trim(),
        hashtags: hashtags.split(/[,\s#]+/).filter(Boolean),
      };
      await fetch("/api/publish/now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snsAccountId: selectedAccountId,
          platform: selectedAccount?.platform,
          content,
        }),
      });
      setText("");
      setHashtags("");
      load();
    } finally {
      setPublishing(false);
    }
  }

  async function handleSchedule() {
    if (!selectedAccountId || !text.trim() || !scheduleTime) return;
    setPublishing(true);
    try {
      const content = {
        text: text.trim(),
        hashtags: hashtags.split(/[,\s#]+/).filter(Boolean),
      };
      await fetch("/api/publish/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snsAccountId: selectedAccountId,
          platform: selectedAccount?.platform,
          content,
          scheduledAt: new Date(scheduleTime).toISOString(),
        }),
      });
      setText("");
      setHashtags("");
      setScheduleTime("");
      load();
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/publish/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div style={s.page}>
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Publish</h2>
        <p style={s.desc}>연결된 SNS 계정에 콘텐츠를 즉시 발행하거나 예약합니다.</p>
      </div>

      {/* New publish form */}
      <div style={s.formCard}>
        <div style={s.row}>
          <select style={s.select} value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
            <option value="">계정 선택</option>
            {accounts.filter((a) => a.isActive).map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName} ({a.platform})
              </option>
            ))}
          </select>
          {accounts.length === 0 && !loading && (
            <span style={s.desc}>연결된 계정이 없습니다. Accounts 탭에서 먼저 연결하세요.</span>
          )}
        </div>

        <textarea
          style={s.textarea}
          placeholder="발행할 내용을 입력하세요..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <input
          style={s.input}
          placeholder="해시태그 (쉼표 또는 공백 구분)"
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
        />

        <div style={s.row}>
          <button
            style={s.btn}
            onClick={handlePublishNow}
            disabled={publishing || !selectedAccountId || !text.trim()}
          >
            {publishing ? "발행 중..." : "즉시 발행"}
          </button>

          <input
            type="datetime-local"
            style={s.input}
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
          />
          {selectedAccountId && (
            <button
              style={{ ...s.btnOutline, color: "var(--accent)", borderColor: "rgba(61,166,110,0.25)" }}
              onClick={async () => {
                try {
                  const res = await fetch(`/api/publish/smart-time?accountId=${selectedAccountId}`);
                  if (res.ok) {
                    const data = await res.json();
                    if (data.scheduledAt) {
                      const d = new Date(data.scheduledAt);
                      const pad = (n: number) => String(n).padStart(2, "0");
                      setScheduleTime(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                    }
                  }
                } catch { /* ignore */ }
              }}
            >
              AI 추천 시간
            </button>
          )}
          <button
            style={s.btnOutline}
            onClick={handleSchedule}
            disabled={publishing || !selectedAccountId || !text.trim() || !scheduleTime}
          >
            예약 발행
          </button>
        </div>

        {/* Optimal time recommendations */}
        {optimalTimes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>추천 발행 시간</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {optimalTimes.map((t, i) => (
                <button
                  key={i}
                  style={{
                    ...s.btnOutline,
                    fontSize: 11,
                    padding: "4px 10px",
                    background: i === 0 ? "rgba(61,166,110,0.06)" : "transparent",
                    borderColor: i === 0 ? "rgba(61,166,110,0.25)" : "var(--border)",
                  }}
                  title={`참여율 ${(t.avgEngagementRate * 100).toFixed(1)}% (데이터 ${t.dataPoints}건)`}
                  onClick={() => {
                    // Set schedule time to the next occurrence of this day/time
                    const now = new Date();
                    const target = new Date(now);
                    const hour = parseInt(t.timeLabel.split(":")[0] ?? "0", 10);
                    target.setHours(hour, 0, 0, 0);
                    if (target <= now) target.setDate(target.getDate() + 1);
                    // Format for datetime-local input
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const val = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
                    setScheduleTime(val);
                  }}
                >
                  {t.dayLabel} {t.timeLabel}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Publication history */}
      <div style={s.section}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={s.sectionTitle}>발행 내역</h2>
          {(["all", "draft", "scheduled", "published", "failed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: statusFilter === f ? "var(--text)" : "transparent",
                color: statusFilter === f ? "var(--bg)" : "var(--text-muted)",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {{ all: "전체", draft: "대기", scheduled: "예약", published: "발행완료", failed: "실패" }[f]}
            </button>
          ))}
        </div>
        {loading ? (
          <p style={s.desc}>불러오는 중...</p>
        ) : publications.length === 0 ? (
          <p style={s.desc}>아직 발행 내역이 없습니다.</p>
        ) : (
          <div style={s.grid}>
            {publications.filter((p) => statusFilter === "all" || p.status === statusFilter).map((pub) => (
              <div key={pub.id} style={s.card}>
                <div style={s.row}>
                  <span style={s.badge(STATUS_COLORS[pub.status] ?? "#888")}>{pub.status}</span>
                  <span style={s.cardMeta}>{pub.platform}</span>
                  <span style={s.cardMeta}>{new Date(pub.createdAt).toLocaleString("ko")}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
                  {(pub.content.text ?? "").slice(0, 200)}
                  {(pub.content.text?.length ?? 0) > 200 ? "..." : ""}
                </div>
                {pub.scheduledAt && pub.status === "scheduled" && (
                  <div style={s.cardMeta}>예약: {new Date(pub.scheduledAt).toLocaleString("ko")}</div>
                )}
                {pub.publishedAt && (
                  <div style={s.cardMeta}>발행: {new Date(pub.publishedAt).toLocaleString("ko")}</div>
                )}
                {pub.platformPostUrl && (
                  <a href={pub.platformPostUrl} target="_blank" rel="noopener" style={{ fontSize: 12, color: "var(--accent)" }}>
                    게시물 보기
                  </a>
                )}
                {pub.error && <div style={{ fontSize: 12, color: "#ef4444" }}>{pub.error}</div>}
                <div style={s.row}>
                  {(pub.status === "draft" || pub.status === "scheduled" || pub.status === "failed") && (
                    <button style={{ ...s.btnOutline, color: "#e55", borderColor: "#e553" }} onClick={() => handleDelete(pub.id)}>
                      삭제
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
