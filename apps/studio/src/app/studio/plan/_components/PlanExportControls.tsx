"use client";

import type { PlanItem } from "@/lib/studio/plan/types";
import { downloadICS } from "@/lib/studio/plan/icsGenerator";

interface PlanExportControlsProps {
  items: PlanItem[];
  onAddAllToCalendar: () => void;
  onRemoveAllFromCalendar: () => void;
}

export default function PlanExportControls({
  items,
  onAddAllToCalendar,
  onRemoveAllFromCalendar,
}: PlanExportControlsProps) {
  const addedCount = items.filter((i) => i.addedToCalendar).length;
  const remaining = items.length - addedCount;

  return (
    <div style={styles.container}>
      <div style={styles.stats}>
        <span style={styles.statItem}>{items.length}개 항목</span>
        {addedCount > 0 && (
          <span style={styles.statDone}>{addedCount}개 추가됨</span>
        )}
      </div>

      <div style={styles.btnRow}>
        {remaining > 0 && (
          <button style={styles.btn} onClick={onAddAllToCalendar}>
            전체 캘린더 추가 ({remaining})
          </button>
        )}
        {addedCount > 0 && (
          <button style={styles.btnRemove} onClick={onRemoveAllFromCalendar}>
            전체 캘린더 제거 ({addedCount})
          </button>
        )}
        <button
          style={styles.btn}
          onClick={() => downloadICS(items, "content-plan.ics")}
        >
          ICS 다운로드
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
    padding: "16px",
    borderRadius: "12px",
    background: "var(--bg-input)",
  } as React.CSSProperties,

  stats: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  } as React.CSSProperties,

  statItem: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text)",
  } as React.CSSProperties,

  statDone: {
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--green)",
  } as React.CSSProperties,

  btnRow: {
    display: "flex",
    gap: "8px",
  } as React.CSSProperties,

  btn: {
    flex: 1,
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  btnRemove: {
    flex: 1,
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid rgba(239,68,68,0.2)",
    background: "rgba(239,68,68,0.06)",
    color: "var(--red)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,
};
