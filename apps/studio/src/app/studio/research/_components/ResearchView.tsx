"use client";

import { useState, useCallback } from "react";
import { useResearchReports, type BenchmarkReportSummary } from "./researchStore";
import ReportCard from "./ReportCard";
import ReportDetail from "./ReportDetail";
import AnalyzeForm from "./AnalyzeForm";

type PanelMode = "browse" | "new" | "detail";

export default function ResearchView() {
  const store = useResearchReports();
  const [mode, setMode] = useState<PanelMode>("browse");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleNewClick = useCallback(() => {
    setSelectedId(null);
    setMode("new");
  }, []);

  const handleCardClick = useCallback((report: BenchmarkReportSummary) => {
    setSelectedId(report.id);
    setMode("detail");
  }, []);

  const handleAnalyzeComplete = useCallback(
    (reportId: string) => {
      // Reload list to get the new report
      setSelectedId(reportId);
      setMode("detail");
      // Refresh the list
      window.location.reload();
    },
    [],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await store.deleteReport(id);
      setSelectedId(null);
      setMode("browse");
    },
    [store],
  );

  return (
    <div style={s.wrapper}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.title}>Research</span>
          <span style={s.count}>{store.reports.length}개</span>
        </div>
        <button type="button" style={s.addBtn} onClick={handleNewClick}>
          + 새 리서치
        </button>
      </div>

      {/* Body */}
      <div style={s.body}>
        {/* Grid */}
        <div style={s.gridSection}>
          {store.loading ? (
            <div style={s.empty}>
              <p style={s.emptyText}>로딩 중...</p>
            </div>
          ) : store.reports.length === 0 ? (
            <div style={s.empty}>
              <p style={s.emptyText}>
                {"저장된 리서치가 없습니다.\n오른쪽 상단 '+ 새 리서치'로 시작하세요."}
              </p>
            </div>
          ) : (
            <div style={s.grid}>
              {store.reports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  isSelected={selectedId === report.id}
                  onClick={() => handleCardClick(report)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div style={s.sidePanel}>
          {mode === "new" && (
            <AnalyzeForm
              onComplete={handleAnalyzeComplete}
              onCancel={() => setMode("browse")}
            />
          )}
          {mode === "detail" && selectedId && (
            <ReportDetail
              reportId={selectedId}
              onDelete={handleDelete}
              onClose={() => {
                setSelectedId(null);
                setMode("browse");
              }}
            />
          )}
          {mode === "browse" && (
            <div style={s.placeholder}>
              <p style={s.placeholderText}>
                리포트를 선택하거나{"\n"}새 리서치를 시작하세요
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
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

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  } as React.CSSProperties,

  title: {
    fontSize: "20px",
    fontWeight: 700,
    color: "var(--text)",
  } as React.CSSProperties,

  count: {
    fontSize: "13px",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  addBtn: {
    padding: "8px 16px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
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

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "14px",
  } as React.CSSProperties,

  empty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "300px",
    borderRadius: "var(--radius-xl)",
    border: "2px dashed var(--border-light)",
  } as React.CSSProperties,

  emptyText: {
    fontSize: "14px",
    color: "var(--text-muted)",
    textAlign: "center" as const,
    whiteSpace: "pre-line" as const,
    lineHeight: 1.6,
  } as React.CSSProperties,

  sidePanel: {
    width: "400px",
    flexShrink: 0,
  } as React.CSSProperties,

  placeholder: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 20px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    boxShadow: "var(--shadow-card)",
  } as React.CSSProperties,

  placeholderText: {
    fontSize: "13px",
    color: "var(--text-muted)",
    textAlign: "center" as const,
    lineHeight: 1.6,
    whiteSpace: "pre-line" as const,
  } as React.CSSProperties,
};
