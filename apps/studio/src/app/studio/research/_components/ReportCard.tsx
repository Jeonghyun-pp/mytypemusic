"use client";

import type { BenchmarkReportSummary } from "./researchStore";

interface ReportCardProps {
  report: BenchmarkReportSummary;
  isSelected: boolean;
  onClick: () => void;
}

export default function ReportCard({
  report,
  isSelected,
  onClick,
}: ReportCardProps) {
  const firstScreenshot =
    report.screenshots && report.screenshots.length > 0
      ? report.screenshots[0]?.dataUri ?? null
      : null;

  const dateStr = new Date(report.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      style={{
        ...s.card,
        ...(isSelected ? s.cardSelected : {}),
      }}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div style={s.thumbWrap}>
        {firstScreenshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={firstScreenshot} alt={report.title} style={s.thumb} />
        ) : (
          <div style={s.thumbEmpty}>
            <span style={s.thumbEmptyText}>No Image</span>
          </div>
        )}
        {report.imageCount > 0 && (
          <span style={s.countBadge}>{report.imageCount}</span>
        )}
      </div>

      {/* Info */}
      <div style={s.info}>
        <span style={s.title}>{report.title}</span>
        {report.source && <span style={s.source}>{report.source}</span>}
        <span style={s.date}>{dateStr}</span>
      </div>
    </div>
  );
}

const s = {
  card: {
    borderRadius: "var(--radius-sm)",
    overflow: "hidden",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    cursor: "pointer",
    transition: "all var(--transition)",
    boxShadow: "var(--shadow-card)",
  } as React.CSSProperties,

  cardSelected: {
    border: "1px solid var(--accent)",
    boxShadow: "var(--shadow-hover)",
  } as React.CSSProperties,

  thumbWrap: {
    position: "relative" as const,
    width: "100%",
    aspectRatio: "16/10",
    overflow: "hidden",
    background: "var(--bg-input)",
  } as React.CSSProperties,

  thumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    display: "block",
  } as React.CSSProperties,

  thumbEmpty: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,

  thumbEmptyText: {
    fontSize: "11px",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  countBadge: {
    position: "absolute" as const,
    top: "6px",
    right: "6px",
    fontSize: "10px",
    fontWeight: 700,
    color: "#fff",
    background: "rgba(0,0,0,0.6)",
    padding: "2px 7px",
    borderRadius: "6px",
    backdropFilter: "blur(4px)",
  } as React.CSSProperties,

  info: {
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "3px",
  } as React.CSSProperties,

  title: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  source: {
    fontSize: "11px",
    color: "var(--accent)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  date: {
    fontSize: "10px",
    color: "var(--text-muted)",
  } as React.CSSProperties,
};
