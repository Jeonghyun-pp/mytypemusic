"use client";

import { useState, useRef } from "react";
import { CONTENT_CATEGORIES } from "@/lib/studio/contentCategories";
import type { DesignEntry } from "./databaseStore";

interface UploadFormProps {
  onSave: (entry: Omit<DesignEntry, "id" | "createdAt">) => void;
  onCancel: () => void;
}

export default function UploadForm({ onSave, onCancel }: UploadFormProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [imageDataUri, setImageDataUri] = useState("");
  const [html, setHtml] = useState("");
  const [fontMood, setFontMood] = useState("");
  const [provider, setProvider] = useState<"claude" | "openai">("openai");
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUri(reader.result as string);
      setHtml("");
      setFontMood("");
      setError("");
    };
    reader.readAsDataURL(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) readFile(file);
  }

  async function handleConvert() {
    if (!imageDataUri) return;
    setConverting(true);
    setError("");
    try {
      const blob = await (await fetch(imageDataUri)).blob();
      const form = new FormData();
      form.append("image", blob, "reference.png");
      form.append("provider", provider);
      const res = await fetch("/api/design/image-to-code", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null) as { error?: string } | null;
        setError(errData?.error ?? `변환 실패 (${String(res.status)})`);
        return;
      }
      const data = (await res.json()) as { html: string; fontMood?: string };
      setHtml(data.html);
      setFontMood(data.fontMood ?? "bold-display");
    } catch {
      setError("변환 중 오류가 발생했습니다");
    } finally {
      setConverting(false);
    }
  }

  function handleSave() {
    if (!title.trim() || !imageDataUri || !html) return;
    onSave({
      title,
      category,
      imageDataUri,
      html,
      fontMood,
    });
  }

  const canConvert = !!imageDataUri && !converting;
  const canSave = !!title.trim() && !!imageDataUri && !!html;

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <h3 style={s.headerTitle}>레퍼런스 추가</h3>
        <button type="button" style={s.closeBtn} onClick={onCancel}>
          ✕
        </button>
      </div>

      {/* Image upload */}
      <div
        style={s.dropZone(dragOver, !!imageDataUri)}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        {imageDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageDataUri} alt="uploaded" style={s.previewImg} />
        ) : (
          <span style={s.dropText}>
            이미지를 드래그하거나 클릭하여 업로드
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>

      {/* Title */}
      <label style={s.label}>
        제목
        <input
          style={s.input}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="레퍼런스 제목"
        />
      </label>

      {/* Category */}
      <label style={s.label}>
        카테고리
        <select
          style={s.select}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">선택 안함</option>
          {CONTENT_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </label>

      {/* Provider + Convert */}
      <label style={s.label}>
        AI 프로바이더
        <select
          style={s.select}
          value={provider}
          onChange={(e) => setProvider(e.target.value as "claude" | "openai")}
        >
          <option value="openai">OpenAI (GPT-4o)</option>
          <option value="claude">Claude</option>
        </select>
      </label>

      <button
        type="button"
        style={{ ...s.convertBtn, opacity: canConvert ? 1 : 0.4 }}
        disabled={!canConvert}
        onClick={() => void handleConvert()}
      >
        {converting ? "변환 중..." : "코드 변환"}
      </button>

      {error && <p style={s.error}>{error}</p>}

      {/* Code preview */}
      {html && (
        <div style={s.codeSection}>
          <div style={s.codeLabelRow}>
            <span style={s.codeLabel}>생성된 코드</span>
            <span style={s.moodBadge}>{fontMood}</span>
          </div>
          <pre style={s.codeBlock}>{html.slice(0, 500)}{html.length > 500 ? "\n..." : ""}</pre>
        </div>
      )}

      {/* Save */}
      <div style={s.actions}>
        <button type="button" style={s.cancelBtn} onClick={onCancel}>
          취소
        </button>
        <button
          type="button"
          style={{ ...s.saveBtn, opacity: canSave ? 1 : 0.4 }}
          disabled={!canSave}
          onClick={handleSave}
        >
          저장
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
    transition: "all var(--transition)",
  } as React.CSSProperties,

  dropZone: (dragOver: boolean, hasImage: boolean) =>
    ({
      border: dragOver ? "2px dashed var(--accent)" : "2px dashed var(--border-light)",
      borderRadius: "var(--radius-sm)",
      padding: hasImage ? "0" : "32px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      background: dragOver ? "var(--accent-light)" : "var(--bg-input)",
      transition: "all var(--transition)",
      overflow: "hidden",
      minHeight: hasImage ? undefined : "120px",
    }) as React.CSSProperties,

  dropText: {
    fontSize: "13px",
    color: "var(--text-muted)",
    textAlign: "center" as const,
  } as React.CSSProperties,

  previewImg: {
    width: "100%",
    maxHeight: "240px",
    objectFit: "contain" as const,
    display: "block",
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

  select: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "13px",
    color: "var(--text)",
    outline: "none",
    transition: "border-color var(--transition)",
  } as React.CSSProperties,

  convertBtn: {
    padding: "9px 0",
    borderRadius: "10px",
    border: "1px solid var(--accent)",
    background: "transparent",
    color: "var(--accent)",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  error: {
    fontSize: "12px",
    color: "var(--red)",
  } as React.CSSProperties,

  codeSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  } as React.CSSProperties,

  codeLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  codeLabel: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-muted)",
  } as React.CSSProperties,

  moodBadge: {
    fontSize: "10px",
    fontWeight: 500,
    padding: "3px 10px",
    borderRadius: "6px",
    background: "var(--bg-input)",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  codeBlock: {
    padding: "12px",
    borderRadius: "10px",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    overflow: "auto",
    maxHeight: "160px",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-all" as const,
    lineHeight: 1.5,
    border: "1px solid var(--border-light)",
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
    transition: "all var(--transition)",
  } as React.CSSProperties,

  saveBtn: {
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
