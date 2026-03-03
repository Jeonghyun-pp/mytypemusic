"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { PlanItem } from "@/lib/studio/plan/types";
import { useProjectStore } from "./projectStore";
import ProjectCard from "./ProjectCard";
import PlanItemPicker from "./PlanItemPicker";

type FilterTab = "all" | "draft" | "completed";

export default function ProjectBrowser() {
  const router = useRouter();
  const { projects, loading, createProject, deleteProject } = useProjectStore();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [creating, setCreating] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const filteredProjects = filter === "all"
    ? projects
    : projects.filter((p) => p.status === filter);

  // Collect planItemIds already linked to existing projects
  const linkedPlanItemIds = useMemo(
    () => new Set(projects.map((p) => p.planItemId).filter(Boolean) as string[]),
    [projects],
  );

  // Create blank project (no plan item)
  const handleCreateBlank = useCallback(async () => {
    setShowPicker(false);
    setCreating(true);
    try {
      const project = await createProject();
      router.push(`/studio/design?project=${project.id}`);
    } catch { /* ignore */ }
    setCreating(false);
  }, [createProject, router]);

  // Create project from a selected plan item
  const handleSelectPlanItem = useCallback(async (item: PlanItem) => {
    setShowPicker(false);
    setCreating(true);
    try {
      const project = await createProject({
        title: item.title,
        category: item.category,
        planItemId: item.id,
      });
      router.push(`/studio/design?project=${project.id}`);
    } catch { /* ignore */ }
    setCreating(false);
  }, [createProject, router]);

  const handleQuickDesign = useCallback(() => {
    router.push("/studio/design?quick=1");
  }, [router]);

  const handleFilterChange = useCallback((tab: FilterTab) => {
    setFilter(tab);
  }, []);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("이 프로젝트를 삭제하시겠습니까?")) return;
    try { await deleteProject(id); } catch { /* ignore */ }
  }, [deleteProject]);

  return (
    <div style={s.outer}>
      {/* Header */}
      <div style={s.header}>
        <h2 style={s.title}>Design Projects</h2>
        <div style={s.headerActions}>
          <button type="button" style={s.quickBtn} onClick={handleQuickDesign}>
            빠른 디자인
          </button>
          <button
            type="button"
            style={s.newBtn}
            onClick={() => setShowPicker(true)}
            disabled={creating}
          >
            {creating ? "생성 중..." : "+ 새 프로젝트"}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={s.tabs}>
        {(["all", "draft", "completed"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            style={s.tab(tab === filter)}
            onClick={() => handleFilterChange(tab)}
          >
            {tab === "all" ? "전체" : tab === "draft" ? "작업 중" : "완성됨"}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={s.empty}>불러오는 중...</div>
      ) : filteredProjects.length === 0 ? (
        <div style={s.empty}>
          {filter === "all"
            ? "프로젝트가 없습니다. 새 프로젝트를 만들어보세요!"
            : "해당 상태의 프로젝트가 없습니다."}
        </div>
      ) : (
        <div style={s.grid}>
          {filteredProjects.map((p) => (
            <div key={p.id} style={s.cardWrap}>
              <ProjectCard
                project={p}
                onClick={() => router.push(`/studio/design?project=${p.id}`)}
              />
              <button
                type="button"
                style={s.deleteBtn}
                onClick={(e) => void handleDelete(p.id, e)}
                title="삭제"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Plan item picker modal */}
      {showPicker && (
        <PlanItemPicker
          linkedPlanItemIds={linkedPlanItemIds}
          onSelect={(item) => void handleSelectPlanItem(item)}
          onSkip={() => void handleCreateBlank()}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

const s = {
  outer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    padding: "0",
  } as React.CSSProperties,

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  } as React.CSSProperties,

  title: {
    fontSize: "18px",
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
  } as React.CSSProperties,

  headerActions: {
    display: "flex",
    gap: "8px",
  } as React.CSSProperties,

  newBtn: {
    padding: "8px 18px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  quickBtn: {
    padding: "8px 18px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  tabs: {
    display: "flex",
    gap: "4px",
    background: "var(--bg-input)",
    borderRadius: "10px",
    padding: "3px",
    alignSelf: "flex-start",
  } as React.CSSProperties,

  tab: (active: boolean) =>
    ({
      padding: "6px 16px",
      borderRadius: "8px",
      border: "none",
      background: active ? "var(--bg-card)" : "transparent",
      color: active ? "var(--text)" : "var(--text-muted)",
      fontSize: "12px",
      fontWeight: active ? 600 : 400,
      cursor: "pointer",
      transition: "all var(--transition)",
      boxShadow: active ? "var(--shadow-card)" : "none",
    }) as React.CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "16px",
  } as React.CSSProperties,

  cardWrap: {
    position: "relative" as const,
  } as React.CSSProperties,

  deleteBtn: {
    position: "absolute" as const,
    top: "6px",
    right: "6px",
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    border: "none",
    background: "rgba(0,0,0,0.5)",
    color: "#fff",
    fontSize: "14px",
    lineHeight: "1",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.6,
    transition: "opacity var(--transition)",
  } as React.CSSProperties,

  empty: {
    padding: "60px 20px",
    textAlign: "center" as const,
    color: "var(--text-muted)",
    fontSize: "14px",
  } as React.CSSProperties,
};
