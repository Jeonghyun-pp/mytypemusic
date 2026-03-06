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

export default function CreateHub() {
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState(searchParams.get("topic") ?? "");
  const [personaId, setPersonaId] = useState("");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<MultiResult | null>(null);

  useEffect(() => {
    fetch("/api/persona")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Persona[]) => setPersonas(data))
      .catch(() => {});
  }, []);

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

      {/* Input */}
      <div style={s.formCard}>
        <input
          style={s.input}
          placeholder="주제를 입력하세요 (예: 2026 SNS 트렌드 전망)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
        />
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
};
