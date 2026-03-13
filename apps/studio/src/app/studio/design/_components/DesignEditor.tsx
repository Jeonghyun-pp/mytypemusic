"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { DesignSpecSchema } from "@/lib/studio/designEditor/types";
import type { DesignSpec, SlideSpec, SlideStyleOverrides, AiDesignAction, FontMood, StylePresetId, TemplateId, CanvasSize, HeroImageFit } from "@/lib/studio/designEditor/types";
import type { Layer, LayerKind } from "@/lib/studio/designEditor/layerTypes";
import { createDefaultDesignSpec } from "@/lib/studio/designEditor/defaultSlides";
import { applyActions } from "@/lib/studio/designEditor/applyActions";
import { generateHtmlFromSlide } from "@/lib/studio/designEditor/generateHtml";
import { CONTENT_CATEGORIES } from "@/lib/studio/contentCategories";
import ControlPanel from "./ControlPanel";
import PreviewPanel from "./PreviewPanel";
import LayerCanvas from "./LayerCanvas";
import SlideNavigation from "./SlideNavigation";
import CanvasSizeSelector from "./CanvasSizeSelector";
import QuickPublishPanel from "../../_components/QuickPublishPanel";
import { exportDeckToPdf, downloadBlob } from "@/lib/studio/designEditor/pdfExport";

const STORAGE_KEY = "design-editor-spec";
const MAX_UNDO = 50;

