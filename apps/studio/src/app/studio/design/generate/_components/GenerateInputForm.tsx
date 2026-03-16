"use client";

import { useState, useCallback, useRef, type ChangeEvent } from "react";
import type { DesignPlatform, ColorMood } from "@/lib/design/types";
import type { GenerateInput } from "./DesignGenerateWizard";

// ── Image Search Types ───────────────────────────────────

interface ImageResult {
  id: string;
  source: "unsplash" | "pexels" | "spotify" | "google";
  previewUrl: string;
  fullUrl: string;
  author: string;
  attribution: string;
}

type ImageTab = "upload" | "search";

// ── Option Data ──────────────────────────────────────────

const PLATFORMS: { value: DesignPlatform; label: string; size: string }[] = [
  { value: "instagram", label: "Instagram", size: "1080×1080" },
  { value: "instagram_story", label: "Story", size: "1080×1920" },
  { value: "twitter", label: "Twitter/X", size: "1200×675" },
  { value: "youtube_thumb", label: "YouTube", size: "1280×720" },
  { value: "facebook", label: "Facebook", size: "1200×630" },
  { value: "blog", label: "Blog", size: "1200×630" },
];

const MOODS: { value: ColorMood; label: string }[] = [
  { value: "vibrant", label: "비비드" },
  { value: "warm", label: "따뜻한" },
  { value: "cool", label: "쿨한" },
  { value: "dark", label: "다크" },
  { value: "pastel", label: "파스텔" },
  { value: "muted", label: "차분한" },
];

const SLIDE_OPTIONS = [1, 3, 5, 7];

// ── Props ────────────────────────────────────────────────

interface Props {
  initialTopic?: string;
  onGenerate: (input: GenerateInput) => void;
}

// ── Component ────────────────────────────────────────────

