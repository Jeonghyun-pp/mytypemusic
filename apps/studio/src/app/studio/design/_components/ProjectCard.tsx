"use client";

import { CONTENT_CATEGORIES } from "@/lib/studio/contentCategories";
import { CATEGORY_COLORS } from "@/app/studio/database/_components/EntryCard";
import type { ProjectSummary } from "./projectStore";

interface ProjectCardProps {
  project: ProjectSummary;
  onClick: () => void;
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const cat = CONTENT_CATEGORIES.find((c) => c.id === project.category);
  const chipColor = CATEGORY_COLORS[project.category] ?? "#888";
  const date = new Date(project.updatedAt).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });

  return (
    <button type="button" onClick={onClick} style={s.card}>
      <div style={s.imgWrap}>
        {project.thumbnailDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.thumbnailDataUri} alt={project.title} style={s.img} />
        ) : (
          <div style={s.placeholder}>
            <span style={s.placeholderIcon}>+</span>
          </div>
        )}
      </div>
      <div style={s.body}>
        <span style={s.title}>{project.title}</span>
        <div style={s.meta}>
          <span style={s.statusBadge(project.status)}>
            {project.status === "completed" ? "완성" : "작업 중"}
          </span>
          {project.category && (
            <span style={s.chip(chipColor)}>
              {cat?.label.replace(/^\[\d\]\s*/, "") ?? project.category}
            </span>
          )}
          <span style={s.date}>{date}</span>
        </div>
      </div>
    </button>
  );
}

const s = {
  card: {
    display: "flex",
    flexDirection: "column" as const,
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-sm)",
    overflow: "hidden",
    background: "var(--bg-card)",
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all var(--transition)",
    boxShadow: "var(--shadow-card)",
  } as React.CSSProperties,

  imgWrap: {
    width: "100%",
    aspectRatio: "4 / 5",
    overflow: "hidden",
    background: "var(--bg-secondary)",
  } as React.CSSProperties,

  img: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    display: "block",
  } as React.CSSProperties,

  placeholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-input)",
  } as React.CSSProperties,

  placeholderIcon: {
    fontSize: "32px",
    color: "var(--text-muted)",
    opacity: 0.3,
  } as React.CSSProperties,

  body: {
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  } as React.CSSProperties,

  title: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  meta: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  statusBadge: (status: string) =>
    ({
      fontSize: "10px",
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: "6px",
      background: status === "completed" ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.12)",
      color: status === "completed" ? "#10B981" : "#3B82F6",
    }) as React.CSSProperties,

  chip: (color: string) =>
    ({
      fontSize: "10px",
      fontWeight: 500,
      padding: "2px 8px",
      borderRadius: "6px",
      color: "#fff",
      background: color,
    }) as React.CSSProperties,

  date: {
    fontSize: "10px",
    color: "var(--text-muted)",
    marginLeft: "auto",
  } as React.CSSProperties,
};
