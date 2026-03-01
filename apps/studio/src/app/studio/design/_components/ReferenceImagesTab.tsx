"use client";

import { useState, useRef, useCallback } from "react";
import type { SlideStyleOverrides, SlideSpec } from "@/lib/studio/designEditor/types";

interface ReferenceImagesTabProps {
  onApplyGlobalStyle: (style: SlideStyleOverrides) => void;
  onCustomHtmlChange: (html: string) => void;
  onSwitchToCodeTab: () => void;
  onSlideChange: (patch: Partial<SlideSpec>) => void;
}

interface UploadedImage {
  file: File;
  preview: string;
}

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    gap: "12px",
    minHeight: 0,
    overflowY: "auto" as const,
  } as const,
  dropZone: {
    border: "2px dashed var(--border-light)",
    borderRadius: "var(--radius-sm)",
    padding: "24px",
    textAlign: "center" as const,
    cursor: "pointer",
    transition: "all var(--transition)",
    fontSize: "13px",
    color: "var(--text-muted)",
    lineHeight: "1.6",
    flexShrink: 0,
  } as const,
  dropZoneActive: {
    borderColor: "var(--accent)",
    background: "var(--accent-light)",
  } as const,
  imageGrid: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap" as const,
    flexShrink: 0,
  } as const,
  imageThumb: {
    width: "100px",
    height: "100px",
    borderRadius: "10px",
    objectFit: "cover" as const,
    border: "1px solid var(--border-light)",
  } as const,
  removeBtn: {
    position: "absolute" as const,
    top: "4px",
    right: "4px",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    border: "none",
    background: "rgba(0,0,0,0.6)",
    color: "#fff",
    fontSize: "12px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  } as const,
  analyzeBtn: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
    transition: "all var(--transition)",
  } as const,
  generateBtn: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: "none",
    background: "#059669",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
    transition: "all var(--transition)",
  } as const,
  resultBox: {
    flexShrink: 0,
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: "1.5",
    padding: "12px",
    background: "var(--bg-input)",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
  } as const,
  colorRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "4px",
  } as const,
  colorSwatch: {
    width: "16px",
    height: "16px",
    borderRadius: "6px",
    border: "1px solid var(--border-light)",
    flexShrink: 0,
  } as const,
  sectionLabel: {
    fontWeight: 600,
    marginBottom: "8px",
    color: "var(--text)",
    fontSize: "13px",
  } as const,
  compareGrid: {
    display: "flex",
    gap: "8px",
    flexShrink: 0,
  } as const,
  compareCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  } as const,
  compareLabel: {
    fontSize: "11px",
    color: "var(--text-muted)",
  } as const,
  compareImg: {
    width: "100%",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
  } as const,
  codeBlock: {
    flexShrink: 0,
    maxHeight: "200px",
    overflowY: "auto" as const,
    background: "var(--bg-input)",
    borderRadius: "10px",
    padding: "10px",
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    lineHeight: "1.4",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-all" as const,
    border: "1px solid var(--border-light)",
  } as const,
  buttonRow: {
    display: "flex",
    gap: "8px",
    flexShrink: 0,
  } as const,
  copyBtn: {
    flex: 1,
    padding: "9px 14px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as const,
  applyBtn: {
    flex: 1,
    padding: "9px 14px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as const,
  providerRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  } as const,
  providerLabel: {
    fontSize: "12px",
    color: "var(--text-muted)",
    flexShrink: 0,
  } as const,
  providerSelect: {
    flex: 1,
    padding: "7px 10px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "12px",
    cursor: "pointer",
    transition: "border-color var(--transition)",
  } as const,
  meta: {
    fontSize: "11px",
    color: "var(--text-muted)",
    flexShrink: 0,
  } as const,
  divider: {
    borderTop: "1px solid var(--border-light)",
    margin: "4px 0",
    flexShrink: 0,
  } as const,
};

