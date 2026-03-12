"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import QuickPublishPanel from "../../_components/QuickPublishPanel";

interface Persona {
  id: string;
  name: string;
}

interface MultiResult {
  sns: { text: string; hashtags: string[] };
  blog: { title: string; outline: string };
  carousel: { concept: string; slideCount: number; slideTopics: string[] };
}

interface TopicDraftItem {
  id: string;
  topic: string;
  status: string;
  sourceType: string;
}

interface SuggestionItem {
  topic: string;
  reasoning: string;
}

type TopicSource = "manual" | "workshop" | "suggestions";

export default function CreateHub() {
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState(searchParams.get("topic") ?? "");
  const [personaId, setPersonaId] = useState("");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<MultiResult | null>(null);

  // Topic picker state
  const [topicSource, setTopicSource] = useState<TopicSource>("manual");
  const [workshopDrafts, setWorkshopDrafts] = useState<TopicDraftItem[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  useEffect(() => {
    fetch("/api/persona")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Persona[]) => setPersonas(data))
      .catch(() => {});
  }, []);

  // Load workshop drafts
  useEffect(() => {
    if (topicSource === "workshop" && workshopDrafts.length === 0) {
      setLoadingTopics(true);
      fetch("/api/topics?limit=20")
        .then((r) => r.json())
        .then((d: { drafts: TopicDraftItem[] }) => setWorkshopDrafts(d.drafts))
        .catch(() => {})
        .finally(() => setLoadingTopics(false));
    }
  }, [topicSource, workshopDrafts.length]);

  // Load AI suggestions
  useEffect(() => {
    if (topicSource === "suggestions" && suggestions.length === 0) {
      setLoadingTopics(true);
      fetch("/api/content/suggestions")
        .then((r) => r.json())
        .then((d: { suggestions: SuggestionItem[] }) => setSuggestions(d.suggestions ?? []))
        .catch(() => {})
        .finally(() => setLoadingTopics(false));
    }
  }, [topicSource, suggestions.length]);

  async function handleGenerate() {
    if (!topic.trim() || generating) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/content/multi-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), personaId: personaId || undefined }),
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Create Hub</h2>
        <p style={s.desc}>하나의 주제로 SNS 포스트, 블로그, 카드뉴스를 동시에 생성합니다.</p>
      </div>

      {/* Topic source tabs */}
      <div style={s.sourceTabs}>
        <button
          style={{ ...s.sourceTab, ...(topicSource === "manual" ? s.sourceTabActive : {}) }}
          onClick={() => setTopicSource("manual")}
        >
          직접 입력
        </button>
        <button
          style={{ ...s.sourceTab, ...(topicSource === "workshop" ? s.sourceTabActive : {}) }}
          onClick={() => setTopicSource("workshop")}
        >
          보관함에서 선택
        </button>
        <button
          style={{ ...s.sourceTab, ...(topicSource === "suggestions" ? s.sourceTabActive : {}) }}
          onClick={() => setTopicSource("suggestions")}
        >
          AI 추천에서 선택
        </button>
      </div>

      {/* Input area */}
      <div style={s.formCard}>
        {topicSource === "manual" && (
          <input
            style={s.input}
            placeholder="주제를 입력하세요 (예: 실리카겔 'NO PAIN' 기타 톤 분석)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
          />
        )}

        {topicSource === "workshop" && (
          <div style={s.topicPicker}>
            {loadingTopics ? (
              <div style={s.pickerEmpty}>불러오는 중...</div>
            ) : workshopDrafts.length === 0 ? (
              <div style={s.pickerEmpty}>
                보관함에 저장된 주제가 없습니다.{" "}
                <Link href="/studio/workshop" style={{ color: "var(--accent)" }}>Workshop으로 이동</Link>
              </div>
            ) : (
              <div style={s.pickerList}>
                {workshopDrafts.map((d) => (
                  <button
                    key={d.id}
                    style={{
                      ...s.pickerItem,
                      ...(topic === d.topic ? s.pickerItemActive : {}),
                    }}
                    onClick={() => setTopic(d.topic)}
                  >
                    <span style={s.pickerTopic}>{d.topic}</span>
                    <span style={s.pickerBadge}>
                      {d.sourceType === "suggestion" ? "AI 추천" : d.sourceType === "manual" ? "직접" : d.sourceType}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {topicSource === "suggestions" && (
          <div style={s.topicPicker}>
            {loadingTopics ? (
              <div style={s.pickerEmpty}>트렌드를 분석하고 있습니다...</div>
            ) : suggestions.length === 0 ? (
              <div style={s.pickerEmpty}>
                키워드를 먼저 설정하세요. 대시보드에서 니치 키워드를 등록하면 AI 추천을 받을 수 있습니다.
              </div>
            ) : (
              <div style={s.pickerList}>
                {suggestions.map((sg, i) => (
                  <button
                    key={i}
                    style={{
                      ...s.pickerItem,
                      ...(topic === sg.topic ? s.pickerItemActive : {}),
                    }}
                    onClick={() => setTopic(sg.topic)}
                  >
                    <span style={s.pickerTopic}>{sg.topic}</span>
                    <span style={s.pickerReasoning}>{sg.reasoning}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected topic display (for workshop/suggestions) */}
        {topicSource !== "manual" && topic && (
          <div style={s.selectedTopic}>
            선택된 주제: <strong>{topic}</strong>
          </div>
        )}

        <div style={s.row}>
          {personas.length > 0 && (
            <select style={s.select} value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
              <option value="">페르소나 없음</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button style={s.btn} onClick={handleGenerate} disabled={generating || !topic.trim()}>
            {generating ? "생성 중..." : "3가지 포맷 생성"}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div style={s.grid}>
          {/* SNS Post */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <span style={s.cardBadge}>SNS</span>
            </div>
            <div style={s.cardBody}>{result.sns.text}</div>
            <div style={s.cardTags}>
              {result.sns.hashtags.map((h, i) => (
                <span key={i} style={s.tag}>#{h}</span>
              ))}
            </div>
            <Link
              href={`/studio/publish?text=${encodeURIComponent(result.sns.text)}&hashtags=${encodeURIComponent(result.sns.hashtags.join(","))}`}
              style={s.cardAction}
            >
              상세 발행 →
            </Link>
            <QuickPublishPanel text={result.sns.text} hashtags={result.sns.hashtags} />
          </div>

          {/* Blog */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <span style={{ ...s.cardBadge, background: "rgba(16,185,129,0.12)", color: "#10b981" }}>블로그</span>
            </div>
            <div style={{ ...s.cardBody, fontWeight: 600 }}>{result.blog.title}</div>
            <div style={{ ...s.cardBody, fontSize: 12, whiteSpace: "pre-wrap" }}>{result.blog.outline}</div>
            <Link
              href={`/studio/blog?topic=${encodeURIComponent(topic)}`}
              style={s.cardAction}
            >
              블로그 작성 →
            </Link>
          </div>

          {/* Carousel */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <span style={{ ...s.cardBadge, background: "rgba(139,92,246,0.12)", color: "#8b5cf6" }}>카드뉴스</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{result.carousel.slideCount}장</span>
            </div>
            <div style={s.cardBody}>{result.carousel.concept}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {result.carousel.slideTopics.map((t, i) => (
                <div key={i} style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {i + 1}. {t}
                </div>
              ))}
            </div>
            <Link
              href={`/studio/design?quick=1&topic=${encodeURIComponent(topic)}`}
              style={s.cardAction}
            >
              디자인 에디터 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { display: "flex", flexDirection: "column" as const, gap: 24 },
  section: { display: "flex", flexDirection: "column" as const, gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 600, color: "var(--text)" },
  desc: { fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 },
  row: { display: "flex", gap: 8, alignItems: "center" },
  input: { width: "100%", padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: 14 },
  select: { padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: 13 },
  btn: { padding: "10px 24px", borderRadius: "var(--radius-sm)", border: "none", background: "var(--text)", color: "var(--bg)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  formCard: { padding: 20, borderRadius: "var(--radius-sm)", background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" as const, gap: 12 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 },
  card: {
    padding: 16,
    borderRadius: "var(--radius-sm)",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  cardHeader: { display: "flex", alignItems: "center", gap: 8 },
  cardBadge: { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "rgba(61,166,110,0.12)", color: "#3DA66E" },
  cardBody: { fontSize: 13, color: "var(--text)", lineHeight: 1.5 },
  cardTags: { display: "flex", gap: 4, flexWrap: "wrap" as const },
  tag: { fontSize: 11, color: "var(--text-muted)", background: "var(--bg-input)", padding: "2px 6px", borderRadius: 4 },
  cardAction: {
    marginTop: 4,
    padding: "8px 14px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: 12,
    fontWeight: 600,
    textDecoration: "none",
    textAlign: "center" as const,
    transition: "all 0.15s",
  },

  // Topic source tabs
  sourceTabs: {
    display: "flex",
    gap: 4,
  },
  sourceTab: {
    padding: "6px 14px",
    borderRadius: 8,
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text-muted)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  sourceTabActive: {
    background: "var(--accent-light)",
    color: "var(--accent)",
    borderColor: "var(--accent)",
  },

  // Topic picker
  topicPicker: {
    maxHeight: 240,
    overflowY: "auto" as const,
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-sm)",
  },
  pickerList: {
    display: "flex",
    flexDirection: "column" as const,
  },
  pickerItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    padding: "10px 14px",
    border: "none",
    borderBottom: "1px solid var(--border-light)",
    background: "transparent",
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "background 0.1s",
    width: "100%",
  },
  pickerItemActive: {
    background: "var(--accent-light)",
  },
  pickerTopic: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
  },
  pickerBadge: {
    fontSize: 10,
    color: "var(--text-muted)",
    padding: "1px 6px",
    borderRadius: 4,
    background: "var(--bg-input)",
    alignSelf: "flex-start" as const,
  },
  pickerReasoning: {
    fontSize: 11,
    color: "var(--text-muted)",
    lineHeight: 1.4,
  },
  pickerEmpty: {
    padding: 20,
    textAlign: "center" as const,
    color: "var(--text-muted)",
    fontSize: 13,
  },
  selectedTopic: {
    padding: "8px 12px",
    borderRadius: 6,
    background: "var(--accent-light)",
    color: "var(--accent)",
    fontSize: 13,
  },
};