export default function GenerateInputForm({ initialTopic, onGenerate }: Props) {
  const [topic, setTopic] = useState(initialTopic ?? "");
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState<DesignPlatform>("instagram");
  const [mood, setMood] = useState<ColorMood>("vibrant");
  const [slideCount, setSlideCount] = useState(5);
  const [imageDataUri, setImageDataUri] = useState<string | undefined>();
  const [imageName, setImageName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image search state
  const [imageTab, setImageTab] = useState<ImageTab>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ImageResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);

  const canSubmit = topic.trim().length >= 2;

  // ── Image Search ─────────────────────────────────────

  const handleImageSearch = useCallback(async (q?: string) => {
    const query = q ?? searchQuery;
    if (!query.trim()) return;

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSearching(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q: query, source: "all", page: "1" });
      const res = await fetch(`/api/design/images?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Search failed");
      const data = (await res.json()) as { results: ImageResult[] };
      setSearchResults(data.results);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleSelectSearchImage = useCallback(async (img: ImageResult) => {
    setImageName(`${img.source}: ${img.author}`);
    // Fetch image and convert to data URI
    try {
      const res = await fetch(img.fullUrl);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => {
        setImageDataUri(reader.result as string);
      };
      reader.readAsDataURL(blob);
    } catch {
      // Fallback: use preview URL directly
      setImageDataUri(img.previewUrl);
    }
  }, []);

  // Auto-search when topic changes and search tab is active
  const handleAutoSearch = useCallback(() => {
    if (topic.trim().length >= 2) {
      setSearchQuery(topic.trim());
      void handleImageSearch(topic.trim());
    }
  }, [topic, handleImageSearch]);

  const handleImageUpload = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUri(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveImage = useCallback(() => {
    setImageDataUri(undefined);
    setImageName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    const finalContent =
      content.trim() ||
      `${topic} 관련 웹 매거진 콘텐츠를 생성합니다. 주제의 핵심을 간결하고 임팩트 있게 전달해주세요.`;

    onGenerate({
      topic: topic.trim(),
      content: finalContent,
      platform,
      mood,
      slideCount,
      imageDataUri,
    });
  }, [canSubmit, topic, content, platform, mood, slideCount, imageDataUri, onGenerate]);

  return (
    <div style={s.form}>
      {/* Topic */}
      <div style={s.field}>
        <label style={s.label}>주제 *</label>
        <input
          type="text"
          style={s.input}
          placeholder="예: 뉴진스 여름 컴백, BTS 빌보드 1위"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </div>

      {/* Content */}
      <div style={s.field}>
        <label style={s.label}>
          콘텐츠 내용 <span style={s.optional}>(선택)</span>
        </label>
        <textarea
          style={s.textarea}
          rows={3}
          placeholder="기사 본문이나 핵심 내용을 입력하세요. 비워두면 주제에서 자동 생성됩니다."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      {/* Platform */}
      <div style={s.field}>
        <label style={s.label}>플랫폼</label>
        <div style={s.chips}>
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              type="button"
              style={s.chip(p.value === platform)}
              onClick={() => setPlatform(p.value)}
            >
              <span>{p.label}</span>
              <span style={s.chipSub}>{p.size}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mood */}
      <div style={s.field}>
        <label style={s.label}>무드</label>
        <div style={s.chips}>
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              style={s.chip(m.value === mood)}
              onClick={() => setMood(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Slide Count */}
      <div style={s.field}>
        <label style={s.label}>슬라이드 수</label>
        <div style={s.chips}>
          {SLIDE_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              style={s.chip(n === slideCount)}
              onClick={() => setSlideCount(n)}
            >
              {n}장
            </button>
          ))}
        </div>
      </div>

      {/* Image Section */}
      <div style={s.field}>
        <label style={s.label}>
          이미지 <span style={s.optional}>(선택)</span>
        </label>

        {/* Selected image preview */}
        {imageDataUri ? (
          <div style={s.imagePreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageDataUri} alt="selected" style={s.previewImg} />
            <div style={s.imageInfo}>
              <span style={s.imageName}>{imageName}</span>
              <button type="button" style={s.removeBtn} onClick={handleRemoveImage}>
                제거
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab switcher */}
            <div style={s.imageTabs}>
              <button
                type="button"
                style={s.imageTabBtn(imageTab === "search")}
                onClick={() => { setImageTab("search"); handleAutoSearch(); }}
              >
                이미지 검색
              </button>
              <button
                type="button"
                style={s.imageTabBtn(imageTab === "upload")}
                onClick={() => setImageTab("upload")}
              >
                직접 업로드
              </button>
            </div>

            {imageTab === "search" ? (
              <div style={s.searchSection}>
                <div style={s.searchRow}>
                  <input
                    type="text"
                    style={s.input}
                    placeholder="검색어 입력 (예: NewJeans, album cover)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleImageSearch();
                      }
                    }}
                  />
                  <button
                    type="button"
                    style={s.searchBtn}
                    onClick={() => void handleImageSearch()}
                    disabled={searching}
                  >
                    {searching ? "..." : "검색"}
                  </button>
                </div>

                {searching ? (
                  <div style={s.searchEmpty}>검색 중...</div>
                ) : searchResults.length === 0 ? (
                  <div style={s.searchEmpty}>
                    {searched
                      ? "검색 결과가 없습니다"
                      : "주제를 입력하면 자동으로 이미지를 검색합니다"}
                  </div>
                ) : (
                  <div style={s.searchGrid}>
                    {searchResults.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        style={s.searchCard}
                        onClick={() => void handleSelectSearchImage(img)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.previewUrl}
                          alt={img.attribution}
                          style={s.searchCardImg}
                          loading="lazy"
                          draggable={false}
                        />
                        <div style={s.searchCardOverlay}>
                          <span style={s.sourceBadge(img.source)}>
                            {img.source === "spotify"
                              ? "Spotify"
                              : img.source === "unsplash"
                                ? "Unsplash"
                                : img.source === "pexels"
                                  ? "Pexels"
                                  : "Google"}
                          </span>
                          <span style={s.searchCardAuthor}>{img.author}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                style={s.uploadBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                + 이미지 업로드
              </button>
            )}
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageUpload}
        />
      </div>

      {/* Submit */}
      <button
        type="button"
        style={{
          ...s.generateBtn,
          opacity: canSubmit ? 1 : 0.5,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        AI 디자인 생성
      </button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────

const s = {
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
    background: "var(--bg-card)",
    borderRadius: "14px",
    border: "1px solid var(--border-light)",
    padding: "24px",
  } as React.CSSProperties,

  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  } as React.CSSProperties,

  label: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text)",
  } as React.CSSProperties,

  optional: {
    fontWeight: 400,
    color: "var(--text-muted)",
    fontSize: "12px",
  } as React.CSSProperties,

  input: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "14px",
    outline: "none",
  } as React.CSSProperties,

  textarea: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "14px",
    outline: "none",
    resize: "vertical" as const,
    fontFamily: "inherit",
  } as React.CSSProperties,

  chips: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
  } as React.CSSProperties,

  chip: (active: boolean) =>
    ({
      padding: "8px 16px",
      borderRadius: "10px",
      border: active ? "1.5px solid var(--accent)" : "1px solid var(--border-light)",
      background: active ? "var(--accent-bg, rgba(61,166,110,0.08))" : "var(--bg-input)",
      color: active ? "var(--accent)" : "var(--text-muted)",
      fontSize: "13px",
      fontWeight: active ? 600 : 400,
      cursor: "pointer",
      transition: "all var(--transition)",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: "2px",
    }) as React.CSSProperties,

  chipSub: {
    fontSize: "10px",
    opacity: 0.6,
  } as React.CSSProperties,

  uploadBtn: {
    padding: "24px",
    borderRadius: "10px",
    border: "2px dashed var(--border-light)",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "13px",
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  imagePreview: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px",
    borderRadius: "10px",
    background: "var(--bg-input)",
    border: "1px solid var(--border-light)",
  } as React.CSSProperties,

  previewImg: {
    width: "64px",
    height: "64px",
    objectFit: "cover" as const,
    borderRadius: "8px",
  } as React.CSSProperties,

  imageInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
    flex: 1,
  } as React.CSSProperties,

  imageName: {
    fontSize: "12px",
    color: "var(--text-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  removeBtn: {
    padding: "2px 8px",
    borderRadius: "6px",
    border: "1px solid var(--border-light)",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "11px",
    cursor: "pointer",
    alignSelf: "flex-start",
  } as React.CSSProperties,

  generateBtn: {
    padding: "14px 28px",
    borderRadius: "12px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "all var(--transition)",
    marginTop: "4px",
  } as React.CSSProperties,

  // ── Image Search Styles ──────────────────────────────

  imageTabs: {
    display: "flex",
    gap: "4px",
    background: "var(--bg-input)",
    borderRadius: "8px",
    padding: "3px",
    alignSelf: "flex-start",
  } as React.CSSProperties,

  imageTabBtn: (active: boolean) =>
    ({
      padding: "6px 14px",
      borderRadius: "6px",
      border: "none",
      background: active ? "var(--bg-card)" : "transparent",
      color: active ? "var(--text)" : "var(--text-muted)",
      fontSize: "12px",
      fontWeight: active ? 600 : 400,
      cursor: "pointer",
      boxShadow: active ? "var(--shadow-card)" : "none",
      transition: "all var(--transition)",
    }) as React.CSSProperties,

  searchSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
  } as React.CSSProperties,

  searchRow: {
    display: "flex",
    gap: "6px",
  } as React.CSSProperties,

  searchBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  searchGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
    maxHeight: "240px",
    overflowY: "auto" as const,
  } as React.CSSProperties,

  searchCard: {
    position: "relative" as const,
    borderRadius: "8px",
    overflow: "hidden",
    cursor: "pointer",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    aspectRatio: "1 / 1",
    padding: 0,
    transition: "box-shadow 0.15s ease",
  } as React.CSSProperties,

  searchCardImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    display: "block",
  } as React.CSSProperties,

  searchCardOverlay: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: "4px 6px",
    background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  } as React.CSSProperties,

  sourceBadge: (source: string) =>
    ({
      display: "inline-block",
      padding: "1px 4px",
      borderRadius: "3px",
      fontSize: "8px",
      fontWeight: 600,
      background:
        source === "unsplash" ? "#111" : source === "pexels" ? "#05A081" : source === "spotify" ? "#1DB954" : "#4285F4",
      color: "#fff",
    }) as React.CSSProperties,

  searchCardAuthor: {
    fontSize: "9px",
    color: "#fff",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  searchEmpty: {
    padding: "24px",
    textAlign: "center" as const,
    color: "var(--text-muted)",
    fontSize: "13px",
    background: "var(--bg-input)",
    borderRadius: "8px",
  } as React.CSSProperties,
};
