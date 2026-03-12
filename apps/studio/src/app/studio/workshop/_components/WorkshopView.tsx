"use client";

import { useState, useEffect, useCallback } from "react";
import TopicDraftList from "./TopicDraftList";
import TopicDraftDetail from "./TopicDraftDetail";
import ManualTopicForm from "./ManualTopicForm";

export interface TopicDraftSummary {
  id: string;
  topic: string;
  angle: string;
  reasoning: string;
  contentType: string;
  status: string;
  sourceType: string;
  trendSources: string[];
  formats: { sns?: string; blog?: string; carousel?: string } | null;
  personaId: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

export default function WorkshopView() {
  const [drafts, setDrafts] = useState<TopicDraftSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);

  const loadDrafts = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/topics?${params}`)
      .then((r) => r.json())
      .then((d: { drafts: TopicDraftSummary[]; total: number }) => {
        setDrafts(d.drafts);
        setTotal(d.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  function handleCreated() {
    setShowManualForm(false);
    loadDrafts();
  }

  function handleDraftUpdated() {
    loadDrafts();
  }

  return (
    <div>
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>Workshop</h1>
        <span style={s.pageSubtitle}>주제 보관함 · 다듬기 · 파이프라인 연결</span>
      </div>

      <div style={s.layout}>
        {/* Left panel: draft list */}
        <div style={s.leftPanel}>
          <div style={s.listHeader}>
            <span style={s.listCount}>{total}개 주제</span>
            <button
              style={s.addBtn}
              onClick={() => setShowManualForm(!showManualForm)}
            >
              {showManualForm ? "닫기" : "+ 직접 추가"}
            </button>
          </div>

          {showManualForm && (
            <ManualTopicForm onCreated={handleCreated} />
          )}

          <TopicDraftList
            drafts={drafts}
            loading={loading}
            selectedId={selectedId}
            statusFilter={statusFilter}
            onSelect={setSelectedId}
            onFilterChange={setStatusFilter}
          />
        </div>

        {/* Right panel: detail + chat */}
        <div style={s.rightPanel}>
          {selectedId ? (
            <TopicDraftDetail
              draftId={selectedId}
              onUpdated={handleDraftUpdated}
              onDeleted={() => {
                setSelectedId(null);
                loadDrafts();
              }}
            />
          ) : (
            <div style={s.emptyDetail}>
              왼쪽에서 주제를 선택하거나 새로 추가하세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  pageHeader: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
  },
  pageSubtitle: {
    fontSize: 13,
    color: "var(--text-muted)",
  },
  layout: {
    display: "flex",
    gap: 20,
    minHeight: "calc(100vh - 160px)",
  } as React.CSSProperties,
  leftPanel: {
    width: 320,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  rightPanel: {
    flex: 1,
    minWidth: 0,
  },
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listCount: {
    fontSize: 12,
    color: "var(--text-muted)",
    fontWeight: 500,
  },
  addBtn: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--accent)",
    background: "none",
    border: "none",
    cursor: "pointer",
  },
  emptyDetail: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    minHeight: 400,
    color: "var(--text-muted)",
    fontSize: 14,
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px dashed var(--border)",
  },
};