const s = {
  outer: {
    display: "flex",
    flexDirection: "column" as const,
    height: "calc(100vh - 130px)",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    overflow: "hidden",
    boxShadow: "var(--shadow-card)",
  } as const,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid var(--border-light)",
    flexShrink: 0,
  } as const,
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  } as const,
  headerTitle: {
    fontSize: "15px",
    fontWeight: 600,
    color: "var(--text)",
  } as const,
  categorySelect: {
    padding: "6px 10px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "12px",
    color: "var(--text)",
    outline: "none",
    cursor: "pointer",
    transition: "all var(--transition)",
  } as const,
  headerInfo: {
    fontSize: "12px",
    color: "var(--text-muted)",
  } as const,
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  } as const,
  iconBtn: {
    width: "34px",
    height: "34px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    color: "var(--text-muted)",
    transition: "all var(--transition)",
  } as const,
  downloadBtn: {
    padding: "8px 16px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as const,
  refWrap: {
    position: "relative" as const,
  } as const,
  refToggle: {
    padding: "8px 16px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as const,
  refDropdown: {
    position: "absolute" as const,
    top: "100%",
    right: 0,
    marginTop: "8px",
    background: "var(--bg-card)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-sm)",
    boxShadow: "var(--shadow-hover)",
    zIndex: 100,
    minWidth: "180px",
    padding: "6px",
  } as const,
  refItem: {
    display: "block",
    width: "100%",
    padding: "8px 14px",
    background: "none",
    border: "none",
    color: "var(--text)",
    fontSize: "13px",
    textAlign: "left" as const,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    borderRadius: "8px",
    transition: "all var(--transition)",
  } as const,
  refDivider: {
    height: "1px",
    background: "var(--border-light)",
    margin: "4px 6px",
  } as const,
  main: {
    display: "flex",
    flex: 1,
    minHeight: 0,
  } as const,
  publishSidebar: {
    width: "300px",
    flexShrink: 0,
    borderLeft: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    overflowY: "auto" as const,
    padding: "16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  } as const,
  publishHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "8px",
    borderBottom: "1px solid var(--border-light)",
  } as const,
  publishThumbs: {
    display: "flex",
    gap: "6px",
    overflowX: "auto" as const,
    paddingBottom: "4px",
  } as const,
  publishThumb: {
    width: "56px",
    height: "70px",
    objectFit: "cover" as const,
    borderRadius: "6px",
    border: "1px solid var(--border-light)",
    flexShrink: 0,
  } as const,
};

// ── Reference sites dropdown ────────────────────────────
const REF_SITES = [
  { label: "Instagram", url: "https://www.instagram.com", group: "sns" },
  { label: "Pinterest", url: "https://www.pinterest.com", group: "sns" },
  { divider: true, group: "design" },
  { label: "Behance", url: "https://www.behance.net", group: "design" },
  { label: "Dribbble", url: "https://dribbble.com", group: "design" },
  { divider: true, group: "mag" },
  { label: "Vogue Korea", url: "https://www.vogue.co.kr", group: "mag" },
  { label: "GQ Korea", url: "https://www.gqkorea.co.kr", group: "mag" },
  { label: "W Korea", url: "https://www.wkorea.com", group: "mag" },
  { label: "Hypebeast", url: "https://hypebeast.com/kr", group: "mag" },
  { label: "Dazed", url: "https://www.dazeddigital.com", group: "mag" },
] as const;

function RefDropdown() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={wrapRef} style={s.refWrap}>
      <button
        type="button"
        style={s.refToggle}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Reference ▾" : "Reference ▸"}
      </button>
      {open && (
        <div style={s.refDropdown}>
          {REF_SITES.map((item, i) =>
            "divider" in item ? (
              <div key={`d${String(i)}`} style={s.refDivider} />
            ) : (
              <button
                key={item.url}
                type="button"
                style={s.refItem}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-input)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "none";
                }}
                onClick={() => {
                  window.open(
                    item.url,
                    item.label.replace(/\s/g, "_"),
                    "width=520,height=740,scrollbars=yes,resizable=yes",
                  );
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

const FACT_TEMPLATES: TemplateId[] = ["body.fact.v1", "body.fact.v2", "body.fact.v3", "body.fact.v4"];

interface DesignEditorProps {
  projectId?: string;
  initialSpec?: DesignSpec;
  onAutoSave?: (spec: DesignSpec) => void;
  initialTopic?: string;
  initialCarousel?: string;
}

export default function DesignEditor({ projectId, initialSpec, onAutoSave, initialTopic, initialCarousel }: DesignEditorProps = {}) {
  const [spec, setSpec] = useState<DesignSpec>(() => initialSpec ?? createDefaultDesignSpec());
  const [downloading, setDownloading] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [exportScale, setExportScale] = useState(1);
  const [category, setCategory] = useState("");

  // Pre-fill first slide with topic + carousel concept from AI suggestion
  useEffect(() => {
    if (!initialTopic && !initialCarousel) return;
    setSpec((prev) => {
      const slides = [...prev.slides];
      if (slides[0]) {
        slides[0] = {
          ...slides[0],
          ...(initialTopic ? { title: initialTopic } : {}),
          ...(initialCarousel ? { subtitle: initialCarousel } : {}),
        };
      }
      return { ...prev, slides };
    });
  }, [initialTopic, initialCarousel]);

  // ── Undo / Redo ──────────────────────────────────────
  const undoStack = useRef<DesignSpec[]>([]);
  const redoStack = useRef<DesignSpec[]>([]);

  const pushUndo = useCallback((prev: DesignSpec) => {
    undoStack.current = [...undoStack.current.slice(-MAX_UNDO + 1), prev];
    redoStack.current = [];
  }, []);

  const updateSpec = useCallback(
    (updater: (prev: DesignSpec) => DesignSpec) => {
      setSpec((prev) => {
        const next = updater(prev);
        if (next !== prev) pushUndo(prev);
        return next;
      });
    },
    [pushUndo],
  );

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const restored = undoStack.current[undoStack.current.length - 1]!;
    undoStack.current = undoStack.current.slice(0, -1);
    setSpec((prev) => {
      redoStack.current = [...redoStack.current, prev];
      return restored;
    });
  }, []);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const restored = redoStack.current[redoStack.current.length - 1]!;
    redoStack.current = redoStack.current.slice(0, -1);
    setSpec((prev) => {
      undoStack.current = [...undoStack.current, prev];
      return restored;
    });
  }, []);

  // Ctrl+Z / Ctrl+Shift+Z
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo]);

  // ── Database에서 전달된 코드 로드 ─────────────────────
  useEffect(() => {
    // Skip localStorage restore if initialSpec was provided (project mode)
    if (initialSpec) return;

    try {
      const loadData = localStorage.getItem("studio-database-load");
      if (loadData) {
        localStorage.removeItem("studio-database-load");
        const { html, fontMood: mood, imageDataUri } = JSON.parse(loadData) as {
          html: string;
          fontMood?: string;
          title?: string;
          imageDataUri?: string;
        };
        if (html) {
          setSpec((prev) => {
            const slides = [...prev.slides];
            slides[prev.currentSlideIndex] = {
              ...slides[prev.currentSlideIndex]!,
              customHtml: html,
              ...(imageDataUri ? { heroImageDataUri: imageDataUri } : {}),
            };
            return {
              ...prev,
              slides,
              fontMood: (mood as FontMood) ?? prev.fontMood,
            };
          });
          return; // skip normal restore
        }
      }
    } catch { /* ignore */ }

    // ── Spotify에서 전달된 이미지 로드 ─────────────────
    try {
      const spotifyData = localStorage.getItem("studio-spotify-load");
      if (spotifyData) {
        localStorage.removeItem("studio-spotify-load");
        const parsed = JSON.parse(spotifyData) as {
          heroImageDataUri?: string;
          footerText?: string;
        };
        if (parsed.heroImageDataUri) {
          setSpec((prev) => {
            const slides = [...prev.slides];
            slides[prev.currentSlideIndex] = {
              ...slides[prev.currentSlideIndex]!,
              heroImageDataUri: parsed.heroImageDataUri,
              footerText: parsed.footerText ?? slides[prev.currentSlideIndex]!.footerText,
            };
            return { ...prev, slides };
          });
          return; // skip normal restore
        }
      }
    } catch { /* ignore */ }

    // ── localStorage에서 복원 (hydration 이후) ──────────
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const raw = JSON.parse(saved) as unknown;
        const parsed = DesignSpecSchema.safeParse(raw);
        if (parsed.success) {
          setSpec(parsed.data);
          return;
        }
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* ignore */ }
  }, [initialSpec]);

  // ── localStorage 자동 저장 (빠른 디자인 모드에서만) ────
  useEffect(() => {
    if (!projectId) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(spec));
      } catch {
        // quota exceeded — retry without heavy image data
        try {
          const lite = {
            ...spec,
            slides: spec.slides.map((sl) => ({ ...sl, heroImageDataUri: undefined })),
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(lite));
        } catch { /* still exceeded, ignore */ }
      }
    }

    // DB auto-save for project mode
    if (onAutoSave) onAutoSave(spec);
  }, [spec, projectId, onAutoSave]);

  const currentSlide = spec.slides[spec.currentSlideIndex]!;

  const previewEffects = useMemo(() => ({
    shadow: spec.globalStyle?.shadow,
    blur: spec.globalStyle?.blur,
  }), [spec.globalStyle?.shadow, spec.globalStyle?.blur]);

  // ── Handlers ─────────────────────────────────────────
  const handleSelectSlide = useCallback((idx: number) => {
    setSpec((prev) => ({ ...prev, currentSlideIndex: idx }));
  }, []);

  const handleSlideChange = useCallback((patch: Partial<SlideSpec>) => {
    updateSpec((prev) => {
      const i = prev.currentSlideIndex;
      const slides = [...prev.slides];
      slides[i] = { ...slides[i]!, ...patch };
      return { ...prev, slides };
    });
  }, [updateSpec]);

  const handleStyleChange = useCallback((patch: Partial<SlideStyleOverrides>) => {
    updateSpec((prev) => {
      const i = prev.currentSlideIndex;
      const slides = [...prev.slides];
      const slide = slides[i]!;
      slides[i] = {
        ...slide,
        styleOverrides: { ...slide.styleOverrides, ...patch },
      };
      return { ...prev, slides };
    });
  }, [updateSpec]);

  const handleApplyActions = useCallback((actions: AiDesignAction[]) => {
    updateSpec((prev) => {
      const next = applyActions(prev, actions);
      // update_html 액션이 있으면 customHtml을 유지 (코드 모드)
      // 그 외 액션만 있으면 customHtml 삭제 → 템플릿 모드로 전환
      const hasHtmlAction = actions.some((a) => a.action === "update_html");
      if (hasHtmlAction) return next;
      const slides = next.slides.map((slide) =>
        slide.customHtml ? { ...slide, customHtml: undefined } : slide,
      );
      return { ...next, slides };
    });
  }, [updateSpec]);

  const handleApplyGlobalStyle = useCallback((style: SlideStyleOverrides) => {
    updateSpec((prev) => {
      const newGlobal = { ...prev.globalStyle, ...style };
      // 글로벌 스타일 변경 시 customHtml 삭제 → 템플릿 모드로 전환
      const slides = prev.slides.map((slide) =>
        slide.customHtml ? { ...slide, customHtml: undefined } : slide,
      );
      return { ...prev, globalStyle: newGlobal, slides };
    });
  }, [updateSpec]);

  const handleCustomHtmlChange = useCallback((html: string) => {
    updateSpec((prev) => {
      const i = prev.currentSlideIndex;
      const slides = [...prev.slides];
      slides[i] = { ...slides[i]!, customHtml: html };
      return { ...prev, slides };
    });
  }, [updateSpec]);

  const handleClearCustomHtml = useCallback(() => {
    updateSpec((prev) => {
      const i = prev.currentSlideIndex;
      const slides = [...prev.slides];
      slides[i] = { ...slides[i]!, customHtml: undefined };
      return { ...prev, slides };
    });
  }, [updateSpec]);

  // ── Add / Remove slides ────────────────────────────
  const handleAddSlide = useCallback(() => {
    updateSpec((prev) => {
      if (prev.slides.length >= 10) return prev;
      const insertAt = prev.currentSlideIndex + 1;
      const factCount = prev.slides.filter((sl) => sl.kind === "fact").length;
      const templateId = FACT_TEMPLATES[factCount % FACT_TEMPLATES.length]!;
      const newSlide: SlideSpec = {
        slideIndex: insertAt,
        kind: "fact",
        templateId,
        title: `POINT ${String(factCount + 1).padStart(2, "0")}`,
        bodyText: "내용을 입력하세요.",
        footerText: "@your_magazine",
      };
      const slides = [...prev.slides];
      slides.splice(insertAt, 0, newSlide);
      // reindex
      for (let j = 0; j < slides.length; j++) slides[j] = { ...slides[j]!, slideIndex: j };
      return { ...prev, slides, currentSlideIndex: insertAt };
    });
  }, [updateSpec]);

  const handleRemoveSlide = useCallback((idx: number) => {
    updateSpec((prev) => {
      if (prev.slides.length <= 1) return prev;
      const slides = prev.slides.filter((_, i) => i !== idx);
      // reindex
      for (let j = 0; j < slides.length; j++) slides[j] = { ...slides[j]!, slideIndex: j };
      let newIndex = prev.currentSlideIndex;
      if (idx <= newIndex) newIndex = Math.max(0, newIndex - 1);
      if (newIndex >= slides.length) newIndex = slides.length - 1;
      return { ...prev, slides, currentSlideIndex: newIndex };
    });
  }, [updateSpec]);

  const handleAddInfographicSlide = useCallback((templateId: TemplateId, title: string, bodyText: string, footerText: string) => {
    updateSpec((prev) => {
      if (prev.slides.length >= 10) return prev;
      const insertAt = prev.currentSlideIndex + 1;
      const newSlide: SlideSpec = {
        slideIndex: insertAt,
        kind: "infographic",
        templateId,
        title,
        bodyText,
        footerText,
      };
      const slides = [...prev.slides];
      slides.splice(insertAt, 0, newSlide);
      for (let j = 0; j < slides.length; j++) slides[j] = { ...slides[j]!, slideIndex: j };
      return { ...prev, slides, currentSlideIndex: insertAt };
    });
  }, [updateSpec]);

  // ── Preset → fontMood + palette 자동 적용 ──────────
  const PRESET_DEFAULTS: Record<string, { fontMood: FontMood; palette?: { textColor: string; accentColor: string; bgGradient: string } }> = {
    news:      { fontMood: "impact",       palette: { textColor: "#1A1A1A", accentColor: "#000000", bgGradient: "#FFFFFF" } },
    beauty:    { fontMood: "editorial",    palette: { textColor: "#1A1A1A", accentColor: "#1A1A1A", bgGradient: "#FAFAF8" } },
    tech:      { fontMood: "clean-sans",   palette: { textColor: "#1A1A1A", accentColor: "#000000", bgGradient: "#FFFFFF" } },
    lifestyle: { fontMood: "editorial",    palette: { textColor: "#3D3529", accentColor: "#8B7D6B", bgGradient: "#F5EDE3" } },
    finance:   { fontMood: "minimal",      palette: { textColor: "#1A1A1A", accentColor: "#000000", bgGradient: "#FFFFFF" } },
    music:     { fontMood: "bold-display" },
    default:   { fontMood: "bold-display" },
  };

  const handlePresetChange = useCallback((presetId: string) => {
    updateSpec((prev) => {
      const preset = PRESET_DEFAULTS[presetId];
      if (!preset) return { ...prev, presetId: presetId as StylePresetId };

      const next: DesignSpec = {
        ...prev,
        presetId: presetId as StylePresetId,
        fontMood: preset.fontMood,
      };

      if (preset.palette) {
        next.globalStyle = {
          ...prev.globalStyle,
          textColor: preset.palette.textColor,
          accentColor: preset.palette.accentColor,
          bgGradient: preset.palette.bgGradient,
        };
      }

      return next;
    });
  }, [updateSpec]);

  const handleFontMoodChange = useCallback((mood: string) => {
    updateSpec((prev) => ({
      ...prev,
      fontMood: mood as FontMood,
    }));
  }, [updateSpec]);

  const handleCanvasSizeChange = useCallback((size: CanvasSize) => {
    updateSpec((prev) => ({ ...prev, canvasSize: size }));
  }, [updateSpec]);

  const handleHeroImageFitChange = useCallback((fit: HeroImageFit) => {
    updateSpec((prev) => ({ ...prev, heroImageFit: fit }));
  }, [updateSpec]);

  // ── Layer management ──────────────────────────────────
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const handleColorUsed = useCallback((color: string) => {
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c !== color);
      return [color, ...filtered].slice(0, 10);
    });
  }, []);

  const layerCounter = useRef(0);

  const handleAddLayer = useCallback((kind: LayerKind) => {
    updateSpec((prev) => {
      const i = prev.currentSlideIndex;
      const slides = [...prev.slides];
      const slide = slides[i]!;
      const existingLayers = slide.layers ?? [];
      layerCounter.current += 1;
      const id = `layer-${String(Date.now())}-${String(layerCounter.current)}`;
      const zIndex = existingLayers.length;
      const cw = prev.canvasSize?.width ?? 1080;
      const ch = prev.canvasSize?.height ?? 1350;

      let newLayer: Layer;
      switch (kind) {
        case "text":
          newLayer = {
            id, kind: "text", name: `텍스트 ${String(zIndex + 1)}`,
            x: Math.round(cw * 0.1), y: Math.round(ch * 0.4),
            width: Math.round(cw * 0.8), height: Math.round(ch * 0.15),
            rotation: 0, scale: 1, opacity: 1, blendMode: "normal",
            zIndex, visible: true, locked: false,
            text: "텍스트를 입력하세요", fontSize: 48, fontWeight: 700,
            color: "#000000", textAlign: "center", lineHeight: 1.4, letterSpacing: 0,
          };
          break;
        case "image":
          newLayer = {
            id, kind: "image", name: `이미지 ${String(zIndex + 1)}`,
            x: 0, y: 0, width: cw, height: ch,
            rotation: 0, scale: 1, opacity: 1, blendMode: "normal",
            zIndex, visible: true, locked: false,
            src: "", objectFit: "cover", borderRadius: 0,
            cropX: 0, cropY: 0, cropZoom: 1, flipH: false, flipV: false,
          };
          break;
        case "shape":
          newLayer = {
            id, kind: "shape", name: `도형 ${String(zIndex + 1)}`,
            x: Math.round(cw * 0.2), y: Math.round(ch * 0.3),
            width: Math.round(cw * 0.6), height: Math.round(cw * 0.6),
            rotation: 0, scale: 1, opacity: 1, blendMode: "normal",
            zIndex, visible: true, locked: false,
            shapeType: "rect", fill: "#5B5FC7", strokeWidth: 0, borderRadius: 0,
          };
          break;
        case "svg-path":
          newLayer = {
            id, kind: "svg-path", name: `패스 ${String(zIndex + 1)}`,
            x: Math.round(cw * 0.1), y: Math.round(ch * 0.1),
            width: Math.round(cw * 0.8), height: Math.round(ch * 0.8),
            rotation: 0, scale: 1, opacity: 1, blendMode: "normal",
            zIndex, visible: true, locked: false,
            pathData: "M 0 0 L 100 0 L 50 100 Z", fill: "none", stroke: "#000000", strokeWidth: 2,
          };
          break;
      }

      slides[i] = { ...slide, layers: [...existingLayers, newLayer] };
      setSelectedLayerId(id);
      return { ...prev, slides };
    });
  }, [updateSpec]);

  const handleUpdateLayer = useCallback((id: string, patch: Partial<Layer>) => {
    updateSpec((prev) => {
      const i = prev.currentSlideIndex;
      const slides = [...prev.slides];
      const slide = slides[i]!;
      const layers = (slide.layers ?? []).map((l) =>
        l.id === id ? { ...l, ...patch } as Layer : l,
      );
      slides[i] = { ...slide, layers };
      return { ...prev, slides };
    });
  }, [updateSpec]);

  const handleRemoveLayer = useCallback((id: string) => {
    updateSpec((prev) => {
      const i = prev.currentSlideIndex;
      const slides = [...prev.slides];
      const slide = slides[i]!;
      const layers = (slide.layers ?? []).filter((l) => l.id !== id);
      slides[i] = { ...slide, layers };
      return { ...prev, slides };
    });
  }, [updateSpec]);

  const handleReorderLayer = useCallback((id: string, direction: "up" | "down") => {
    updateSpec((prev) => {
      const i = prev.currentSlideIndex;
      const slides = [...prev.slides];
      const slide = slides[i]!;
      const layers = [...(slide.layers ?? [])].sort((a, b) => a.zIndex - b.zIndex);
      const idx = layers.findIndex((l) => l.id === id);
      if (idx < 0) return prev;

      const swapIdx = direction === "up" ? idx + 1 : idx - 1;
      if (swapIdx < 0 || swapIdx >= layers.length) return prev;

      // Swap zIndex values
      const temp = layers[idx]!.zIndex;
      layers[idx] = { ...layers[idx]!, zIndex: layers[swapIdx]!.zIndex } as Layer;
      layers[swapIdx] = { ...layers[swapIdx]!, zIndex: temp } as Layer;

      slides[i] = { ...slide, layers };
      return { ...prev, slides };
    });
  }, [updateSpec]);

  const handleDeleteLayers = useCallback((ids: string[]) => {
    updateSpec((prev) => {
      const i = prev.currentSlideIndex;
      const slides = [...prev.slides];
      const slide = slides[i]!;
      const idSet = new Set(ids);
      const layers = (slide.layers ?? []).filter((l) => !idSet.has(l.id));
      slides[i] = { ...slide, layers };
      return { ...prev, slides };
    });
    setSelectedLayerId(null);
    setSelectedLayerIds([]);
  }, [updateSpec]);

  const handleDuplicateLayers = useCallback((ids: string[]) => {
    updateSpec((prev) => {
      const i = prev.currentSlideIndex;
      const slides = [...prev.slides];
      const slide = slides[i]!;
      const existingLayers = slide.layers ?? [];
      const toDuplicate = existingLayers.filter((l) => ids.includes(l.id));
      const newLayers: Layer[] = [];
      const newIds: string[] = [];
      for (const l of toDuplicate) {
        layerCounter.current += 1;
        const newId = `layer-${String(Date.now())}-${String(layerCounter.current)}`;
        newIds.push(newId);
        newLayers.push({
          ...l,
          id: newId,
          name: `${l.name} 복사`,
          x: l.x + 20,
          y: l.y + 20,
          zIndex: existingLayers.length + newLayers.length,
        } as Layer);
      }
      slides[i] = { ...slide, layers: [...existingLayers, ...newLayers] };
      setSelectedLayerIds(newIds);
      if (newIds.length === 1) setSelectedLayerId(newIds[0]!);
      return { ...prev, slides };
    });
  }, [updateSpec]);

  const handleInsertImage = useCallback((url: string, attribution: string) => {
    updateSpec((prev) => {
      const i = prev.currentSlideIndex;
      const slides = [...prev.slides];
      const slide = slides[i]!;
      const existingLayers = slide.layers ?? [];
      layerCounter.current += 1;
      const id = `layer-${String(Date.now())}-${String(layerCounter.current)}`;
      const cw = prev.canvasSize?.width ?? 1080;
      const ch = prev.canvasSize?.height ?? 1350;
      const newLayer: Layer = {
        id,
        kind: "image",
        name: attribution.slice(0, 30),
        x: 0,
        y: 0,
        width: cw,
        height: ch,
        rotation: 0,
        scale: 1,
        opacity: 1,
        blendMode: "normal",
        zIndex: existingLayers.length,
        visible: true,
        locked: false,
        src: url,
        objectFit: "cover",
        borderRadius: 0,
        cropX: 0, cropY: 0, cropZoom: 1, flipH: false, flipV: false,
      };
      slides[i] = { ...slide, layers: [...existingLayers, newLayer] };
      setSelectedLayerId(id);
      return { ...prev, slides };
    });
  }, [updateSpec]);

  const handleSetBackground = useCallback((url: string) => {
    updateSpec((prev) => {
      const i = prev.currentSlideIndex;
      const slides = [...prev.slides];
      slides[i] = { ...slides[i]!, heroImageDataUri: url };
      return { ...prev, slides };
    });
  }, [updateSpec]);

  const handleBulkReorderLayers = useCallback((orderedIds: string[]) => {
    updateSpec((prev) => {
      const i = prev.currentSlideIndex;
      const slides = [...prev.slides];
      const slide = slides[i]!;
      const layers = [...(slide.layers ?? [])];
      // orderedIds is sorted highest-visual-first, assign descending zIndex
      const maxZ = orderedIds.length;
      const updated = layers.map((l) => {
        const pos = orderedIds.indexOf(l.id);
        if (pos === -1) return l;
        return { ...l, zIndex: maxZ - pos } as Layer;
      });
      slides[i] = { ...slide, layers: updated };
      return { ...prev, slides };
    });
  }, [updateSpec]);

  // ── 전체 덱 다운로드 ────────────────────────────────
  const handleDownloadAll = useCallback(async () => {
    setDownloading(true);
    try {
      for (let i = 0; i < spec.slides.length; i++) {
        const slide = spec.slides[i]!;
        const baseBody = slide.customHtml
          ? { rawHtml: slide.customHtml, heroImageDataUri: slide.heroImageDataUri, fontMood: spec.fontMood, canvasSize: spec.canvasSize, heroImageFit: spec.heroImageFit }
          : slide.layers && slide.layers.length > 0
            ? { layers: slide.layers, background: spec.globalStyle?.bgGradient ?? "#FFFFFF", fontMood: spec.fontMood, canvasSize: spec.canvasSize }
            : { slide, globalStyle: spec.globalStyle, fontMood: spec.fontMood, canvasSize: spec.canvasSize, heroImageFit: spec.heroImageFit };
        const fetchBody = { ...baseBody, scale: exportScale };
        const res = await fetch("/api/design/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fetchBody),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as { png: string };

        // data URI → blob → download
        const byteString = atob(data.png.split(",")[1]!);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let j = 0; j < byteString.length; j++) ia[j] = byteString.charCodeAt(j);
        const blob = new Blob([ab], { type: "image/png" });

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `slide-${String(i + 1).padStart(2, "0")}.png`;
        a.click();
        URL.revokeObjectURL(a.href);

        // 다운로드 간 짧은 딜레이 (브라우저 제한 방지)
        if (i < spec.slides.length - 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    } finally {
      setDownloading(false);
    }
  }, [spec, exportScale]);

  // ── AI Polish: render current slide for critique ──────
  const handleRenderCurrentSlide = useCallback(async (): Promise<string | null> => {
    const slide = spec.slides[spec.currentSlideIndex]!;
    const baseBody = slide.customHtml
      ? { rawHtml: slide.customHtml, heroImageDataUri: slide.heroImageDataUri, fontMood: spec.fontMood, canvasSize: spec.canvasSize, heroImageFit: spec.heroImageFit }
      : slide.layers && slide.layers.length > 0
        ? { layers: slide.layers, background: spec.globalStyle?.bgGradient ?? "#FFFFFF", fontMood: spec.fontMood, canvasSize: spec.canvasSize }
        : { slide, globalStyle: spec.globalStyle, fontMood: spec.fontMood, canvasSize: spec.canvasSize, heroImageFit: spec.heroImageFit };
    try {
      const res = await fetch("/api/design/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseBody),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { png: string };
      return data.png;
    } catch {
      return null;
    }
  }, [spec]);

  const handleApplyRefinement = useCallback(async (instructions: string) => {
    // Send refinement instructions to AI chat to interpret and generate actions
    try {
      const res = await fetch("/api/design/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "Apply the following design critique refinement instructions to the current design. Generate concrete style/text actions." },
            { role: "user", content: instructions },
          ],
          spec,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { actions?: AiDesignAction[] };
      if (data.actions && data.actions.length > 0) {
        handleApplyActions(data.actions);
      }
    } catch {
      // Fallback: log instructions for manual application
      console.log("[AI Polish] Refinement instructions:", instructions);
    }
  }, [spec, handleApplyActions]);

  const handlePdfExport = useCallback(async () => {
    setPdfExporting(true);
    try {
      const blob = await exportDeckToPdf(spec, {
        title: spec.deckTitle ?? "Design Deck",
      });
      downloadBlob(blob, `${spec.deckTitle ?? "deck"}.pdf`);
    } finally {
      setPdfExporting(false);
    }
  }, [spec]);

  // ── Inline publish panel ──────────────────────────────
  const [showPublish, setShowPublish] = useState(false);
  const [publishMediaUrls, setPublishMediaUrls] = useState<string[]>([]);
  const [renderingForPublish, setRenderingForPublish] = useState(false);

  const publishText = useMemo(() => {
    return spec.slides
      .map((sl) => [sl.title, sl.bodyText].filter(Boolean).join("\n"))
      .filter(Boolean)
      .join("\n\n");
  }, [spec.slides]);

  const handleTogglePublish = useCallback(async () => {
    if (showPublish) {
      setShowPublish(false);
      return;
    }

    // Render all slides as PNG
    setRenderingForPublish(true);
    setShowPublish(true);
    try {
      const urls: string[] = [];
      for (const slide of spec.slides) {
        const fetchBody = slide.customHtml
          ? { rawHtml: slide.customHtml, heroImageDataUri: slide.heroImageDataUri, fontMood: spec.fontMood, canvasSize: spec.canvasSize, heroImageFit: spec.heroImageFit }
          : slide.layers && slide.layers.length > 0
            ? { layers: slide.layers, background: spec.globalStyle?.bgGradient ?? "#FFFFFF", fontMood: spec.fontMood, canvasSize: spec.canvasSize }
            : { slide, globalStyle: spec.globalStyle, fontMood: spec.fontMood, canvasSize: spec.canvasSize, heroImageFit: spec.heroImageFit };
        try {
          const res = await fetch("/api/design/render", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fetchBody),
          });
          if (res.ok) {
            const data = (await res.json()) as { png: string };
            urls.push(data.png);
          }
        } catch {
          // skip failed slide
        }
      }
      setPublishMediaUrls(urls);
    } finally {
      setRenderingForPublish(false);
    }
  }, [showPublish, spec]);

  const [figmaCopied, setFigmaCopied] = useState(false);
  const handleFigmaExport = useCallback(async () => {
    const allHtml = spec.slides.map((slide) => {
      if (slide.customHtml) return slide.customHtml;
      return generateHtmlFromSlide(slide, spec.globalStyle);
    }).join("\n\n<!-- slide break -->\n\n");

    await navigator.clipboard.writeText(allHtml);
    setFigmaCopied(true);
    setTimeout(() => setFigmaCopied(false), 3000);
  }, [spec]);

  return (
    <div style={s.outer}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.headerTitle}>Design Editor</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={s.categorySelect}
          >
            <option value="">카테고리 선택</option>
            {CONTENT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <CanvasSizeSelector
            value={spec.canvasSize}
            onChange={handleCanvasSizeChange}
            heroImageFit={spec.heroImageFit ?? "fill"}
            onHeroImageFitChange={handleHeroImageFitChange}
          />
          <span style={s.headerInfo}>
            Slide {String(spec.currentSlideIndex + 1)} / {String(spec.slides.length)}
            {" · "}
            {currentSlide.kind} · {currentSlide.templateId}
          </span>
        </div>
        <div style={s.headerActions}>
          <button
            type="button"
            style={{ ...s.iconBtn, opacity: undoStack.current.length > 0 ? 1 : 0.3 }}
            onClick={handleUndo}
            title="실행 취소 (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            type="button"
            style={{ ...s.iconBtn, opacity: redoStack.current.length > 0 ? 1 : 0.3 }}
            onClick={handleRedo}
            title="다시 실행 (Ctrl+Shift+Z)"
          >
            ↪
          </button>
          <RefDropdown />
          <select
            value={exportScale}
            onChange={(e) => setExportScale(Number(e.target.value))}
            style={s.categorySelect}
            title="내보내기 해상도"
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
          </select>
          <button
            type="button"
            style={{ ...s.downloadBtn, opacity: downloading ? 0.5 : 1 }}
            onClick={() => void handleDownloadAll()}
            disabled={downloading}
          >
            {downloading ? "다운로드 중..." : `PNG ${exportScale}x (${String(spec.slides.length)}장)`}
          </button>
          <button
            type="button"
            style={{ ...s.downloadBtn, background: pdfExporting ? "var(--accent)" : "var(--bg-input)", color: pdfExporting ? "#fff" : "var(--text)", opacity: pdfExporting ? 0.5 : 1 }}
            onClick={() => void handlePdfExport()}
            disabled={pdfExporting}
          >
            {pdfExporting ? "PDF 생성 중..." : "PDF"}
          </button>
          <button
            type="button"
            style={{ ...s.downloadBtn, background: figmaCopied ? "#10b981" : "var(--bg-input)", color: figmaCopied ? "#fff" : "var(--text)" }}
            onClick={() => void handleFigmaExport()}
            title="HTML을 복사한 후 Figma에서 html.to.design 플러그인으로 붙여넣기"
          >
            {figmaCopied ? "HTML 복사됨!" : "Figma 내보내기"}
          </button>
          <button
            type="button"
            style={{
              ...s.downloadBtn,
              background: showPublish ? "#2E8D5A" : "#3DA66E",
              color: "#fff",
              opacity: renderingForPublish ? 0.5 : 1,
            }}
            onClick={() => void handleTogglePublish()}
            disabled={renderingForPublish}
          >
            {renderingForPublish ? "렌더링 중..." : showPublish ? "발행 닫기" : "SNS 발행"}
          </button>
        </div>
      </div>

      <div style={s.main}>
        <ControlPanel
          slide={currentSlide}
          spec={spec}
          onSlideChange={handleSlideChange}
          onStyleChange={handleStyleChange}
          onApplyActions={handleApplyActions}
          onApplyGlobalStyle={handleApplyGlobalStyle}
          onCustomHtmlChange={handleCustomHtmlChange}
          onClearCustomHtml={handleClearCustomHtml}
          onPresetChange={handlePresetChange}
          onFontMoodChange={handleFontMoodChange}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
          onUpdateLayer={handleUpdateLayer}
          onAddLayer={handleAddLayer}
          onRemoveLayer={handleRemoveLayer}
          onReorderLayer={handleReorderLayer}
          onBulkReorderLayers={handleBulkReorderLayers}
          recentColors={recentColors}
          onColorUsed={handleColorUsed}
          onAddInfographicSlide={handleAddInfographicSlide}
          onInsertImage={handleInsertImage}
          onSetBackground={handleSetBackground}
          onRenderSlide={handleRenderCurrentSlide}
          onApplyRefinement={handleApplyRefinement}
          polishContext={{
            contentType: currentSlide.kind,
            platform: "instagram",
            mood: spec.fontMood,
            keyMessage: currentSlide.title,
          }}
        />
        {currentSlide.layers && currentSlide.layers.length > 0 ? (
          <LayerCanvas
            layers={currentSlide.layers}
            canvasWidth={spec.canvasSize?.width ?? 1080}
            canvasHeight={spec.canvasSize?.height ?? 1350}
            background={spec.globalStyle?.bgGradient ?? "#FFFFFF"}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onUpdateLayer={handleUpdateLayer}
            selectedLayerIds={selectedLayerIds}
            onSelectLayers={setSelectedLayerIds}
            onDeleteLayers={handleDeleteLayers}
            onDuplicateLayers={handleDuplicateLayers}
          />
        ) : (
          <PreviewPanel
            slide={currentSlide}
            globalStyle={spec.globalStyle}
            rawHtml={currentSlide.customHtml}
            fontMood={spec.fontMood}
            canvasSize={spec.canvasSize}
            heroImageFit={spec.heroImageFit}
            effects={previewEffects}
          />
        )}

        {showPublish && (
          <div style={s.publishSidebar}>
            <div style={s.publishHeader}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>SNS 발행</span>
              <button
                type="button"
                style={{ ...s.iconBtn, width: 28, height: 28, fontSize: 12 }}
                onClick={() => setShowPublish(false)}
              >
                ✕
              </button>
            </div>

            {renderingForPublish ? (
              <div style={{ padding: 20, textAlign: "center" as const, color: "var(--text-muted)", fontSize: 13 }}>
                슬라이드 렌더링 중...
              </div>
            ) : (
              <>
                {publishMediaUrls.length > 0 && (
                  <div style={s.publishThumbs}>
                    {publishMediaUrls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`slide ${String(i + 1)}`}
                        style={s.publishThumb}
                      />
                    ))}
                  </div>
                )}
                <QuickPublishPanel
                  text={publishText}
                  mediaUrls={publishMediaUrls}
                  onPublished={() => setShowPublish(false)}
                />
              </>
            )}
          </div>
        )}
      </div>

      <SlideNavigation spec={spec} onSelectSlide={handleSelectSlide} onAddSlide={handleAddSlide} onRemoveSlide={handleRemoveSlide} />
    </div>
  );
}
