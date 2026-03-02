"use client";

import { useState, useRef } from "react";

interface AnalyzeFormProps {
  onComplete: (reportId: string) => void;
  onCancel: () => void;
}

export default function AnalyzeForm({ onComplete, onCancel }: AnalyzeFormProps) {
  const [images, setImages] = useState<Array<{ dataUri: string; file: File }>>(
    [],
  );
  const [textContent, setTextContent] = useState("");
  const [source, setSource] = useState("");
  const [title, setTitle] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | File[]) {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const remaining = 10 - images.length;
    const toAdd = fileArr.slice(0, remaining);

    for (const file of toAdd) {
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => {
          if (prev.length >= 10) return prev;
          return [...prev, { dataUri: reader.result as string, file }];
        });
      };
      reader.readAsDataURL(file);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAnalyze() {
    if (images.length === 0 && !textContent.trim()) return;
    setAnalyzing(true);
    setError("");

    try {
      const form = new FormData();
      images.forEach((img, i) => {
        form.append(`image${String(i)}`, img.file, `screenshot_${String(i)}.png`);
      });
      if (textContent.trim()) form.append("textContent", textContent);
      if (source.trim()) form.append("source", source);
      if (title.trim()) form.append("title", title);

      const res = await fetch("/api/research/analyze", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(errData?.error ?? `분석 실패 (${String(res.status)})`);
        return;
      }

      const data = (await res.json()) as { reportId: string };
      onComplete(data.reportId);
    } catch {
      setError("분석 중 오류가 발생했습니다");
    } finally {
      setAnalyzing(false);
    }
  }

  const canAnalyze = (images.length > 0 || textContent.trim()) && !analyzing;

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <h3 style={s.headerTitle}>새 리서치</h3>
        <button type="button" style={s.closeBtn} onClick={onCancel}>
          ✕
        </button>
      </div>

      {/* Source */}
      <label style={s.label}>
        출처
        <input
          style={s.input}
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="예: instagram @ageofband"
        />
      </label>

      {/* Title */}
      <label style={s.label}>
        리포트 제목
        <input
          style={s.input}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="자동 생성됨"
        />
      </label>

      {/* Image upload */}
      <div
        style={s.dropZone(dragOver)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <span style={s.dropText}>
          스크린샷을 드래그하거나 클릭 (최대 10장)
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>

      {/* Image thumbnails */}
      {images.length > 0 && (
        <div style={s.thumbGrid}>
          {images.map((img, i) => (
            <div key={i} style={s.thumbWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.dataUri} alt={`screenshot ${i + 1}`} style={s.thumb} />
              <button
                type="button"
                style={s.thumbRemove}
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(i);
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Text content */}
      <label style={s.label}>
        텍스트 콘텐츠 (선택)
        <textarea
          style={s.textarea}
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          placeholder="캡션, 본문 텍스트를 붙여넣으세요 (글쓰기 스타일 분석용)"
          rows={4}
        />
      </label>

      {error && <p style={s.error}>{error}</p>}

      {/* Actions */}
      <div style={s.actions}>
        <button type="button" style={s.cancelBtn} onClick={onCancel}>
          취소
        </button>
        <button
          type="button"
          style={{ ...s.analyzeBtn, opacity: canAnalyze ? 1 : 0.4 }}
          disabled={!canAnalyze}
          onClick={() => void handleAnalyze()}
        >
          {analyzing ? "분석 중..." : "분석 시작"}
        </button>
      </div>
    </div>
  );
}

const s = {
  panel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "14px",
    padding: "20px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    boxShadow: "var(--shadow-card)",
    minWidth: "320px",
    maxHeight: "calc(100vh - 160px)",
    overflowY: "auto" as const,
  } as React.CSSProperties,

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  headerTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
  } as React.CSSProperties,

  closeBtn: {
    width: "30px",
    height: "30px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,

  label: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text-muted)",
  } as React.CSSProperties,

  input: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "13px",
    color: "var(--text)",
    outline: "none",
    transition: "border-color var(--transition)",
  } as React.CSSProperties,

  textarea: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "13px",
    color: "var(--text)",
    outline: "none",
    resize: "vertical" as const,
    fontFamily: "inherit",
    lineHeight: 1.5,
    transition: "border-color var(--transition)",
  } as React.CSSProperties,

  dropZone: (dragOver: boolean) =>
    ({
      border: dragOver
        ? "2px dashed var(--accent)"
        : "2px dashed var(--border-light)",
      borderRadius: "var(--radius-sm)",
      padding: "24px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      background: dragOver ? "var(--accent-light)" : "var(--bg-input)",
      transition: "all var(--transition)",
    }) as React.CSSProperties,

  dropText: {
    fontSize: "12px",
    color: "var(--text-muted)",
    textAlign: "center" as const,
  } as React.CSSProperties,

  thumbGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
    gap: "6px",
  } as React.CSSProperties,

  thumbWrap: {
    position: "relative" as const,
    borderRadius: "6px",
    overflow: "hidden",
    aspectRatio: "1",
  } as React.CSSProperties,

  thumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    display: "block",
  } as React.CSSProperties,

  thumbRemove: {
    position: "absolute" as const,
    top: "2px",
    right: "2px",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    border: "none",
    background: "rgba(0,0,0,0.6)",
    color: "#fff",
    fontSize: "10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  } as React.CSSProperties,

  error: {
    fontSize: "12px",
    color: "var(--red)",
    margin: 0,
  } as React.CSSProperties,

  actions: {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
    borderTop: "1px solid var(--border-light)",
    paddingTop: "12px",
  } as React.CSSProperties,

  cancelBtn: {
    padding: "9px 18px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  } as React.CSSProperties,

  analyzeBtn: {
    padding: "9px 22px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,
};
