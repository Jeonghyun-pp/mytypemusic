"use client";

import { useState, useEffect, useCallback } from "react";

export type ContentType = "post" | "reels" | "promotion";
export type EventStatus = "planned" | "in-progress" | "published";

export interface CalendarEvent {
  id: string;
  date: string; // "YYYY-MM-DD"
  title: string;
  type: ContentType;
  category: string; // contentCategories id (e.g. "scene-news")
  status: EventStatus;
  note: string;
  createdAt: string;
}

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    fetch("/api/db/events")
      .then((r) => r.json())
      .then((data) => setEvents(data as CalendarEvent[]))
      .catch(() => {});
  }, []);

  const addEvent = useCallback(
    async (ev: Omit<CalendarEvent, "id" | "createdAt">): Promise<string> => {
      const res = await fetch("/api/db/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ev),
      });
      const created = (await res.json()) as CalendarEvent;
      setEvents((prev) => [...prev, created]);
      return created.id;
    },
    [],
  );

  const updateEvent = useCallback(
    async (id: string, patch: Partial<CalendarEvent>) => {
      const res = await fetch(`/api/db/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = (await res.json()) as CalendarEvent;
        setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
      }
    },
    [],
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/db/events/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
      }
    },
    [],
  );

  const getEventsForDate = useCallback(
    (date: string) => events.filter((e) => e.date === date),
    [events],
  );

  const getEventsForMonth = useCallback(
    (year: number, month: number) => {
      const prefix = `${year}-${String(month).padStart(2, "0")}`;
      return events.filter((e) => e.date.startsWith(prefix));
    },
    [events],
  );

  return { events, addEvent, updateEvent, deleteEvent, getEventsForDate, getEventsForMonth };
}
