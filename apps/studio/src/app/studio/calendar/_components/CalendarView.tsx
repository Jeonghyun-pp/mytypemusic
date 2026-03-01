"use client";

import { useState } from "react";
import { useCalendarEvents, type CalendarEvent } from "./calendarStore";
import CalendarGrid from "./CalendarGrid";
import EventForm from "./EventForm";

export default function CalendarView() {
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1); // 1-12
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const store = useCalendarEvents();

  function prevMonth() {
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDate(null);
    setEditingEvent(null);
  }

  function nextMonth() {
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDate(null);
    setEditingEvent(null);
  }

  function goToday() {
    const t = new Date();
    setCurrentYear(t.getFullYear());
    setCurrentMonth(t.getMonth() + 1);
    setSelectedDate(null);
    setEditingEvent(null);
  }

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.navGroup}>
          <button style={styles.navBtn} onClick={prevMonth}>
            ←
          </button>
          <h2 style={styles.monthTitle}>
            {currentYear}년 {currentMonth}월
          </h2>
          <button style={styles.navBtn} onClick={nextMonth}>
            →
          </button>
          <button style={styles.todayBtn} onClick={goToday}>
            오늘
          </button>
        </div>
      </div>

      {/* Body: Grid + Side panel */}
      <div style={styles.body}>
        <div style={styles.gridSection}>
          <CalendarGrid
            year={currentYear}
            month={currentMonth}
            events={store.events}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setEditingEvent(null);
            }}
          />
        </div>
        <div style={styles.sidePanel}>
          <EventForm
            selectedDate={selectedDate}
            events={store.events}
            editingEvent={editingEvent}
            onSave={store.addEvent}
            onUpdate={store.updateEvent}
            onDelete={(id) => {
              store.deleteEvent(id);
              if (editingEvent?.id === id) setEditingEvent(null);
            }}
            onEdit={setEditingEvent}
          />
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
  } as React.CSSProperties,

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as React.CSSProperties,

  navGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  } as React.CSSProperties,

  navBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "34px",
    height: "34px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: "16px",
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  monthTitle: {
    fontSize: "20px",
    fontWeight: 700,
    color: "var(--text)",
    minWidth: "140px",
    textAlign: "center" as const,
  } as React.CSSProperties,

  todayBtn: {
    padding: "7px 16px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  body: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
  } as React.CSSProperties,

  gridSection: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  sidePanel: {
    width: "320px",
    flexShrink: 0,
  } as React.CSSProperties,
};
