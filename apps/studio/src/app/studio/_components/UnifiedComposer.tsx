"use client";

import { useState, useEffect, useCallback } from "react";

interface SnsAccount {
  id: string;
  platform: string;
  displayName: string;
  isActive: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-fill caption text */
  initialText?: string;
  /** Pre-fill hashtags */
  initialHashtags?: string;
  /** Pre-fill media URLs (e.g. from design editor) */
  initialMediaUrls?: string[];
  /** Pre-fill scheduled time (ISO or datetime-local format) */
  initialSchedule?: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  threads: "Threads",
  instagram: "Instagram",
  x: "X",
  linkedin: "LinkedIn",
  wordpress: "WordPress",
  youtube: "YouTube",
  tiktok: "TikTok",
};

type Tab = "text" | "media";
type PublishMode = "now" | "schedule" | "draft";

export default function UnifiedComposer({
  open,
  onClose,
  initialText = "",
  initialHashtags = "",
  initialMediaUrls = [],
  initialSchedule = "",
}: Props) {
  const [accounts, setAccounts] = useState<SnsAccount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [text, setText] = useState(initialText);
  const [hashtags, setHashtags] = useState(initialHashtags);
  const [mediaUrls, setMediaUrls] = useState<string[]>(initialMediaUrls);
  const [mediaInput, setMediaInput] = useState("");
  const [tab, setTab] = useState<Tab>("text");
  const [mode, setMode] = useState<PublishMode>("now");
  const [scheduleTime, setScheduleTime] = useState(initialSchedule);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const [smartTime, setSmartTime] = useState<string | null>(null);

  // Sync props when modal opens — only trigger on `open` transition to true
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setText(initialText);
    setHashtags(initialHashtags);
    setMediaUrls(initialMediaUrls);
    setScheduleTime(initialSchedule);
    setResult(null);
    setPublishing(false);
    setSmartTime(null);
  }
  if (open !== prevOpen) {
    setPrevOpen(open);
  }

  // Load accounts
  useEffect(() => {
    if (!open) return;
    fetch("/api/sns/accounts")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SnsAccount[]) => {
        const active = data.filter((a) => a.isActive);
        setAccounts(active);
        // Auto-select all on first open
        setSelected(new Set(active.map((a) => a.id)));
      })
      .catch(() => {});
  }, [open]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Fetch AI recommended time
  const fetchSmartTime = useCallback(async () => {
    const firstId = Array.from(selected)[0];
    if (!firstId) return;
    try {
      const res = await fetch(`/api/publish/smart-time?accountId=${firstId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.scheduledAt) {
          const d = new Date(data.scheduledAt);
          const pad = (n: number) => String(n).padStart(2, "0");
          const val = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          setScheduleTime(val);
          setSmartTime(data.reason ?? `${data.dayLabel} ${data.timeLabel} 추천`);
        }
      }
    } catch { /* ignore */ }
  }, [selected]);

  function addMediaUrl() {
    const url = mediaInput.trim();
    if (url && !mediaUrls.includes(url)) {
      setMediaUrls((prev) => [...prev, url]);
    }
    setMediaInput("");
  }

  function removeMedia(i: number) {
    setMediaUrls((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handlePublish() {
    if (!selected.size || !text.trim() || publishing) return;
    setPublishing(true);
    setResult(null);

    const content = {
      text: text.trim(),
      hashtags: hashtags
        .split(/[,\s#]+/)
        .filter(Boolean),
      mediaUrls: mediaUrls.length ? mediaUrls : undefined,
    };

    try {
      if (mode === "now") {
        const res = await fetch("/api/publish/multi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountIds: Array.from(selected),
            content,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setResult({
            success: data.success?.length ?? 0,
            failed: data.failed?.length ?? 0,
          });
        }
      } else if (mode === "schedule") {
        if (!scheduleTime) return;
        // Schedule to each selected account
        let success = 0;
        let failed = 0;
        for (const accId of selected) {
          const acc = accounts.find((a) => a.id === accId);
          try {
            const res = await fetch("/api/publish/schedule", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                snsAccountId: accId,
                platform: acc?.platform,
                content,
                scheduledAt: new Date(scheduleTime).toISOString(),
              }),
            });
            if (res.ok) success++;
            else failed++;
          } catch {
            failed++;
          }
        }
        setResult({ success, failed });
      } else {
        // Draft — save without publishing
        let success = 0;
        let failed = 0;
        for (const accId of selected) {
          const acc = accounts.find((a) => a.id === accId);
          try {
            const res = await fetch("/api/publish/schedule", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                snsAccountId: accId,
                platform: acc?.platform,
                content,
                scheduledAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              }),
            });
            if (res.ok) success++;
            else failed++;
          } catch {
            failed++;
          }
        }
        setResult({ success, failed });
      }
    } finally {
      setPublishing(false);
    }
  }

  if (!open) return null;

  const canPublish =
    selected.size > 0 &&
    text.trim().length > 0 &&
    !publishing &&
    (mode !== "schedule" || scheduleTime);

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" style={s.backdrop} onClick={onClose} />

      {/* Modal */}
      <div className="modal-panel" style={s.modal}>
        {/* Header */}
        <div style={s.header}>
          <span style={s.headerTitle}>New Post</span>
          <button style={s.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={s.body}>
          {/* Tab bar */}
          <div style={s.tabBar}>
            <button
              style={tab === "text" ? s.tabActive : s.tab}
              onClick={() => setTab("text")}
            >
              텍스트
            </button>
            <button
              style={tab === "media" ? s.tabActive : s.tab}
              onClick={() => setTab("media")}
            >
              미디어 {mediaUrls.length > 0 && `(${mediaUrls.length})`}
            </button>
          </div>

          {/* Text tab */}
          {tab === "text" && (
            <div style={s.tabContent}>
              <textarea
                style={s.textarea}
                placeholder="캡션을 입력하세요..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
              />
              <input
                style={s.input}
                placeholder="해시태그 (쉼표 또는 공백 구분)"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
              />
              <div style={s.charCount}>{text.length}자</div>
            </div>
          )}

          {/* Media tab */}
          {tab === "media" && (
            <div style={s.tabContent}>
              <div style={s.mediaActions}>
                <a href="/studio/design" style={s.mediaLink}>
                  카드뉴스 만들기
                </a>
                <a href="/studio/reels" style={s.mediaLink}>
                  릴스 만들기
                </a>
              </div>
              <div style={s.mediaInputRow}>
                <input
                  style={{ ...s.input, flex: 1 }}
                  placeholder="이미지 URL 추가..."
                  value={mediaInput}
                  onChange={(e) => setMediaInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addMediaUrl()}
                />
                <button style={s.addBtn} onClick={addMediaUrl}>
                  추가
                </button>
              </div>
              {mediaUrls.length > 0 && (
                <div style={s.mediaThumbs}>
                  {mediaUrls.map((url, i) => (
                    <div key={i} style={s.thumbWrap}>
                      <img src={url} alt="" style={s.thumb} />
                      <button
                        style={s.thumbRemove}
                        onClick={() => removeMedia(i)}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Channel selection */}
          <div style={s.section}>
            <div style={s.sectionLabel}>채널</div>
            {accounts.length === 0 ? (
              <div style={s.noAccounts}>
                연결된 계정이 없습니다.{" "}
                <a href="/studio/accounts" style={s.link}>
                  계정 연결
                </a>
              </div>
            ) : (
              <div style={s.channelGrid}>
                {accounts.map((a) => (
                  <label key={a.id} style={s.channelItem}>
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggle(a.id)}
                      style={s.checkbox}
                    />
                    <span style={s.platformLabel}>
                      {PLATFORM_LABELS[a.platform] ?? a.platform}
                    </span>
                    <span style={s.accountName}>{a.displayName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Publish mode */}
          <div style={s.section}>
            <div style={s.modeRow}>
              {(
                [
                  ["now", "지금 발행"],
                  ["schedule", "예약"],
                  ["draft", "드래프트"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  style={mode === m ? s.modeActive : s.modeBtn}
                  onClick={() => setMode(m)}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "schedule" && (
              <div style={s.scheduleRow}>
                <input
                  type="datetime-local"
                  style={s.input}
                  value={scheduleTime}
                  onChange={(e) => {
                    setScheduleTime(e.target.value);
                    setSmartTime(null);
                  }}
                />
                <button style={s.smartBtn} onClick={fetchSmartTime}>
                  AI 추천 시간
                </button>
                {smartTime && (
                  <span style={s.smartHint}>{smartTime}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={s.footer}>
          {result && (
            <div style={s.resultRow}>
              {result.success > 0 && (
                <span style={s.resultOk}>{result.success}개 성공</span>
              )}
              {result.failed > 0 && (
                <span style={s.resultFail}>{result.failed}개 실패</span>
              )}
            </div>
          )}
          <button
            style={{
              ...s.publishBtn,
              opacity: canPublish ? 1 : 0.5,
            }}
            disabled={!canPublish}
            onClick={handlePublish}
          >
            {publishing
              ? "발행 중..."
              : mode === "now"
                ? `${selected.size}개 플랫폼에 발행`
                : mode === "schedule"
                  ? "예약 발행"
                  : "드래프트 저장"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Styles ──────────────────────────────────────────

const s = {
  backdrop: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 500,
  },
  modal: {
    position: "fixed" as const,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(520px, calc(100vw - 32px))",
    maxHeight: "calc(100vh - 48px)",
    background: "var(--bg-card)",
    borderRadius: 16,
    border: "1px solid var(--border)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
    display: "flex",
    flexDirection: "column" as const,
    zIndex: 501,
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid var(--border)",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--text)",
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 22,
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: 1,
  },
  body: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  tabBar: {
    display: "flex",
    gap: 4,
    background: "var(--bg-input)",
    borderRadius: 8,
    padding: 3,
  },
  tab: {
    flex: 1,
    padding: "7px 0",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-muted)",
    background: "transparent",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  tabActive: {
    flex: 1,
    padding: "7px 0",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text)",
    background: "var(--bg-card)",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  tabContent: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  textarea: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 13,
    fontFamily: "inherit",
    resize: "vertical" as const,
    lineHeight: 1.6,
    outline: "none",
  },
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
  },
  charCount: {
    fontSize: 11,
    color: "var(--text-muted)",
    textAlign: "right" as const,
  },
  mediaActions: {
    display: "flex",
    gap: 8,
  },
  mediaLink: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px dashed var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 12,
    fontWeight: 500,
    textDecoration: "none",
    textAlign: "center" as const,
    flex: 1,
    transition: "all 0.15s",
  },
  mediaInputRow: {
    display: "flex",
    gap: 8,
  },
  addBtn: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "var(--text)",
    color: "var(--bg)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  },
  mediaThumbs: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
  },
  thumbWrap: {
    position: "relative" as const,
    width: 64,
    height: 64,
    borderRadius: 6,
    overflow: "hidden",
    border: "1px solid var(--border)",
  },
  thumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  },
  thumbRemove: {
    position: "absolute" as const,
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.6)",
    color: "#fff",
    border: "none",
    fontSize: 12,
    lineHeight: "18px",
    textAlign: "center" as const,
    cursor: "pointer",
    padding: 0,
  },
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
  },
  noAccounts: {
    fontSize: 12,
    color: "var(--text-muted)",
  },
  link: {
    color: "var(--accent)",
    textDecoration: "underline",
  },
  channelGrid: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  channelItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "var(--text)",
    cursor: "pointer",
  },
  checkbox: { accentColor: "var(--accent)" },
  platformLabel: { fontWeight: 600, minWidth: 80 },
  accountName: { color: "var(--text-muted)", fontSize: 12 },
  modeRow: {
    display: "flex",
    gap: 4,
    background: "var(--bg-input)",
    borderRadius: 8,
    padding: 3,
  },
  modeBtn: {
    flex: 1,
    padding: "8px 0",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-muted)",
    background: "transparent",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  modeActive: {
    flex: 1,
    padding: "8px 0",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text)",
    background: "var(--bg-card)",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  scheduleRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap" as const,
  },
  smartBtn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid rgba(61,166,110,0.25)",
    background: "rgba(61,166,110,0.06)",
    color: "var(--accent)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  smartHint: {
    fontSize: 11,
    color: "var(--accent)",
  },
  footer: {
    padding: "12px 20px 16px",
    borderTop: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  resultRow: {
    display: "flex",
    gap: 8,
    fontSize: 12,
  },
  resultOk: { color: "#10b981", fontWeight: 600 },
  resultFail: { color: "#ef4444", fontWeight: 600 },
  publishBtn: {
    padding: "10px 24px",
    borderRadius: 10,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
};
