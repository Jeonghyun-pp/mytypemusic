"use client";

import type { CalendarEvent } from "./calendarStore";

const TYPE_COLORS: Record<string, string> = {
  post: "#3DA66E",
  reels: "#8B5CF6",
  promotion: "#F59E0B",
};

const STATUS_ICON: Record<string, string> = {
  published: "✓",
  "in-progress": "●",
  planned: "○",
};

interface DayCellProps {
  date: number;
  fullDate: string; // "YYYY-MM-DD"
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: CalendarEvent[];
  onClick: () => void;
}

const MAX_CHIPS = 3;

export default function DayCell({
  date,
  isCurrentMonth,
  isToday,
  isSelected,
  events,
  onClick,
}: DayCellProps) {
  const overflow = events.length - MAX_CHIPS;

  return (
    <button onClick={onClick} style={styles.cell(isCurrentMonth, isSelected)}>
      <span style={styles.dateNumber(isToday)}>{date}</span>
      <div style={styles.chipList}>
        {events.slice(0, MAX_CHIPS).map((ev) => (
          <div key={ev.id} style={styles.chip(ev.type)}>
            <span style={styles.statusIcon}>{STATUS_ICON[ev.status]}</span>
            <span style={styles.chipLabel}>{ev.title}</span>
          </div>
        ))}
        {overflow > 0 && <span style={styles.more}>+{overflow} more</span>}
      </div>
    </button>
  );
}

const styles = {
  cell: (isCurrent: boolean, isSelected: boolean) =>
    ({
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      minHeight: "100px",
      padding: "6px",
      border: isSelected ? "1.5px solid var(--accent)" : "1px solid var(--border-light)",
      borderRadius: "10px",
      background: isSelected ? "var(--accent-light)" : "var(--bg-card)",
      opacity: isCurrent ? 1 : 0.35,
      cursor: "pointer",
      textAlign: "left" as const,
      transition: "all var(--transition)",
    }) as React.CSSProperties,

  dateNumber: (isToday: boolean) =>
    ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "24px",
      height: "24px",
      borderRadius: "50%",
      fontSize: "12px",
      fontWeight: isToday ? 700 : 500,
      color: isToday ? "#fff" : "var(--text)",
      background: isToday ? "var(--accent)" : "transparent",
      marginBottom: "2px",
    }) as React.CSSProperties,

  chipList: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    overflow: "hidden",
  } as React.CSSProperties,

  chip: (type: string) =>
    ({
      display: "flex",
      alignItems: "center",
      gap: "3px",
      padding: "2px 6px",
      borderRadius: "6px",
      fontSize: "10px",
      fontWeight: 500,
      color: "#fff",
      background: TYPE_COLORS[type] ?? "#888",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    }) as React.CSSProperties,

  statusIcon: {
    fontSize: "8px",
    flexShrink: 0,
  } as React.CSSProperties,

  chipLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,

  more: {
    fontSize: "10px",
    color: "var(--text-muted)",
    paddingLeft: "4px",
  } as React.CSSProperties,
};
