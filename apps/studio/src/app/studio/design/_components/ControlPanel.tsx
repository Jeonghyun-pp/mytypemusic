"use client";

import { useState } from "react";
import type { SlideSpec, SlideStyleOverrides, DesignSpec, AiDesignAction, TemplateId } from "@/lib/studio/designEditor/types";
import type { Layer, LayerKind } from "@/lib/studio/designEditor/layerTypes";
import StyleControlsTab from "./StyleControlsTab";
import AiDesignChat from "./AiDesignChat";
import ReferenceImagesTab from "./ReferenceImagesTab";
import CodeEditorTab from "./CodeEditorTab";
import LayerPanel from "./LayerPanel";
import DatabaseImportTab from "./DatabaseImportTab";
import DataVizTab from "./DataVizTab";
import ImageSearchPanel from "./ImageSearchPanel";
import AiPolishPanel from "./AiPolishPanel";

type Tab = "style" | "ai" | "ref" | "code" | "layers" | "db" | "dataviz" | "images" | "polish";

interface ControlPanelProps {
  slide: SlideSpec;
  spec: DesignSpec;
  onSlideChange: (patch: Partial<SlideSpec>) => void;
  onStyleChange: (patch: Partial<SlideStyleOverrides>) => void;
  onApplyActions: (actions: AiDesignAction[]) => void;
  onApplyGlobalStyle: (style: SlideStyleOverrides) => void;
  onCustomHtmlChange: (html: string) => void;
  onClearCustomHtml: () => void;
  onPresetChange: (presetId: string) => void;
  onFontMoodChange: (mood: string) => void;
  // Layer mode
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
  onAddLayer: (kind: LayerKind) => void;
  onRemoveLayer: (id: string) => void;
  onReorderLayer: (id: string, direction: "up" | "down") => void;
  onBulkReorderLayers?: (orderedIds: string[]) => void;
  // Color tracking
  recentColors?: string[];
  onColorUsed?: (color: string) => void;
  // Data viz
  onAddInfographicSlide: (templateId: TemplateId, title: string, bodyText: string, footerText: string) => void;
  // Image search
  onInsertImage?: (url: string, attribution: string) => void;
  onSetBackground?: (url: string) => void;
  // AI Polish
  onRenderSlide?: () => Promise<string | null>;
  onApplyRefinement?: (instructions: string) => void;
  polishContext?: { contentType?: string; platform?: string; mood?: string; keyMessage?: string };
}

const s = {
  panel: {
    width: "380px",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column" as const,
    borderRight: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    overflow: "hidden",
  } as const,
  tabBar: {
    display: "flex",
    borderBottom: "1px solid var(--border-light)",
    flexShrink: 0,
    padding: "0 8px",
    gap: "2px",
  } as const,
  tab: {
    flex: 1,
    padding: "11px 0",
    background: "none",
    borderTop: "none",
    borderRight: "none",
    borderLeft: "none",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
    fontSize: "13px",
    color: "var(--text-muted)",
    fontWeight: 400,
    transition: "all var(--transition)",
  } as const,
  tabActive: {
    color: "var(--accent)",
    borderBottom: "2px solid var(--accent)",
    fontWeight: 600,
  } as const,
  body: {
    flex: 1,
    padding: "16px",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    minHeight: 0,
  } as const,
  bodyNoPad: {
    flex: 1,
    padding: 0,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    minHeight: 0,
  } as const,
};

