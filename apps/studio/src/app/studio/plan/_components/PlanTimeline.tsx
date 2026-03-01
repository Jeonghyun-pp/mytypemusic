"use client";

import type { PlanItem } from "@/lib/studio/plan/types";
import PlanItemRow from "./PlanItemRow";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = DAY_NAMES[d.getDay()];
  return `${m}월 ${day}일 (${dow})`;
}

interface PlanTimelineProps {
  items: PlanItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onAddToCalendar: (item: PlanItem) => void;
  onRemoveFromCalendar: (item: PlanItem) => void;
  onAddItem?: () => void;
}

export default function PlanTimeline({
  items,
  selectedItemId,
  onSelectItem,
  onAddToCalendar,
  onRemoveFromCalendar,
  onAddItem,
}: PlanTimelineProps) {
  // Group items by date
  const grouped = new Map<string, PlanItem[]>();
  for (const item of items) {
    const existing = grouped.get(item.date);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(item.date, [item]);
    }
  }

  const sortedDates = [...grouped.keys()].sort();

  if (sortedDates.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyText}>플랜을 생성하면 여기에 타임라인이 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {sortedDates.map((date) => (
        <div key={date} style={styles.dateGroup}>
          <div style={styles.dateHeader}>{formatDateHeader(date)}</div>
          <div style={styles.itemList}>
            {grouped.get(date)!.map((item) => (
              <PlanItemRow
                key={item.id}
                item={item}
                isSelected={item.id === selectedItemId}
                onSelect={() => onSelectItem(item.id)}
                onAddToCalendar={() => onAddToCalendar(item)}
                onRemoveFromCalendar={() => onRemoveFromCalendar(item)}
              />
            ))}
          </div>
        </div>
      ))}
      {onAddItem && (
        <button style={styles.addItemBtn} onClick={onAddItem}>
          + 항목 추가
        </button>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  } as React.CSSProperties,

  dateGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  } as React.CSSProperties,

  dateHeader: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text)",
    padding: "8px 16px 4px",
    position: "sticky" as const,
    top: 0,
    background: "var(--bg-card)",
    zIndex: 1,
  } as React.CSSProperties,

  itemList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  } as React.CSSProperties,

  empty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "200px",
    padding: "40px",
  } as React.CSSProperties,

  emptyText: {
    color: "var(--text-muted)",
    fontSize: "14px",
  } as React.CSSProperties,

  addItemBtn: {
    width: "100%",
    padding: "10px",
    borderRadius: "10px",
    border: "1px dashed var(--border-light)",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
    marginTop: "4px",
  } as React.CSSProperties,
};
