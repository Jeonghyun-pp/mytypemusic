"use client";

import { useEffect, useState, useCallback } from "react";

interface ReferenceAccount {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  profileImageUrl: string;
  followersCount: number;
  category: string;
  tags: string[];
  isActive: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  feedCount: number;
  createdAt: string;
}

export default function ReferenceAccountsPage() {
  const [accounts, setAccounts] = useState<ReferenceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formUsername, setFormUsername] = useState("");
  const [formCategory, setFormCategory] = useState("artist");
  const [formError, setFormError] = useState("");

  const loadAccounts = useCallback(() => {
    setLoading(true);
    fetch("/api/reference-accounts")
      .then((r) => r.json())
      .then(setAccounts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  async function handleAdd() {
    if (!formUsername.trim()) return;
    setAdding(true);
    setFormError("");
    try {
      const res = await fetch("/api/reference-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formUsername.replace(/^@/, "").trim(),
          category: formCategory,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.message || "Failed to add account");
        return;
      }
      setFormUsername("");
      setShowForm(false);
      loadAccounts();
    } catch {
      setFormError("Network error");
    } finally {
      setAdding(false);
    }
  }

  async function handleSync(id: string) {
    setSyncing((s) => new Set(s).add(id));
    try {
      await fetch(`/api/reference-accounts/${id}/sync`, { method: "POST" });
      setTimeout(loadAccounts, 3000); // reload after sync job runs
    } catch {
      // ignore
    } finally {
      setSyncing((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/reference-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    loadAccounts();
  }

  async function handleDelete(id: string, username: string) {
    if (!confirm(`@${username} 계정을 삭제하시겠습니까? 수집된 피드도 모두 삭제됩니다.`)) return;
    await fetch(`/api/reference-accounts/${id}`, { method: "DELETE" });
    loadAccounts();
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>레퍼런스 계정</h1>
          <p style={s.subtitle}>
            인스타그램 아티스트/레이블/공연장 계정을 모니터링하여 실시간 트렌드 소스로 활용합니다.
          </p>
        </div>
        <button style={s.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? "취소" : "+ 계정 추가"}
        </button>
      </div>

      {showForm && (
        <div style={s.form}>
          <div style={s.formRow}>
            <input
              style={s.input}
              placeholder="Instagram 사용자명 (예: silicagel_official)"
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <select
              style={s.select}
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
            >
              <option value="artist">아티스트</option>
              <option value="label">레이블</option>
              <option value="venue">공연장</option>
              <option value="media">미디어</option>
              <option value="festival">페스티벌</option>
            </select>
            <button style={s.submitBtn} onClick={handleAdd} disabled={adding}>
              {adding ? "확인 중..." : "추가"}
            </button>
          </div>
          {formError && <div style={s.error}>{formError}</div>}
          <div style={s.hint}>
            비즈니스/크리에이터 계정만 추가할 수 있습니다. 개인 계정은 지원되지 않습니다.
          </div>
        </div>
      )}

      {loading ? (
        <div style={s.empty}>로딩 중...</div>
      ) : accounts.length === 0 ? (
        <div style={s.empty}>
          모니터링 중인 계정이 없습니다. 위 버튼으로 계정을 추가하세요.
        </div>
      ) : (
        <div style={s.table}>
          <div style={s.tableHeader}>
            <span style={{ flex: 2 }}>계정</span>
            <span style={{ flex: 1 }}>카테고리</span>
            <span style={{ flex: 1 }}>팔로워</span>
            <span style={{ flex: 1 }}>피드 수</span>
            <span style={{ flex: 1 }}>마지막 동기화</span>
            <span style={{ flex: 1, textAlign: "right" }}>액션</span>
          </div>
          {accounts.map((a) => (
            <div
              key={a.id}
              style={{
                ...s.tableRow,
                opacity: a.isActive ? 1 : 0.5,
              }}
            >
              <span style={{ flex: 2, display: "flex", alignItems: "center", gap: 8 }}>
                {a.profileImageUrl && (
                  <img
                    src={a.profileImageUrl}
                    alt=""
                    style={s.avatar}
                  />
                )}
                <span>
                  <div style={s.username}>@{a.username}</div>
                  {a.displayName && (
                    <div style={s.displayName}>{a.displayName}</div>
                  )}
                </span>
              </span>
              <span style={{ flex: 1 }}>
                <span style={s.badge}>{categoryLabel(a.category)}</span>
              </span>
              <span style={{ flex: 1, fontSize: 13 }}>
                {a.followersCount.toLocaleString()}
              </span>
              <span style={{ flex: 1, fontSize: 13 }}>{a.feedCount}</span>
              <span style={{ flex: 1, fontSize: 12, color: a.syncError ? "#e55" : "var(--text-muted)" }}>
                {a.syncError
                  ? "오류"
                  : a.lastSyncedAt
                    ? timeAgo(a.lastSyncedAt)
                    : "미동기화"}
              </span>
              <span style={{ flex: 1, display: "flex", gap: 4, justifyContent: "flex-end" }}>
                <button
                  style={s.actionBtn}
                  onClick={() => handleSync(a.id)}
                  disabled={syncing.has(a.id)}
                  title="지금 동기화"
                >
                  {syncing.has(a.id) ? "..." : "Sync"}
                </button>
                <button
                  style={s.actionBtn}
                  onClick={() => handleToggle(a.id, a.isActive)}
                  title={a.isActive ? "비활성화" : "활성화"}
                >
                  {a.isActive ? "Off" : "On"}
                </button>
                <button
                  style={{ ...s.actionBtn, color: "#e55" }}
                  onClick={() => handleDelete(a.id, a.username)}
                  title="삭제"
                >
                  Del
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    artist: "아티스트",
    label: "레이블",
    venue: "공연장",
    media: "미디어",
    festival: "페스티벌",
  };
  return map[cat] ?? cat;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

const s = {
  page: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    maxWidth: 900,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  h1: {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: "var(--text-muted)",
    margin: "4px 0 0",
  },
  addBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  form: {
    padding: 16,
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border-light)",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  formRow: {
    display: "flex",
    gap: 8,
  },
  input: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
  },
  select: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
  },
  submitBtn: {
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  error: {
    fontSize: 12,
    color: "#e55",
  },
  hint: {
    fontSize: 12,
    color: "var(--text-muted)",
  },
  empty: {
    padding: 40,
    textAlign: "center" as const,
    color: "var(--text-muted)",
    fontSize: 14,
  },
  table: {
    display: "flex",
    flexDirection: "column" as const,
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-sm)",
    overflow: "hidden",
  },
  tableHeader: {
    display: "flex",
    alignItems: "center",
    padding: "10px 16px",
    background: "var(--bg-input)",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    gap: 8,
  },
  tableRow: {
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    borderTop: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    gap: 8,
    transition: "opacity 0.15s",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    objectFit: "cover" as const,
    flexShrink: 0,
  },
  username: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
  },
  displayName: {
    fontSize: 11,
    color: "var(--text-muted)",
  },
  badge: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 4,
    background: "var(--accent-light)",
    color: "var(--accent)",
    fontWeight: 500,
  },
  actionBtn: {
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  },
};
