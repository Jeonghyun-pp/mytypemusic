"use client";

import type { CalendarEvent } from "./calendarStore";
import DayCell from "./DayCell";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

interface CalendarGridProps {
  year: number;
  month: number; // 1-12
  events: CalendarEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const cells: { date: number; fullDate: string; isCurrentMonth: boolean }[] = [];

  // previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    cells.push({ date: d, fullDate: toDateStr(y, m, d), isCurrentMonth: false });
  }

  // current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: d, fullDate: toDateStr(year, month, d), isCurrentMonth: true });
  }

  // next month leading days (fill to 42 cells = 6 rows)
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    cells.push({ date: d, fullDate: toDateStr(y, m, d), isCurrentMonth: false });
  }

  return cells;
}

export default function CalendarGrid({
  year,
  month,
  events,
  selectedDate,
  onSelectDate,
}: CalendarGridProps) {
  const cells = buildCalendarDays(year, month);
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

  // index events by date for fast lookup
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    (eventsByDate[ev.date] ??= []).push(ev);
  }

  return (
    <div>
      {/* Day labels */}
      <div style={styles.header}>
        {DAY_LABELS.map((label) => (
          <div key={label} style={styles.dayLabel}>
            {label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={styles.grid}>
        {cells.map((cell) => (
          <DayCell
            key={cell.fullDate}
            date={cell.date}
            fullDate={cell.fullDate}
            isCurrentMonth={cell.isCurrentMonth}
            isToday={cell.fullDate === todayStr}
            isSelected={cell.fullDate === selectedDate}
            events={eventsByDate[cell.fullDate] ?? []}
            onClick={() => onSelectDate(cell.fullDate)}
          />
        ))}
      </div>
    </div>
  );
}

const styles = {
  header: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "4px",
    marginBottom: "4px",
  } as React.CSSProperties,
  dayLabel: {
    textAlign: "center" as const,
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-muted)",
    padding: "6px 0",
  } as React.CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "4px",
  } as React.CSSProperties,
};
