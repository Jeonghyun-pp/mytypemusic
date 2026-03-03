"use client";

import { useState, useEffect, useCallback } from "react";
import type { DesignSpec } from "@/lib/studio/designEditor/types";
import { createDefaultDesignSpec } from "@/lib/studio/designEditor/defaultSlides";

export interface DesignProject {
  id: string;
  title: string;
  status: string;
  category: string;
  specJson: DesignSpec;
  thumbnailDataUri: string;
  planItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Summary used in project list (no specJson for performance) */
export type ProjectSummary = Omit<DesignProject, "specJson">;

export function useProjectStore() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const url = status
        ? `/api/db/projects?status=${status}`
        : "/api/db/projects";
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as ProjectSummary[];
        setProjects(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(
    async (opts: { title?: string; category?: string; planItemId?: string } = {}) => {
      const spec = createDefaultDesignSpec();
      const res = await fetch("/api/db/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: opts.title ?? "새 프로젝트",
          category: opts.category ?? "",
          specJson: spec,
          planItemId: opts.planItemId ?? null,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? `생성 실패 (${String(res.status)})`);
      }
      const created = (await res.json()) as DesignProject;
      setProjects((prev) => [created, ...prev]);
      return created;
    },
    [],
  );

  const loadProject = useCallback(async (id: string): Promise<DesignProject | null> => {
    const res = await fetch(`/api/db/projects/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as DesignProject;
  }, []);

  const saveProject = useCallback(
    async (id: string, patch: Partial<Pick<DesignProject, "specJson" | "title" | "category" | "thumbnailDataUri">>) => {
      const res = await fetch(`/api/db/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = (await res.json()) as DesignProject;
        setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
      }
    },
    [],
  );

  const markCompleted = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/db/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        const updated = (await res.json()) as DesignProject;
        setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
      }
    },
    [],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/db/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
      }
    },
    [],
  );

  return {
    projects,
    loading,
    fetchProjects,
    createProject,
    loadProject,
    saveProject,
    markCompleted,
    deleteProject,
  };
}
