"use client";

import { useState, useEffect, useCallback } from "react";

export interface DesignEntry {
  id: string;
  category: string;       // contentCategories id
  title: string;
  imageDataUri: string;   // base64 data URI
  html: string;           // generated HTML code
  fontMood: string;       // detected fontMood
  createdAt: string;      // ISO timestamp
}

export function useDesignDatabase() {
  const [entries, setEntries] = useState<DesignEntry[]>([]);

  useEffect(() => {
    fetch("/api/db/designs")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const addEntry = useCallback(
    async (entry: Omit<DesignEntry, "id" | "createdAt">) => {
      const res = await fetch("/api/db/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (res.ok) {
        const created = (await res.json()) as DesignEntry;
        setEntries((prev) => [created, ...prev]);
      }
    },
    [],
  );

  const updateEntry = useCallback(
    async (id: string, patch: Partial<DesignEntry>) => {
      const res = await fetch(`/api/db/designs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = (await res.json()) as DesignEntry;
        setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      }
    },
    [],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/db/designs/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }
    },
    [],
  );

  const getByCategory = useCallback(
    (categoryId: string) =>
      categoryId ? entries.filter((e) => e.category === categoryId) : entries,
    [entries],
  );

  return { entries, addEntry, updateEntry, deleteEntry, getByCategory };
}
