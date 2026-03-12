"use client";

import type { TopicDraftSummary } from "./WorkshopView";

const STATUS_FILTERS = [
  { label: "전체", value: null },
  { label: "저장됨", value: "saved" },
  { label: "다듬는 중", value: "refining" },
  { label: "완료", value: "refined" },
  { label: "발행됨", value: "sent" },
] as const;

const SOURCE_LABELS: Record<string, string> = {
  suggestion: "AI 추천",
  "topic-intelligence": "토픽 분석",
  autopilot: "오토파일럿",
  manual: "직접 입력",
};

const STATUS_COLORS: Record<string, string> = {
  saved: "var(--text-muted)",
  refining: "var(--accent)",
  refined: "var(--green, #22c55e)",
  sent: "var(--text-muted)",
};

interface Props {
  drafts: TopicDraftSummary[];
  loading: boolean;
  selectedId: string | null;
  statusFilter: string | null;
  onSelect: (id: string) => void;
  onFilterChange: (status: string | null) => void;
}

export default function TopicDraftList({
  drafts,
  loading,
  selectedId,
  statusFilter,
  onSelect,
  onFilterChange,
}: Props) {
  return (
    <div style={s.wrapper}>
      {/* Status filter tabs */}
      <div style={s.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.label}
            style={{
              ...s.filterTab,
              ...(statusFilter === f.value ? s.filterTabActive : {}),
            }}
            onClick={() => onFilterChange(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Draft list */}
      {loading ? (
        <div style={s.loading}>불러오는 중...</div>
      ) : drafts.length === 0 ? (
        <div style={s.empty}>저장된 주제가 없습니다</div>
      ) : (
        <div style={s.list}>
          {drafts.map((d) => (
            <button
              key={d.id}
              style={{
                ...s.item,
                ...(selectedId === d.id ? s.itemActive : {}),
              }}
              onClick={() => onSelect(d.id)}
            >
              <div style={s.itemTop}>
                <span style={s.itemTopic}>{d.topic}</span>
                <span
                  style={{
                    ...s.statusDot,
                    background: STATUS_COLORS[d.status] ?? "var(--text-muted)",
                  }}
                />
              </div>
              <div style={s.itemMeta}>
                <span style={s.sourceBadge}>
                  {SOURCE_LABELS[d.sourceType] ?? d.sourceType}
                </span>
                {d._count.messages > 0 && (
                  <span style={s.msgCount}>{d._count.messages}개 대화</span>
                )}
                <span style={s.date}>
                  {new Date(d.createdAt).toLocaleDateString("ko-KR", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  filterRow: {
    display: "flex",
    gap: 4,
    flexWrap: "wrap" as const,
  },
  filterTab: {
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text-muted)",
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
  },
  filterTabActive: {
    background: "var(--accent-light)",
    color: "var(--accent)",
    borderColor: "var(--accent)",
  },
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  item: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    padding: "10px 12px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    cursor: "pointer",
    textAlign: "left" as const,
    width: "100%",
    transition: "all 0.15s",
  },
  itemActive: {
    borderColor: "var(--accent)",
    background: "var(--accent-light)",
  },
  itemTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  itemTopic: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
    lineHeight: 1.4,
    flex: 1,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    marginTop: 4,
  },
  itemMeta: {
    display: "flex",
    gap: 6,
    alignItems: "center",
  },
  sourceBadge: {
    fontSize: 10,
    fontWeight: 500,
    padding: "1px 6px",
    borderRadius: 4,
    background: "var(--bg-input)",
    color: "var(--text-muted)",
  },
  msgCount: {
    fontSize: 10,
    color: "var(--text-muted)",
  },
  date: {
    fontSize: 10,
    color: "var(--text-muted)",
    marginLeft: "auto",
  },
  loading: {
    padding: 20,
    textAlign: "center" as const,
    color: "var(--text-muted)",
    fontSize: 13,
  },
  empty: {
    padding: 20,
    textAlign: "center" as const,
    color: "var(--text-muted)",
    fontSize: 13,
  },
};
