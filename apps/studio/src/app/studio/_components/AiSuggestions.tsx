"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface SuggestionSource {
  label: string;
  url?: string;
}

interface Suggestion {
  topic: string;
  reasoning: string;
  sources?: SuggestionSource[];
  formats: {
    sns: string;
    blog: string;
    carousel: string;
  };
}

interface SuggestionsResponse {
  suggestions: Suggestion[];
  keywords: string[];
}

interface AiSuggestionsProps {
  onQuickPost?: (text: string, hashtags: string) => void;
}

export default function AiSuggestions({ onQuickPost }: AiSuggestionsProps = {}) {
  const [data, setData] = useState<SuggestionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [savingTopicId, setSavingTopicId] = useState<number | null>(null);

  // Keyword editor state
  const [showKeywordEditor, setShowKeywordEditor] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [savingKeywords, setSavingKeywords] = useState(false);

  const loadSuggestions = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch("/api/content/suggestions")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: SuggestionsResponse) => {
        // Backward compat: old API returned { general, niche }
        if (!d.suggestions && (d as unknown as { general: Suggestion[] }).general) {
          const old = d as unknown as { general: Suggestion[]; niche: Suggestion[]; nicheKeywords: string[] };
          setData({
            suggestions: [...(old.niche ?? []), ...(old.general ?? [])],
            keywords: old.nicheKeywords ?? [],
          });
        } else {
          setData(d);
        }
        setKeywords(d.keywords ?? []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  // Load keywords for editor
  useEffect(() => {
    if (showKeywordEditor) {
      fetch("/api/content/suggestions/keywords")
        .then((r) => (r.ok ? r.json() : { keywords: [] }))
        .then((d: { keywords: string[] }) => {
          setKeywords(d.keywords);
          setKeywordInput(d.keywords.join(", "));
        })
        .catch(() => {});
    }
  }, [showKeywordEditor]);

  async function handleSaveKeywords() {
    setSavingKeywords(true);
    try {
      const kws = keywordInput
        .split(/[,\n]+/)
        .map((k) => k.trim())
        .filter(Boolean);
      const res = await fetch("/api/content/suggestions/keywords", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: kws }),
      });
      if (res.ok) {
        const d = await res.json();
        setKeywords(d.keywords);
        setShowKeywordEditor(false);
        loadSuggestions();
      }
    } finally {
      setSavingKeywords(false);
    }
  }

  function removeKeyword(kw: string) {
    const next = keywords.filter((k) => k !== kw);
    setKeywords(next);
    setKeywordInput(next.join(", "));
    fetch("/api/content/suggestions/keywords", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: next }),
    }).then(() => loadSuggestions());
  }

  async function handleSaveTopic(sg: Suggestion, index: number) {
    setSavingTopicId(index);
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: sg.topic,
          reasoning: sg.reasoning,
          sourceType: "suggestion",
          sourceData: sg,
          trendSources: sg.sources?.map((s) => s.label) ?? [],
          formats: sg.formats,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } finally {
      setSavingTopicId(null);
    }
  }

  const noKeywords = !keywords || keywords.length === 0;
  const noSuggestions = !data || data.suggestions.length === 0;

  // Keyword bar is always rendered (even during loading/error)
  const keywordBar = (
    <div style={s.keywordBar}>
      <div style={s.keywordRow}>
        <span style={s.keywordLabel}>니치 키워드</span>
        {!noKeywords ? (
          <div style={s.keywordChips}>
            {keywords.map((kw) => (
              <span key={kw} style={s.keywordChip}>
                {kw}
                <button
                  style={s.chipRemove}
                  onClick={() => removeKeyword(kw)}
                  title="삭제"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        ) : (
          <span style={s.keywordEmpty}>
            키워드를 설정하면 AI 주제 추천을 받을 수 있습니다
          </span>
        )}
        <button
          style={s.keywordEditBtn}
          onClick={() => setShowKeywordEditor(!showKeywordEditor)}
        >
          {showKeywordEditor ? "닫기" : "편집"}
        </button>
      </div>

      {showKeywordEditor && (
        <div style={s.keywordEditor}>
          <input
            style={s.keywordInput}
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="예: 밴드음악, 인디밴드, 라이브공연, 페스티벌, 음악 리뷰"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveKeywords();
            }}
          />
          <button
            style={s.keywordSaveBtn}
            onClick={handleSaveKeywords}
            disabled={savingKeywords}
          >
            {savingKeywords ? "저장 중..." : "저장 & 새로고침"}
          </button>
        </div>
      )}
    </div>
  );

  if (error) {
    return (
      <div style={s.wrapper}>
        {keywordBar}
      </div>
    );
  }
  if (loading) {
    return (
      <div style={s.wrapper}>
        {keywordBar}
        <div style={s.header}>
          <span style={s.title}>AI 주제 추천</span>
          <span style={s.subtitle}>트렌드를 분석하고 있습니다...</span>
        </div>
        <div style={s.grid}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={s.card}>
              <div className="skeleton" style={{ height: 16, width: "60%" }} />
              <div className="skeleton" style={{ height: 12, width: "90%", marginTop: 8 }} />
              <div className="skeleton" style={{ height: 32, marginTop: 12 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={s.wrapper}>
      {/* ── Keywords bar (always visible) ── */}
      {keywordBar}

      {/* ── No keywords message ── */}
      {noKeywords && (
        <div style={s.emptyState}>
          키워드를 설정하면 실시간 트렌드 기반 AI 주제 추천을 받을 수 있습니다.
          <br />
          위의 &quot;편집&quot; 버튼을 눌러 키워드를 추가해보세요.
        </div>
      )}

      {/* ── Suggestions grid ── */}
      {!noKeywords && !noSuggestions && (
        <div style={s.section}>
          <div style={s.header}>
            <span style={s.title}>AI 주제 추천</span>
            <span style={s.subtitle}>{keywords.join(", ")} + 실시간 트렌드 기반</span>
          </div>
          <div className="animate-stagger" style={s.grid}>
            {data.suggestions.map((sg, i) => (
              <SuggestionCard
                key={i}
                sg={sg}
                index={i}
                onQuickPost={onQuickPost}
                onSave={handleSaveTopic}
                saving={savingTopicId === i}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Suggestion Card ──────────────────────────────────

function SuggestionCard({
  sg,
  index,
  onQuickPost,
  onSave,
  saving,
}: {
  sg: Suggestion;
  index: number;
  onQuickPost?: (text: string, hashtags: string) => void;
  onSave: (sg: Suggestion, index: number) => void;
  saving: boolean;
}) {
  const [saved, setSaved] = useState(false);

  return (
    <div className="card-hover" style={s.card}>
      <div style={s.topicTitle}>{sg.topic}</div>
      <div style={s.reasoning}>{sg.reasoning}</div>
      {sg.sources && sg.sources.length > 0 && (
        <div style={s.sourcesRow}>
          {sg.sources.map((src, i) =>
            src.url ? (
              <a
                key={i}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                style={s.sourceLink}
                title={src.label}
              >
                {src.label}
              </a>
            ) : (
              <span key={i} style={s.sourceTag}>
                {src.label}
              </span>
            ),
          )}
        </div>
      )}
      <div style={s.formatPreview}>
        <div style={s.formatLabel}>SNS</div>
        <div style={s.formatText}>{sg.formats.sns}</div>
      </div>
      <div style={s.actions}>
        <button
          style={{
            ...s.actionBtn,
            ...s.saveBtn,
            cursor: saving || saved ? "default" : "pointer",
            opacity: saved ? 0.6 : 1,
          }}
          onClick={() => {
            if (saving || saved) return;
            onSave(sg, index);
            setSaved(true);
          }}
          disabled={saving || saved}
        >
          {saving ? "저장 중..." : saved ? "보관됨" : "보관"}
        </button>
        <Link
          href={`/studio/design?quick=1&topic=${encodeURIComponent(sg.topic)}&carousel=${encodeURIComponent(sg.formats.carousel)}`}
          style={s.actionBtn}
        >
          카드뉴스
        </Link>
        <Link
          href={`/studio/blog?topic=${encodeURIComponent(sg.topic)}&outline=${encodeURIComponent(sg.formats.blog)}`}
          style={s.actionBtn}
        >
          블로그
        </Link>
        {onQuickPost ? (
          <button
            style={{ ...s.actionBtn, cursor: "pointer" }}
            onClick={() => {
              const hashtagMatch = sg.formats.sns.match(/#[\w가-힣]+/g);
              const tags = hashtagMatch
                ? hashtagMatch.map((t) => t.slice(1)).join(", ")
                : "";
              const cleanText = sg.formats.sns
                .replace(/#[\w가-힣]+/g, "")
                .trim();
              onQuickPost(cleanText, tags);
            }}
          >
            빠른 발행
          </button>
        ) : (
          <Link
            href={`/studio/publish?text=${encodeURIComponent(sg.formats.sns)}`}
            style={s.actionBtn}
          >
            포스트
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────

const s = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    color: "var(--text)",
  },
  subtitle: {
    fontSize: 12,
    color: "var(--text-muted)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: "var(--radius-sm)",
    background: "var(--bg-card)",
    border: "1px solid var(--border-light)",
    boxShadow: "var(--shadow-card)",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  topicTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
  },
  reasoning: {
    fontSize: 12,
    color: "var(--text-muted)",
    lineHeight: 1.5,
  },
  sourcesRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
  },
  sourceLink: {
    fontSize: 11,
    color: "var(--accent)",
    textDecoration: "none",
    padding: "2px 8px",
    borderRadius: 4,
    background: "var(--accent-light)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 200,
    display: "inline-block",
  },
  sourceTag: {
    fontSize: 11,
    color: "var(--text-muted)",
    padding: "2px 8px",
    borderRadius: 4,
    background: "var(--bg-input)",
    whiteSpace: "nowrap" as const,
  },
  formatPreview: {
    padding: "8px 10px",
    background: "var(--bg-input)",
    borderRadius: 6,
    fontSize: 12,
    color: "var(--text-muted)",
    lineHeight: 1.4,
  },
  formatLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--text)",
    textTransform: "uppercase" as const,
    marginBottom: 4,
  },
  formatText: {
    fontSize: 12,
    color: "var(--text-muted)",
    lineHeight: 1.4,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
  },
  actions: {
    display: "flex",
    gap: 6,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: 11,
    fontWeight: 600,
    textDecoration: "none",
    textAlign: "center" as const,
    transition: "all 0.15s",
  },
  saveBtn: {
    background: "var(--accent-light)",
    color: "var(--accent)",
    borderColor: "var(--accent)",
  },
  emptyState: {
    padding: "24px 16px",
    textAlign: "center" as const,
    color: "var(--text-muted)",
    fontSize: 13,
    lineHeight: 1.6,
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px dashed var(--border)",
  },

  // Keyword bar
  keywordBar: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    padding: "12px 16px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border-light)",
  },
  keywordRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap" as const,
  },
  keywordLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    flexShrink: 0,
  },
  keywordChips: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
    flex: 1,
  },
  keywordChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 10px",
    borderRadius: 6,
    background: "var(--accent-light)",
    color: "var(--accent)",
    fontSize: 12,
    fontWeight: 500,
  },
  chipRemove: {
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontSize: 14,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    opacity: 0.6,
  },
  keywordEmpty: {
    fontSize: 12,
    color: "var(--text-muted)",
    flex: 1,
  },
  keywordEditBtn: {
    fontSize: 11,
    fontWeight: 500,
    color: "var(--accent)",
    background: "none",
    border: "none",
    cursor: "pointer",
    textDecoration: "underline" as const,
    flexShrink: 0,
  },
  keywordEditor: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  keywordInput: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
  },
  keywordSaveBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
};
