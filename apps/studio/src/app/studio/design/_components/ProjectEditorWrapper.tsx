"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DesignSpecSchema } from "@/lib/studio/designEditor/types";
import type { DesignSpec } from "@/lib/studio/designEditor/types";
import type { DesignProject } from "./projectStore";
import DesignEditor from "./DesignEditor";

interface ProjectEditorWrapperProps {
  projectId: string;
}

export default function ProjectEditorWrapper({ projectId }: ProjectEditorWrapperProps) {
  const router = useRouter();
  const [project, setProject] = useState<DesignProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Load project
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/db/projects/${projectId}`);
        if (!res.ok) {
          setError("프로젝트를 찾을 수 없습니다");
          setLoading(false);
          return;
        }
        const data = (await res.json()) as DesignProject;
        if (!cancelled) {
          setProject(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("프로젝트 로드 실패");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // Parse initialSpec from project (memoized to avoid re-creating on every render)
  const initialSpec = useMemo(() => {
    if (!project?.specJson) return undefined;
    const parsed = DesignSpecSchema.safeParse(project.specJson);
    return parsed.success ? parsed.data : undefined;
  }, [project]);

  // Auto-save callback (3s debounce)
  const handleAutoSave = useCallback(
    (spec: DesignSpec) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setSaving(true);
        const liteSpec = {
          ...spec,
        };
        fetch(`/api/db/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ specJson: liteSpec }),
        })
          .then(() => setSaving(false))
          .catch(() => setSaving(false));
      }, 3000);
    },
    [projectId],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const handleMarkCompleted = useCallback(async () => {
    try {
      const res = await fetch(`/api/db/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        setProject((prev) => prev ? { ...prev, status: "completed" } : prev);
      }
    } catch { /* ignore */ }
  }, [projectId]);

  const handleMarkDraft = useCallback(async () => {
    try {
      const res = await fetch(`/api/db/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });
      if (res.ok) {
        setProject((prev) => prev ? { ...prev, status: "draft" } : prev);
      }
    } catch { /* ignore */ }
  }, [projectId]);

  const handleDelete = useCallback(async () => {
    if (!confirm("이 프로젝트를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/db/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) router.push("/studio/design");
    } catch { /* ignore */ }
  }, [projectId, router]);

  if (loading) {
    return <div style={s.loading}>프로젝트 불러오는 중...</div>;
  }

  if (error || !project) {
    return (
      <div style={s.error}>
        <p>{error || "프로젝트를 찾을 수 없습니다"}</p>
        <button type="button" style={s.backBtn} onClick={() => router.push("/studio/design")}>
          프로젝트 목록으로
        </button>
      </div>
    );
  }

  return (
    <div style={s.outer}>
      {/* Project header bar */}
      <div style={s.header}>
        <button
          type="button"
          style={s.backLink}
          onClick={() => router.push("/studio/design")}
        >
          &larr; 프로젝트 목록
        </button>
        <span style={s.projectTitle}>{project.title}</span>
        <span style={s.statusBadge(project.status)}>
          {project.status === "completed" ? "완성" : "작업 중"}
        </span>
        {saving && <span style={s.savingIndicator}>저장 중...</span>}
        <div style={s.spacer} />
        <button
          type="button"
          style={s.deleteBtn}
          onClick={() => void handleDelete()}
        >
          삭제
        </button>
        {project.status === "draft" ? (
          <button
            type="button"
            style={s.completeBtn}
            onClick={() => void handleMarkCompleted()}
          >
            완성
          </button>
        ) : (
          <button
            type="button"
            style={s.draftBtn}
            onClick={() => void handleMarkDraft()}
          >
            작업 중으로 변경
          </button>
        )}
      </div>

      {/* Design Editor with project context — key forces remount on project change */}
      <DesignEditor
        key={projectId}
        projectId={projectId}
        initialSpec={initialSpec}
        onAutoSave={handleAutoSave}
      />
    </div>
  );
}

const s = {
  outer: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    gap: "0",
  } as React.CSSProperties,

  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 16px",
    borderBottom: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
    flexShrink: 0,
  } as React.CSSProperties,

  backLink: {
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: "6px",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  projectTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text)",
  } as React.CSSProperties,

  statusBadge: (status: string) =>
    ({
      fontSize: "11px",
      fontWeight: 600,
      padding: "2px 10px",
      borderRadius: "8px",
      background: status === "completed" ? "rgba(16,185,129,0.12)" : "rgba(61,166,110,0.12)",
      color: status === "completed" ? "#10B981" : "#3DA66E",
    }) as React.CSSProperties,

  savingIndicator: {
    fontSize: "11px",
    color: "var(--text-muted)",
    fontStyle: "italic" as const,
  } as React.CSSProperties,

  spacer: { flex: 1 } as React.CSSProperties,

  deleteBtn: {
    padding: "6px 16px",
    borderRadius: "8px",
    border: "none",
    background: "rgba(239,68,68,0.08)",
    color: "var(--red, #ef4444)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  completeBtn: {
    padding: "6px 16px",
    borderRadius: "8px",
    border: "none",
    background: "#10B981",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  draftBtn: {
    padding: "6px 16px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  loading: {
    padding: "60px 20px",
    textAlign: "center" as const,
    color: "var(--text-muted)",
    fontSize: "14px",
  } as React.CSSProperties,

  error: {
    padding: "60px 20px",
    textAlign: "center" as const,
    color: "var(--text-muted)",
    fontSize: "14px",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "12px",
  } as React.CSSProperties,

  backBtn: {
    padding: "8px 18px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  } as React.CSSProperties,
};