export default function ReferenceImagesTab({
  onApplyGlobalStyle,
  onCustomHtmlChange,
  onSwitchToCodeTab,
  onSlideChange,
}: ReferenceImagesTabProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<SlideStyleOverrides | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Provider selection
  const [provider, setProvider] = useState<"claude" | "openai">("claude");

  // Code generation state
  const [generating, setGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [previewPng, setPreviewPng] = useState<string | null>(null);
  const [genFontMood, setGenFontMood] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [genTimeMs, setGenTimeMs] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Decomposition state
  const [hasHeroImage, setHasHeroImage] = useState(false);
  const [overlayHtml, setOverlayHtml] = useState<string | null>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newImages: UploadedImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (images.length + newImages.length >= 3) break;
      newImages.push({ file, preview: URL.createObjectURL(file) });
    }
    setImages((prev) => [...prev, ...newImages].slice(0, 3));
  }, [images.length]);

  const removeImage = useCallback((idx: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx]!.preview);
      return prev.filter((_, i) => i !== idx);
    });
    setResult(null);
    setGeneratedHtml(null);
    setPreviewPng(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  // ── Style analysis (existing) ──────────────────────────

  const handleAnalyze = useCallback(async () => {
    if (images.length === 0) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    images.forEach((img, i) => formData.append(`image${String(i)}`, img.file));

    try {
      const res = await fetch("/api/design/analyze-style", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as Record<string, string>).error ?? `HTTP ${String(res.status)}`);
      }
      const data = (await res.json()) as { styleOverrides: SlideStyleOverrides };
      setResult(data.styleOverrides);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }, [images]);

  const handleApply = useCallback(() => {
    if (result) onApplyGlobalStyle(result);
  }, [result, onApplyGlobalStyle]);

  // ── Code generation (new) ──────────────────────────────

  const handleGenerateCode = useCallback(async () => {
    if (images.length === 0) return;
    setGenerating(true);
    setGenError(null);
    setGeneratedHtml(null);
    setPreviewPng(null);
    setGenFontMood(null);
    setGenTimeMs(null);
    setCopied(false);
    setHasHeroImage(false);
    setOverlayHtml(null);

    const formData = new FormData();
    formData.append("image", images[0]!.file);
    formData.append("provider", provider);
    formData.append("mode", "decompose");

    try {
      const res = await fetch("/api/design/image-to-code", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as Record<string, string>).error ?? `HTTP ${String(res.status)}`);
      }
      const data = (await res.json()) as {
        html: string;
        fontMood: string;
        provider: string;
        model: string;
        preview: string | null;
        renderTimeMs: number;
        renderError?: string;
        hasHeroImage: boolean;
        overlayHtml?: string;
      };
      setGeneratedHtml(data.html);
      setPreviewPng(data.preview);
      setGenFontMood(data.fontMood);
      setGenTimeMs(data.renderTimeMs);

      if (data.hasHeroImage) {
        setHasHeroImage(true);
        if (data.overlayHtml) setOverlayHtml(data.overlayHtml);
      }

      if (data.renderError) {
        setGenError(`렌더링 경고: ${data.renderError}`);
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }, [images, provider]);

  const handleCopy = useCallback(async () => {
    if (!generatedHtml) return;
    try {
      await navigator.clipboard.writeText(generatedHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = generatedHtml;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [generatedHtml]);

  const handleApplyCode = useCallback(() => {
    if (!generatedHtml) return;
    onCustomHtmlChange(generatedHtml);
    // If hero was detected, also set the reference image as heroImageDataUri
    if (hasHeroImage && images.length > 0) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onSlideChange({ heroImageDataUri: reader.result });
        }
      };
      reader.readAsDataURL(images[0]!.file);
    }
    onSwitchToCodeTab();
  }, [generatedHtml, hasHeroImage, images, onCustomHtmlChange, onSlideChange, onSwitchToCodeTab]);

  const handleApplyOverlayOnly = useCallback(() => {
    if (!overlayHtml) return;
    onCustomHtmlChange(overlayHtml);
    onSwitchToCodeTab();
  }, [overlayHtml, onCustomHtmlChange, onSwitchToCodeTab]);

  return (
    <div style={s.container}>
      {/* Drop zone */}
      <div
        style={{ ...s.dropZone, ...(dragging ? s.dropZoneActive : {}) }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {images.length >= 3
          ? "최대 3장까지 업로드 가능합니다"
          : "참고 이미지를 드래그하거나 클릭하여 업로드\n(최대 3장)"}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* Image previews */}
      {images.length > 0 && (
        <div style={s.imageGrid}>
          {images.map((img, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={img.preview} alt={`Ref ${String(i + 1)}`} style={s.imageThumb} />
              <button
                type="button"
                style={s.removeBtn}
                onClick={() => removeImage(i)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Vision model selector */}
      {images.length > 0 && (
        <div style={s.providerRow}>
          <span style={s.providerLabel}>Vision 모델:</span>
          <select
            style={s.providerSelect}
            value={provider}
            onChange={(e) => setProvider(e.target.value as "claude" | "openai")}
          >
            <option value="claude">Claude Sonnet 4</option>
            <option value="openai">GPT-4o</option>
          </select>
        </div>
      )}

      {/* Action buttons */}
      {images.length > 0 && (
        <div style={s.buttonRow}>
          <button
            type="button"
            style={{ ...s.analyzeBtn, flex: 1, opacity: analyzing ? 0.5 : 1 }}
            onClick={() => void handleAnalyze()}
            disabled={analyzing}
          >
            {analyzing ? "분석 중..." : "스타일 분석"}
          </button>
          <button
            type="button"
            style={{ ...s.generateBtn, flex: 1, opacity: generating ? 0.5 : 1 }}
            onClick={() => void handleGenerateCode()}
            disabled={generating}
          >
            {generating ? "생성 중..." : "코드 생성"}
          </button>
        </div>
      )}

      {/* Errors */}
      {error && (
        <div style={{ fontSize: "12px", color: "var(--red)", flexShrink: 0 }}>{error}</div>
      )}
      {genError && (
        <div style={{ fontSize: "12px", color: "var(--red)", flexShrink: 0 }}>{genError}</div>
      )}

      {/* Style analysis result (existing) */}
      {result && (
        <div style={s.resultBox}>
          <div style={s.sectionLabel}>
            추출된 스타일
          </div>
          {result.bgGradient && (
            <div style={s.colorRow}>
              <div style={{ ...s.colorSwatch, background: result.bgGradient }} />
              <span>배경: {result.bgGradient.slice(0, 50)}...</span>
            </div>
          )}
          {result.textColor && (
            <div style={s.colorRow}>
              <div style={{ ...s.colorSwatch, background: result.textColor }} />
              <span>텍스트: {result.textColor}</span>
            </div>
          )}
          {result.accentColor && (
            <div style={s.colorRow}>
              <div style={{ ...s.colorSwatch, background: result.accentColor }} />
              <span>악센트: {result.accentColor}</span>
            </div>
          )}
          {result.titleWeight !== undefined && (
            <div>제목 굵기: {String(result.titleWeight)}</div>
          )}
          {result.letterSpacing && (
            <div>자간: {result.letterSpacing}</div>
          )}
          {result.cardRadius !== undefined && (
            <div>카드 반경: {String(result.cardRadius)}px</div>
          )}

          <button
            type="button"
            style={{ ...s.analyzeBtn, marginTop: "12px", width: "100%" }}
            onClick={handleApply}
          >
            전체 슬라이드에 적용
          </button>
        </div>
      )}

      {/* Code generation result */}
      {generatedHtml && (
        <>
          <div style={s.divider} />

          <div style={s.sectionLabel}>
            {hasHeroImage ? "레이어 분리 결과" : "생성된 코드"}
          </div>

          {/* Decomposition info */}
          {hasHeroImage && (
            <div style={{ fontSize: "12px", color: "var(--accent)", padding: "8px 12px", background: "var(--accent-light)", borderRadius: "8px", flexShrink: 0 }}>
              배경 사진이 감지되었습니다. 오버레이만 HTML로 생성되었습니다.
            </div>
          )}

          {/* Side-by-side comparison */}
          {previewPng && images.length > 0 && (
            <div style={s.compareGrid}>
              <div style={s.compareCol}>
                <div style={s.compareLabel}>참고 이미지</div>
                <img src={images[0]!.preview} alt="Reference" style={s.compareImg} />
              </div>
              <div style={s.compareCol}>
                <div style={s.compareLabel}>
                  {hasHeroImage ? "합성 결과" : "Satori 렌더링"}
                </div>
                <img src={previewPng} alt="Preview" style={s.compareImg} />
              </div>
            </div>
          )}

          {/* HTML code block */}
          <div style={s.codeBlock}>
            {(hasHeroImage && overlayHtml ? overlayHtml : generatedHtml).slice(0, 2000)}
            {(hasHeroImage && overlayHtml ? overlayHtml : generatedHtml).length > 2000 && "\n... (truncated)"}
          </div>

          {/* Copy & Apply buttons */}
          {hasHeroImage ? (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "6px", flexShrink: 0 }}>
              <div style={s.buttonRow}>
                <button
                  type="button"
                  style={s.copyBtn}
                  onClick={() => void handleCopy()}
                >
                  {copied ? "복사됨!" : "HTML 복사"}
                </button>
              </div>
              <div style={s.buttonRow}>
                <button
                  type="button"
                  style={s.applyBtn}
                  onClick={handleApplyCode}
                >
                  합성 코드 적용 (사진 포함)
                </button>
              </div>
              <div style={s.buttonRow}>
                <button
                  type="button"
                  style={s.copyBtn}
                  onClick={handleApplyOverlayOnly}
                >
                  오버레이만 적용
                </button>
              </div>
            </div>
          ) : (
            <div style={s.buttonRow}>
              <button
                type="button"
                style={s.copyBtn}
                onClick={() => void handleCopy()}
              >
                {copied ? "복사됨!" : "HTML 복사"}
              </button>
              <button
                type="button"
                style={s.applyBtn}
                onClick={handleApplyCode}
              >
                코드 에디터에 적용
              </button>
            </div>
          )}

          {/* Meta info */}
          {genTimeMs !== null && (
            <div style={s.meta}>
              {(genTimeMs / 1000).toFixed(1)}초 소요
              {genFontMood && ` | 폰트: ${genFontMood}`}
              {` | 모델: ${provider === "claude" ? "Claude Sonnet 4" : "GPT-4o"}`}
              {hasHeroImage && " | hero 분리"}
            </div>
          )}
        </>
      )}

      {/* Loading indicator for code generation */}
      {generating && (
        <div style={{ textAlign: "center", padding: "20px 0", fontSize: "13px", color: "var(--text-muted)", flexShrink: 0 }}>
          <div style={{ marginBottom: "8px" }}>Claude Vision으로 이미지를 분석하고 있습니다...</div>
          <div style={{ fontSize: "11px" }}>약 10-15초 소요됩니다</div>
        </div>
      )}
    </div>
  );
}
