"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useCalendarEvents, type CalendarEvent } from "../calendar/_components/calendarStore";
import { CONTENT_CATEGORIES } from "@/lib/studio/contentCategories";
import AiSuggestions from "./AiSuggestions";
import PipelineStatus from "./PipelineStatus";
import OnboardingWizard from "./OnboardingWizard";
import UnifiedComposer from "./UnifiedComposer";
import { usePipeline } from "./pipeline/PipelineProvider";

// ── Helpers ──────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  post: "#3DA66E",
  reels: "#8B5CF6",
  promotion: "#F59E0B",
};

const STATUS_LABEL: Record<string, { icon: string; text: string }> = {
  planned: { icon: "○", text: "예정" },
  "in-progress": { icon: "●", text: "진행 중" },
  published: { icon: "✓", text: "완료" },
};

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getEndOfWeek(d: Date) {
  const end = new Date(d);
  const day = end.getDay(); // 0=Sun
  end.setDate(end.getDate() + (7 - day)); // next Sunday
  return end;
}

function formatDateHeader(d: Date) {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_NAMES[d.getDay()]})`;
}

function getCategoryLabel(id: string) {
  const cat = CONTENT_CATEGORIES.find((c) => c.id === id);
  return cat ? cat.label.replace(/^\[\d\]\s*/, "") : "";
}

// ── Event Card ──────────────────────────────────────

function EventCard({ event }: { event: CalendarEvent }) {
  const status = STATUS_LABEL[event.status] ?? STATUS_LABEL.planned!;
  const typeColor = TYPE_COLORS[event.type] ?? "#888";
  const catLabel = getCategoryLabel(event.category);

  return (
    <div className="card-hover" style={s.card}>
      <div style={s.cardTop}>
        <span style={{ ...s.typeBadge, background: typeColor }}>
          {event.type}
        </span>
        <span
          style={{
            ...s.statusBadge,
            color: event.status === "published" ? "var(--green)" : event.status === "in-progress" ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          {status.icon} {status.text}
        </span>
      </div>
      <div style={s.cardTitle}>{event.title}</div>
      {catLabel && <div style={s.cardCategory}>{catLabel}</div>}
      {event.note && (
        <div style={s.cardNote}>
          {event.note.split("\n")[0]!.slice(0, 60)}
          {event.note.length > 60 ? "..." : ""}
        </div>
      )}
    </div>
  );
}

// ── Section ──────────────────────────────────────────

function Section({
  title,
  count,
  events,
  emptyText,
}: {
  title: string;
  count: number;
  events: CalendarEvent[];
  emptyText: string;
}) {
  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        <span style={s.sectionTitle}>{title}</span>
        <span style={s.sectionCount}>{count}개</span>
      </div>
      {events.length === 0 ? (
        <div style={s.empty}>{emptyText}</div>
      ) : (
        <div style={s.cardGrid}>
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Quick Nav ────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Design Editor", href: "/studio/design", desc: "카드뉴스 디자인" },
  { label: "Reels Editor", href: "/studio/reels", desc: "숏폼 영상 편집" },
  { label: "Calendar", href: "/studio/calendar", desc: "콘텐츠 일정 관리" },
  { label: "Database", href: "/studio/database", desc: "디자인 레퍼런스" },
];

// ── Dashboard ────────────────────────────────────────

export default function Dashboard() {
  const { events } = useCalendarEvents();
  const { isActive: pipelineActive, startPipeline } = usePipeline();
  const [accountCount, setAccountCount] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [composerHashtags, setComposerHashtags] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("onboarding-skipped") === "1") {
      setSkipped(true);
    }
    fetch("/api/sns/accounts")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown[]) => setAccountCount(data.length))
      .catch(() => setAccountCount(0));
  }, []);

  const { today, tomorrow, thisWeek, todayStr, tomorrowStr } = useMemo(() => {
    const now = new Date();
    const todayStr = toDateStr(now);

    const tmrw = new Date(now);
    tmrw.setDate(tmrw.getDate() + 1);
    const tomorrowStr = toDateStr(tmrw);

    const weekEnd = getEndOfWeek(now);

    const today: CalendarEvent[] = [];
    const tomorrow: CalendarEvent[] = [];
    const thisWeek: CalendarEvent[] = [];

    for (const ev of events) {
      if (ev.date === todayStr) {
        today.push(ev);
      } else if (ev.date === tomorrowStr) {
        tomorrow.push(ev);
      } else if (ev.date > tomorrowStr && ev.date <= toDateStr(weekEnd)) {
        thisWeek.push(ev);
      }
    }

    // Sort by status priority: in-progress first, then planned, then published
    const statusOrder: Record<string, number> = { "in-progress": 0, planned: 1, published: 2 };
    const sortFn = (a: CalendarEvent, b: CalendarEvent) =>
      (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);

    today.sort(sortFn);
    tomorrow.sort(sortFn);
    thisWeek.sort((a, b) => a.date.localeCompare(b.date) || sortFn(a, b));

    return { today, tomorrow, thisWeek, todayStr, tomorrowStr };
  }, [events]);

  const pendingCount = events.filter((e) => e.status !== "published").length;
  const now = new Date();

  // Show onboarding wizard when no accounts connected (unless skipped)
  if (accountCount === 0 && !skipped) {
    return (
      <div style={s.wrapper}>
        <OnboardingWizard onSkip={() => setSkipped(true)} />
      </div>
    );
  }

  const weekEvents = [...tomorrow, ...thisWeek];

  return (
    <div className="animate-stagger" style={s.wrapper}>
      {/* 1. 오늘 할 일 — 가장 급한 것 먼저 */}
      <div style={s.header}>
        <div>
          <h2 style={s.greeting}>
            {pendingCount > 0
              ? `${pendingCount}개의 미완료 일정이 있습니다`
              : "모든 일정이 완료되었습니다"}
          </h2>
          <p style={s.dateText}>{formatDateHeader(now)}</p>
        </div>
        <Link href="/studio/calendar" style={s.calendarLink}>
          캘린더 열기
        </Link>
      </div>

      <PipelineStatus />

      {events.length === 0 ? (
        <div style={s.emptyAll}>
          <p style={s.emptyAllTitle}>등록된 일정이 없습니다</p>
          <p style={s.emptyAllDesc}>
            캘린더에서 콘텐츠 일정을 추가해보세요
          </p>
          <Link href="/studio/calendar" style={s.emptyAllBtn}>
            캘린더로 이동
          </Link>
        </div>
      ) : (
        <Section
          title="오늘"
          count={today.length}
          events={today}
          emptyText="오늘 일정이 없습니다"
        />
      )}

      {/* 2. AI 제안 — 다음에 뭘 만들까 */}
      <AiSuggestions
        onQuickPost={(text, hashtags) => {
          setComposerText(text);
          setComposerHashtags(hashtags);
          setComposerOpen(true);
        }}
      />

      {/* 3. 이번 주 캘린더 미니뷰 */}
      {weekEvents.length > 0 && (
        <Section
          title="이번 주 남은 일정"
          count={weekEvents.length}
          events={weekEvents}
          emptyText=""
        />
      )}

      {/* Pipeline launcher */}
      {!pipelineActive && (
        <div style={s.section}>
          <button
            onClick={startPipeline}
            className="card-hover"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              width: "100%",
              padding: "20px 24px",
              background: "linear-gradient(135deg, rgba(58,130,90,0.06), rgba(58,130,90,0.02))",
              border: "1px solid rgba(58,130,90,0.2)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              textAlign: "left" as const,
              transition: "all var(--transition)",
            }}
          >
            <span style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 300,
              flexShrink: 0,
            }}>
              {"▶"}
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                가이드 파이프라인 시작
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                설정 → 기획 → 제작 → 발행 → 분석까지 단계별로 안내합니다
              </div>
            </div>
          </button>
        </div>
      )}

      {/* 4. 빠른 이동 */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>빠른 이동</span>
        </div>
        <div style={s.navGrid}>
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="card-hover" style={s.navCard}>
              <span style={s.navLabel}>{item.label}</span>
              <span style={s.navDesc}>{item.desc}</span>
            </Link>
          ))}
        </div>
      </div>

      <UnifiedComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        initialText={composerText}
        initialHashtags={composerHashtags}
      />
    </div>
  );
}

// ── Styles ───────────────────────────────────────────

const s = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "28px",
  } as const,

  // Header
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: "24px 28px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    boxShadow: "var(--shadow-card)",
  } as const,
  greeting: {
    fontSize: "18px",
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: "4px",
  } as const,
  dateText: {
    fontSize: "13px",
    color: "var(--text-muted)",
  } as const,
  calendarLink: {
    padding: "8px 16px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: "12px",
    fontWeight: 500,
    textDecoration: "none",
    transition: "all var(--transition)",
    flexShrink: 0,
  } as const,

  // Section
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  } as const,
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  } as const,
  sectionTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--text)",
  } as const,
  sectionCount: {
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text-muted)",
    padding: "2px 8px",
    borderRadius: "8px",
    background: "var(--bg-input)",
  } as const,

  // Card Grid
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "12px",
  } as const,

  // Event Card
  card: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
    padding: "16px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border-light)",
    boxShadow: "var(--shadow-card)",
    transition: "all var(--transition)",
  } as const,
  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as const,
  typeBadge: {
    fontSize: "10px",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "6px",
    color: "#fff",
    textTransform: "uppercase" as const,
  } as const,
  statusBadge: {
    fontSize: "11px",
    fontWeight: 500,
  } as const,
  cardTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text)",
    lineHeight: 1.4,
  } as const,
  cardCategory: {
    fontSize: "11px",
    color: "var(--text-muted)",
  } as const,
  cardNote: {
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1.4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as const,

  // Empty states
  empty: {
    padding: "20px",
    textAlign: "center" as const,
    fontSize: "13px",
    color: "var(--text-muted)",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px dashed var(--border-light)",
  } as const,

  emptyAll: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "12px",
    padding: "60px 20px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    boxShadow: "var(--shadow-card)",
  } as const,
  emptyAllTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--text)",
  } as const,
  emptyAllDesc: {
    fontSize: "13px",
    color: "var(--text-muted)",
  } as const,
  emptyAllBtn: {
    padding: "10px 24px",
    borderRadius: "10px",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    textDecoration: "none",
    transition: "all var(--transition)",
  } as const,

  // Quick Nav
  navGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "12px",
  } as const,
  navCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
    padding: "20px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border-light)",
    boxShadow: "var(--shadow-card)",
    textDecoration: "none",
    transition: "all var(--transition)",
  } as const,
  navLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text)",
  } as const,
  navDesc: {
    fontSize: "12px",
    color: "var(--text-muted)",
  } as const,
};
