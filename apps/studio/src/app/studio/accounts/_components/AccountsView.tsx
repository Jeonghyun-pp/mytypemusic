"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

/* ─── types ─── */
interface SnsAccountInfo {
  id: string;
  platform: string;
  displayName: string;
  profileImageUrl: string;
  isActive: boolean;
  tokenExpiresAt: string | null;
  scopes: string[];
  createdAt: string;
}

type Platform = {
  id: string;
  label: string;
  color: string;
  available: boolean;
};

const PLATFORMS: Platform[] = [
  { id: "threads", label: "Threads", color: "#000", available: true },
  { id: "instagram", label: "Instagram", color: "#E1306C", available: true },
  { id: "x", label: "X (Twitter)", color: "#1DA1F2", available: true },
  { id: "youtube", label: "YouTube", color: "#FF0000", available: true },
  { id: "tiktok", label: "TikTok", color: "#010101", available: true },
  { id: "linkedin", label: "LinkedIn", color: "#0A66C2", available: true },
  { id: "wordpress", label: "WordPress", color: "#21759B", available: true },
  { id: "facebook", label: "Facebook", color: "#1877F2", available: false },
  { id: "pinterest", label: "Pinterest", color: "#BD081C", available: false },
  { id: "telegram", label: "Telegram", color: "#0088CC", available: false },
];

/* ─── styles ─── */
const s = {
  page: { display: "flex", flexDirection: "column" as const, gap: 32 },
  section: { display: "flex", flexDirection: "column" as const, gap: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 600, color: "var(--text)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 },
  card: {
    padding: 20,
    borderRadius: "var(--radius-sm)",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  cardHeader: { display: "flex", alignItems: "center", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: "50%", objectFit: "cover" as const, background: "var(--bg-input)" },
  platformDot: (color: string) => ({
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
  }),
  name: { fontSize: 14, fontWeight: 600, color: "var(--text)" },
  meta: { fontSize: 12, color: "var(--text-muted)" },
  btn: {
    padding: "8px 16px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  },
  btnDanger: {
    background: "transparent",
    color: "#e55",
    borderColor: "#e553",
  },
  connectBtn: (color: string) => ({
    padding: "10px 20px",
    borderRadius: "var(--radius-sm)",
    border: `2px solid ${color}40`,
    background: `${color}08`,
    color: "var(--text)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    transition: "all var(--transition)",
  }),
  disabledBtn: { opacity: 0.4, cursor: "not-allowed" },
  toast: {
    position: "fixed" as const,
    top: 16,
    right: 16,
    padding: "12px 20px",
    borderRadius: "var(--radius-sm)",
    background: "#22c55e",
    color: "#fff",
    fontSize: 13,
    fontWeight: 500,
    zIndex: 1000,
  },
};

/* ─── component ─── */
export default function AccountsView() {
  const [accounts, setAccounts] = useState<SnsAccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("connected");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sns/accounts");
      if (res.ok) setAccounts(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function connect(platformId: string) {
    setConnecting(platformId);
    try {
      const res = await fetch(`/api/sns/connect/${platformId}`, { method: "POST" });
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } finally {
      setConnecting(null);
    }
  }

  async function disconnect(accountId: string) {
    if (!confirm("이 계정 연결을 해제하시겠습니까?")) return;
    await fetch(`/api/sns/accounts/${accountId}`, { method: "DELETE" });
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
  }

  function getExpiryLabel(expiresAt: string | null) {
    if (!expiresAt) return "만료 없음";
    const d = new Date(expiresAt);
    const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
    if (days <= 0) return "만료됨";
    return `${days}일 후 만료`;
  }

  const connectedPlatforms = new Set(accounts.map((a) => a.platform));

  return (
    <div style={s.page}>
      {justConnected && (
        <div style={s.toast}>
          {PLATFORMS.find((p) => p.id === justConnected)?.label ?? justConnected} 계정이 연결되었습니다
        </div>
      )}

      {/* Connected accounts */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>연결된 계정</h2>
        {loading ? (
          <p style={s.meta}>불러오는 중...</p>
        ) : accounts.length === 0 ? (
          <p style={s.meta}>연결된 SNS 계정이 없습니다. 아래에서 계정을 연결하세요.</p>
        ) : (
          <div style={s.grid}>
            {accounts.map((acc) => {
              const plat = PLATFORMS.find((p) => p.id === acc.platform);
              return (
                <div key={acc.id} style={s.card}>
                  <div style={s.cardHeader}>
                    {acc.profileImageUrl ? (
                      <img src={acc.profileImageUrl} alt="" style={s.avatar} />
                    ) : (
                      <div style={{ ...s.avatar, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "var(--text-muted)" }}>
                        {acc.displayName[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={s.platformDot(plat?.color ?? "#888")} />
                        <span style={s.name}>{acc.displayName}</span>
                      </div>
                      <div style={s.meta}>{plat?.label ?? acc.platform}</div>
                    </div>
                  </div>
                  <div style={s.meta}>{getExpiryLabel(acc.tokenExpiresAt)}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => disconnect(acc.id)}>
                      연결 해제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect new account */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>계정 연결</h2>
        <div style={s.grid}>
          {PLATFORMS.map((plat) => {
            const connected = connectedPlatforms.has(plat.id);
            const isConnecting = connecting === plat.id;
            return (
              <button
                key={plat.id}
                style={{
                  ...s.connectBtn(plat.color),
                  ...((!plat.available || connected) ? s.disabledBtn : {}),
                }}
                disabled={!plat.available || connected || isConnecting}
                onClick={() => connect(plat.id)}
              >
                <span style={s.platformDot(plat.color)} />
                {isConnecting
                  ? "연결 중..."
                  : connected
                    ? `${plat.label} (연결됨)`
                    : plat.available
                      ? `${plat.label} 연결`
                      : `${plat.label} (준비 중)`}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
