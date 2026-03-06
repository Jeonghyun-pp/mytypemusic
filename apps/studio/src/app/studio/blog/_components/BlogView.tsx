"use client";

import { useEffect, useState, useCallback } from "react";

interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  wordCount: number;
  status: string;
  createdAt: string;
}

interface BlogPostFull extends BlogPostSummary {
  content: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
}

const s = {
  page: { display: "flex", flexDirection: "column" as const, gap: 24 },
  section: { display: "flex", flexDirection: "column" as const, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 600, color: "var(--text)" },
  desc: { fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 },
  row: { display: "flex", gap: 8, alignItems: "center" },
  input: { width: "100%", padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: 13 },
  textarea: { width: "100%", minHeight: 400, padding: 16, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: 14, fontFamily: "monospace", resize: "vertical" as const, lineHeight: 1.7 },
  btn: { padding: "10px 24px", borderRadius: "var(--radius-sm)", border: "none", background: "var(--text)", color: "var(--bg)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnOutline: { padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: 12, fontWeight: 500, cursor: "pointer" },
  card: { padding: 16, borderRadius: "var(--radius-sm)", background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" as const, gap: 8 },
  formCard: { padding: 20, borderRadius: "var(--radius-sm)", background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" as const, gap: 16 },
  badge: (color: string) => ({ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: `${color}20`, color }),
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 12 },
  seoPanel: { padding: 16, borderRadius: "var(--radius-sm)", background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" as const, gap: 8, fontSize: 12 },
};

type View = "list" | "editor";

export default function BlogView({ initialTopic, initialOutline }: { initialTopic?: string; initialOutline?: string } = {}) {
  const [view, setView] = useState<View>("list");
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState(initialTopic ?? "");

  // Editor state
  const [editPost, setEditPost] = useState<BlogPostFull | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSeoTitle, setEditSeoTitle] = useState("");
  const [editSeoDesc, setEditSeoDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/blog");
      if (res.ok) setPosts(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  async function handleGenerate() {
    if (!topic.trim() || generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), outline: initialOutline }),
      });
      if (res.ok) {
        const post = await res.json();
        setTopic("");
        loadPosts();
        openEditor(post.id);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function openEditor(postId: string) {
    const res = await fetch(`/api/blog/${postId}`);
    if (res.ok) {
      const post: BlogPostFull = await res.json();
      setEditPost(post);
      setEditContent(post.content);
      setEditSeoTitle(post.seoTitle);
      setEditSeoDesc(post.seoDescription);
      setView("editor");
    }
  }

  async function handleSave() {
    if (!editPost) return;
    setSaving(true);
    try {
      await fetch(`/api/blog/${editPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editContent,
          seoTitle: editSeoTitle,
          seoDescription: editSeoDesc,
        }),
      });
      loadPosts();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/blog/${id}`, { method: "DELETE" });
    if (editPost?.id === id) {
      setEditPost(null);
      setView("list");
    }
    loadPosts();
  }

  if (loading) return <p style={s.desc}>불러오는 중...</p>;

  return (
    <div style={s.page}>
      <div style={s.section}>
        <div style={s.row}>
          <h2 style={s.sectionTitle}>Blog</h2>
          {view === "editor" && (
            <button style={s.btnOutline} onClick={() => setView("list")}>목록으로</button>
          )}
        </div>
        <p style={s.desc}>AI가 2000자 이상의 SEO 최적화된 장문 블로그 글을 생성합니다.</p>
      </div>

      {view === "list" && (
        <>
          {/* Generate form */}
          <div style={s.formCard}>
            <input
              style={s.input}
              placeholder="블로그 주제를 입력하세요 (예: SNS 마케팅 전략 2026)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
            />
            <button style={s.btn} onClick={handleGenerate} disabled={generating || !topic.trim()}>
              {generating ? "생성 중... (1~2분 소요)" : "블로그 글 생성"}
            </button>
          </div>

          {/* Post list */}
          {posts.length === 0 ? (
            <p style={s.desc}>아직 블로그 글이 없습니다. 주제를 입력하고 생성해보세요.</p>
          ) : (
            <div style={s.grid}>
              {posts.map((post) => (
                <div key={post.id} style={{ ...s.card, cursor: "pointer" }} onClick={() => openEditor(post.id)}>
                  <div style={s.row}>
                    <span style={s.badge(post.status === "published" ? "#22c55e" : "#888")}>{post.status}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{post.wordCount.toLocaleString()}자</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{post.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>{post.excerpt}</div>
                  <div style={s.row}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {new Date(post.createdAt).toLocaleString("ko")}
                    </span>
                    <button
                      style={{ ...s.btnOutline, color: "#e55", borderColor: "#e553", fontSize: 11, padding: "2px 8px" }}
                      onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {view === "editor" && editPost && (
        <>
          <div style={{ display: "flex", gap: 16 }}>
            {/* Main editor */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                style={{ ...s.input, fontSize: 18, fontWeight: 600 }}
                value={editPost.title}
                readOnly
              />
              <textarea
                style={s.textarea}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
              <div style={s.row}>
                <button style={s.btn} onClick={handleSave} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
                <a
                  href={`/studio/publish?text=${encodeURIComponent(`${editPost.title}\n\n${editPost.excerpt}`)}`}
                  style={{ ...s.btnOutline, background: "var(--accent)", color: "#fff", borderColor: "var(--accent)", textDecoration: "none" }}
                >
                  SNS 발행
                </a>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {editContent.split(/\s+/).length.toLocaleString()}자
                </span>
              </div>
            </div>

            {/* SEO panel */}
            <div style={{ width: 300, flexShrink: 0 }}>
              <div style={s.seoPanel}>
                <div style={{ fontWeight: 600, color: "var(--text)" }}>SEO 설정</div>
                <label style={{ color: "var(--text-muted)" }}>SEO 제목</label>
                <input
                  style={s.input}
                  value={editSeoTitle}
                  onChange={(e) => setEditSeoTitle(e.target.value)}
                />
                <div style={{ color: editSeoTitle.length > 60 ? "#ef4444" : "var(--text-muted)" }}>
                  {editSeoTitle.length}/60
                </div>

                <label style={{ color: "var(--text-muted)" }}>메타 설명</label>
                <input
                  style={s.input}
                  value={editSeoDesc}
                  onChange={(e) => setEditSeoDesc(e.target.value)}
                />
                <div style={{ color: editSeoDesc.length > 160 ? "#ef4444" : "var(--text-muted)" }}>
                  {editSeoDesc.length}/160
                </div>

                <label style={{ color: "var(--text-muted)" }}>키워드</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {editPost.seoKeywords.map((kw, i) => (
                    <span key={i} style={s.badge("#3DA66E")}>{kw}</span>
                  ))}
                </div>

                <label style={{ color: "var(--text-muted)" }}>Slug</label>
                <div style={{ color: "var(--text)", wordBreak: "break-all" }}>{editPost.slug}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
