"use client";

import { useState } from "react";
import { CONTENT_CATEGORIES } from "@/lib/studio/contentCategories";
import { useDesignDatabase, type DesignEntry } from "./databaseStore";
import EntryCard from "./EntryCard";
import EntryDetail from "./EntryDetail";
import UploadForm from "./UploadForm";
import MoodSearchView from "./MoodSearchView";

type PanelMode = "browse" | "upload" | "detail";
type ViewTab = "references" | "mood-search";

export default function DatabaseView() {
  const store = useDesignDatabase();
  const [filterCategory, setFilterCategory] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<DesignEntry | null>(null);
  const [mode, setMode] = useState<PanelMode>("browse");
  const [activeTab, setActiveTab] = useState<ViewTab>("references");

  const filtered = filterCategory
    ? store.entries.filter((e) => e.category === filterCategory)
    : store.entries;

  function handleCardClick(entry: DesignEntry) {
    setSelectedEntry(entry);
    setMode("detail");
  }

  function handleAddClick() {
    setSelectedEntry(null);
    setMode("upload");
  }

  function handleSave(entry: Omit<DesignEntry, "id" | "createdAt">) {
    store.addEntry(entry);
    setMode("browse");
  }

  function handleDelete(id: string) {
    store.deleteEntry(id);
    setSelectedEntry(null);
    setMode("browse");
  }

  return (
    <div style={s.wrapper}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.title}>Database</span>
          {/* View tabs */}
          <div style={s.viewTabRow}>
            <button
              type="button"
              style={activeTab === "references" ? s.viewTabActive : s.viewTab}
              onClick={() => setActiveTab("references")}
            >
              레퍼런스
            </button>
            <button
              type="button"
              style={activeTab === "mood-search" ? s.viewTabActive : s.viewTab}
              onClick={() => setActiveTab("mood-search")}
            >
              무드 검색
            </button>
          </div>
        </div>
        {activeTab === "references" && (
          <div style={s.headerRight}>
            <select
              style={s.filterSelect}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">전체 카테고리</option>
              {CONTENT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <button type="button" style={s.addBtn} onClick={handleAddClick}>
              + 레퍼런스 추가
            </button>
          </div>
        )}
      </div>

      {/* Mood Search Tab */}
      {activeTab === "mood-search" && <MoodSearchView />}

      {/* References Tab - Body */}
      {activeTab === "references" && <div style={s.body}>
        {/* Grid */}
        <div style={s.gridSection}>
          {filtered.length === 0 ? (
            <div style={s.empty}>
              <p style={s.emptyText}>
                {store.entries.length === 0
                  ? "저장된 레퍼런스가 없습니다.\n오른쪽 상단 '+ 레퍼런스 추가'로 시작하세요."
                  : "해당 카테고리에 레퍼런스가 없습니다."}
              </p>
            </div>
          ) : (
            <div style={s.grid}>
              {filtered.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  isSelected={selectedEntry?.id === entry.id}
                  onClick={() => handleCardClick(entry)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div style={s.sidePanel}>
          {mode === "upload" && (
            <UploadForm
              onSave={handleSave}
              onCancel={() => setMode("browse")}
            />
          )}
          {mode === "detail" && selectedEntry && (
            <EntryDetail
              entry={selectedEntry}
              onUpdate={(id, patch) => {
                store.updateEntry(id, patch);
                setSelectedEntry({ ...selectedEntry, ...patch });
              }}
              onDelete={handleDelete}
              onClose={() => { setSelectedEntry(null); setMode("browse"); }}
            />
          )}
          {mode === "browse" && (
            <div style={s.placeholder}>
              <p style={s.placeholderText}>
                카드를 선택하거나<br />새 레퍼런스를 추가하세요
              </p>
            </div>
          )}
        </div>
      </div>}
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

  viewTabRow: {
    display: "flex",
    gap: "4px",
    background: "var(--bg-input)",
    borderRadius: "10px",
    padding: "3px",
  } as React.CSSProperties,

  viewTab: {
    padding: "6px 16px",
    borderRadius: "8px",
    border: "none",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  viewTabActive: {
    padding: "6px 16px",
    borderRadius: "8px",
    border: "none",
    background: "var(--bg-card)",
    boxShadow: "var(--shadow-card)",
    color: "var(--text)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  } as React.CSSProperties,

  filterSelect: {
    padding: "7px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "12px",
    color: "var(--text)",
    outline: "none",
    cursor: "pointer",
    transition: "border-color var(--transition)",
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
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
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
    width: "360px",
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
  } as React.CSSProperties,
};
