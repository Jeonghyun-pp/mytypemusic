"use client";

import { useState } from "react";

interface ExtractedItem {
  url: string;
  title: string;
  excerpt: string;
  domain: string;
  success: boolean;
  error?: string;
}

interface GeneratedPost {
  url: string;
  title: string;
  domain: string;
  generatedPost: string;
  platform: string;
}

const s = {
  page: { display: "flex", flexDirection: "column" as const, gap: 24 },
  section: { display: "flex", flexDirection: "column" as const, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 600, color: "var(--text)" },
  desc: { fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 },
  textarea: {
    width: "100%",
    minHeight: 120,
    padding: 12,
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 13,
    fontFamily: "inherit",
    resize: "vertical" as const,
    lineHeight: 1.6,
  },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 13,
  },
  btn: {
    padding: "10px 24px",
    borderRadius: "var(--radius-sm)",
    border: "none",
    background: "var(--text)",
    color: "var(--bg)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnOutline: {
    padding: "8px 16px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
  },
  card: {
    padding: 16,
    borderRadius: "var(--radius-sm)",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: 600, color: "var(--text)" },
  cardMeta: { fontSize: 12, color: "var(--text-muted)" },
  cardBody: { fontSize: 13, color: "var(--text)", lineHeight: 1.5 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 12 },
  error: { fontSize: 12, color: "#e55" },
  row: { display: "flex", gap: 8, alignItems: "center" },
  select: {
    padding: "8px 12px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 13,
  },
};

export default function ImportView() {
  const [urlText, setUrlText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const [results, setResults] = useState<ExtractedItem[]>([]);
  const [generated, setGenerated] = useState<GeneratedPost[]>([]);
  const [generating, setGenerating] = useState(false);
  const [platform, setPlatform] = useState("threads");

  async function handleExtract() {
    const urls = urlText
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (!urls.length) return;

    setLoading(true);
    setResults([]);
    setGenerated([]);
    try {
      const res = await fetch("/api/content/link-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, commonInstructions: instructions }),
      });
      const data = await res.json();
      setImportId(data.id);
      setResults((data.results as ExtractedItem[]) ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(urlIndex?: number) {
    if (!importId) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/content/link-import/${importId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, urlIndex }),
      });
      const data = await res.json();
      setGenerated(data.posts ?? []);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Link Import</h2>
        <p style={s.desc}>
          웹 링크를 입력하면 내용을 추출하고 SNS 콘텐츠로 변환합니다. 한 줄에 하나의 URL을 입력하세요.
        </p>
      </div>

      {/* Input form */}
      <div style={s.section}>
        <textarea
          style={s.textarea}
          placeholder={"https://example.com/article1\nhttps://example.com/article2\nhttps://example.com/article3"}
          value={urlText}
          onChange={(e) => setUrlText(e.target.value)}
        />
        <input
          style={s.input}
          placeholder="공통 지시사항 (선택) — 예: 음악 관련 내용 위주로 작성, 20대 타겟"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
        <div>
          <button style={s.btn} onClick={handleExtract} disabled={loading}>
            {loading ? "추출 중..." : "콘텐츠 추출"}
          </button>
        </div>
      </div>

      {/* Extracted results */}
      {results.length > 0 && (
        <div style={s.section}>
          <div style={s.row}>
            <h2 style={s.sectionTitle}>추출 결과 ({results.filter((r) => r.success).length}/{results.length})</h2>
            <select style={s.select} value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="threads">Threads</option>
              <option value="instagram">Instagram</option>
              <option value="x">X (Twitter)</option>
              <option value="linkedin">LinkedIn</option>
            </select>
            <button style={s.btnOutline} onClick={() => handleGenerate()} disabled={generating}>
              {generating ? "생성 중..." : "전체 포스트 생성"}
            </button>
          </div>
          <div style={s.grid}>
            {results.map((item, i) => (
              <div key={item.url} style={s.card}>
                <div style={s.cardTitle}>{item.title}</div>
                <div style={s.cardMeta}>{item.domain}</div>
                {item.success ? (
                  <>
                    <div style={s.cardBody}>{item.excerpt}...</div>
                    <button
                      style={s.btnOutline}
                      onClick={() => handleGenerate(i)}
                      disabled={generating}
                    >
                      포스트 생성
                    </button>
                  </>
                ) : (
                  <div style={s.error}>{item.error}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated posts */}
      {generated.length > 0 && (
        <div style={s.section}>
          <h2 style={s.sectionTitle}>생성된 포스트</h2>
          <div style={s.grid}>
            {generated.map((post, i) => (
              <div key={i} style={s.card}>
                <div style={s.cardMeta}>
                  {post.domain} — {post.platform}
                </div>
                <div style={{ ...s.cardBody, whiteSpace: "pre-wrap" }}>
                  {post.generatedPost}
                </div>
                <button
                  style={s.btnOutline}
                  onClick={() => navigator.clipboard.writeText(post.generatedPost)}
                >
                  복사
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