export default function ControlPanel({
  slide,
  spec,
  onSlideChange,
  onStyleChange,
  onApplyActions,
  onApplyGlobalStyle,
  onCustomHtmlChange,
  onClearCustomHtml,
  onPresetChange,
  onFontMoodChange,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onAddLayer,
  onRemoveLayer,
  onReorderLayer,
  onBulkReorderLayers,
  recentColors,
  onColorUsed,
  onAddInfographicSlide,
  onInsertImage,
  onSetBackground,
  onRenderSlide,
  onApplyRefinement,
  polishContext,
}: ControlPanelProps) {
  const [tab, setTab] = useState<Tab>("style");

  return (
    <div style={s.panel}>
      <div style={s.tabBar}>
        <button
          type="button"
          style={{ ...s.tab, ...(tab === "style" ? s.tabActive : {}) }}
          onClick={() => setTab("style")}
        >
          스타일
        </button>
        <button
          type="button"
          style={{ ...s.tab, ...(tab === "code" ? s.tabActive : {}) }}
          onClick={() => setTab("code")}
        >
          코드
        </button>
        <button
          type="button"
          style={{ ...s.tab, ...(tab === "ai" ? s.tabActive : {}) }}
          onClick={() => setTab("ai")}
        >
          AI
        </button>
        <button
          type="button"
          style={{ ...s.tab, ...(tab === "layers" ? s.tabActive : {}) }}
          onClick={() => setTab("layers")}
        >
          레이어
        </button>
        <button
          type="button"
          style={{ ...s.tab, ...(tab === "dataviz" ? s.tabActive : {}) }}
          onClick={() => setTab("dataviz")}
        >
          차트
        </button>
        <button
          type="button"
          style={{ ...s.tab, ...(tab === "ref" ? s.tabActive : {}) }}
          onClick={() => setTab("ref")}
        >
          참고
        </button>
        <button
          type="button"
          style={{ ...s.tab, ...(tab === "images" ? s.tabActive : {}) }}
          onClick={() => setTab("images")}
        >
          이미지
        </button>
        <button
          type="button"
          style={{ ...s.tab, ...(tab === "polish" ? s.tabActive : {}) }}
          onClick={() => setTab("polish")}
        >
          평가
        </button>
        <button
          type="button"
          style={{ ...s.tab, ...(tab === "db" ? s.tabActive : {}) }}
          onClick={() => setTab("db")}
        >
          DB
        </button>
      </div>

      <div style={tab === "code" ? s.bodyNoPad : s.body}>
        {tab === "style" && (
          <StyleControlsTab
            slide={slide}
            presetId={spec.presetId}
            fontMood={spec.fontMood}
            globalStyle={spec.globalStyle}
            recentColors={recentColors}
            onColorUsed={onColorUsed}
            onChange={onSlideChange}
            onStyleChange={onStyleChange}
            onPresetChange={onPresetChange}
            onFontMoodChange={onFontMoodChange}
            onClearCustomHtml={onClearCustomHtml}
            onApplyGlobalStyle={onApplyGlobalStyle}
          />
        )}
        {tab === "code" && (
          <CodeEditorTab
            slide={slide}
            globalStyle={spec.globalStyle}
            onCustomHtmlChange={onCustomHtmlChange}
            onClearCustomHtml={onClearCustomHtml}
          />
        )}
        {tab === "ai" && (
          <AiDesignChat spec={spec} onApplyActions={onApplyActions} />
        )}
        {tab === "layers" && (
          <LayerPanel
            layers={slide.layers ?? []}
            selectedLayerId={selectedLayerId}
            onSelectLayer={onSelectLayer}
            onUpdateLayer={onUpdateLayer}
            onAddLayer={onAddLayer}
            onRemoveLayer={onRemoveLayer}
            onReorderLayer={onReorderLayer}
            onBulkReorderLayers={onBulkReorderLayers}
          />
        )}
        {tab === "dataviz" && (
          <DataVizTab
            slide={slide}
            onSlideChange={onSlideChange}
            onAddInfographicSlide={onAddInfographicSlide}
          />
        )}
        {tab === "ref" && (
          <ReferenceImagesTab
            onApplyGlobalStyle={onApplyGlobalStyle}
            onCustomHtmlChange={onCustomHtmlChange}
            onSwitchToCodeTab={() => setTab("code")}
            onSlideChange={onSlideChange}
            slideTitle={slide.title}
            slideBodyText={slide.bodyText}
            fontMood={spec.fontMood}
          />
        )}
        {tab === "db" && (
          <DatabaseImportTab
            onCustomHtmlChange={onCustomHtmlChange}
            onSlideChange={onSlideChange}
            onFontMoodChange={onFontMoodChange}
            onSwitchToCodeTab={() => setTab("code")}
          />
        )}
        {tab === "polish" && onRenderSlide && (
          <AiPolishPanel
            onRenderSlide={onRenderSlide}
            onApplyRefinement={onApplyRefinement}
            context={polishContext}
          />
        )}
        {tab === "images" && onInsertImage && (
          <ImageSearchPanel
            onInsertImage={onInsertImage}
            onSetBackground={onSetBackground}
          />
        )}
      </div>
    </div>
  );
}
