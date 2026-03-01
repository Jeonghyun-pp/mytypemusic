"use client";

import { useState, useCallback, useRef } from "react";
import type { SlideSpec, TemplateId, SlideStyleOverrides } from "@/lib/studio/designEditor/types";
import { TEMPLATES, TEMPLATES_BY_KIND } from "@/lib/studio/designEditor/templates";

interface PaletteEntry {
  id: string;
  name: string;
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  textColor: string;
}

const PALETTE_LIST: PaletteEntry[] = [
  { id: "editorial", name: "Editorial", background: "#FAFAF8", primary: "#F5F0EB", secondary: "#E8E0D8", accent: "#1A1A1A", textColor: "#1A1A1A" },
  { id: "monochrome", name: "Monochrome", background: "#FFFFFF", primary: "#F5F5F5", secondary: "#333333", accent: "#000000", textColor: "#1A1A1A" },
  { id: "warmVintage", name: "Warm Vintage", background: "#F5EDE3", primary: "#D4C5B2", secondary: "#8B7D6B", accent: "#8B7D6B", textColor: "#3D3529" },
  { id: "neonDark", name: "Neon Dark", background: "#0A0A0F", primary: "#1A1A2E", secondary: "#16213E", accent: "#E94560", textColor: "#EAEAEA" },
  { id: "pastelSoft", name: "Pastel Soft", background: "#FFF5F5", primary: "#FFE4E6", secondary: "#FECDD3", accent: "#F472B6", textColor: "#4A2532" },
  { id: "deepForest", name: "Deep Forest", background: "#1A2E1A", primary: "#2D4A2D", secondary: "#3D6B3D", accent: "#8FBC8F", textColor: "#E8F0E8" },
  { id: "oceanBreeze", name: "Ocean Breeze", background: "#F0F7FA", primary: "#D6EAF2", secondary: "#A8D5E2", accent: "#1A6B8A", textColor: "#1A3A4A" },
  { id: "sunsetWarm", name: "Sunset Warm", background: "#FFF3E6", primary: "#FFE0B2", secondary: "#FFB74D", accent: "#E65100", textColor: "#3E2723" },
  { id: "urbanGrit", name: "Urban Grit", background: "#2A2A2A", primary: "#3D3D3D", secondary: "#555555", accent: "#FF6B35", textColor: "#F0F0F0" },
  { id: "luxuryGold", name: "Luxury Gold", background: "#1A1A1A", primary: "#2D2D2D", secondary: "#3D3D3D", accent: "#C9A96E", textColor: "#F5F0E8" },
  { id: "retroPop", name: "Retro Pop", background: "#FFFDE7", primary: "#FFF9C4", secondary: "#FFEE58", accent: "#D84315", textColor: "#33261A" },
  { id: "nightClub", name: "Night Club", background: "#0D0015", primary: "#1A0033", secondary: "#2D004D", accent: "#BB86FC", textColor: "#E8DAEF" },
  { id: "minimalMono", name: "Minimal Mono", background: "#F8F8F8", primary: "#EEEEEE", secondary: "#E0E0E0", accent: "#424242", textColor: "#212121" },
];

interface StyleControlsTabProps {
  slide: SlideSpec;
  presetId?: string;
  fontMood?: string;
  globalStyle?: SlideStyleOverrides;
  onChange: (patch: Partial<SlideSpec>) => void;
  onStyleChange: (patch: Partial<SlideStyleOverrides>) => void;
  onPresetChange: (presetId: string) => void;
  onFontMoodChange: (mood: string) => void;
  onClearCustomHtml: () => void;
  onApplyGlobalStyle: (style: SlideStyleOverrides) => void;
}

const s = {
  section: {
    marginBottom: "18px",
  } as const,
  label: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    marginBottom: "8px",
    display: "block",
  } as const,
  input: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "13px",
    lineHeight: "1.4",
    outline: "none",
    resize: "vertical" as const,
    transition: "border-color var(--transition), box-shadow var(--transition)",
  } as const,
  textarea: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "13px",
    lineHeight: "1.5",
    outline: "none",
    resize: "vertical" as const,
    minHeight: "60px",
    transition: "border-color var(--transition), box-shadow var(--transition)",
  } as const,
  row: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginBottom: "8px",
  } as const,
  select: {
    flex: 1,
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "13px",
    outline: "none",
    cursor: "pointer",
    transition: "border-color var(--transition)",
  } as const,
  colorInput: {
    width: "36px",
    height: "36px",
    padding: "2px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "none",
    cursor: "pointer",
  } as const,
  slider: {
    flex: 1,
    accentColor: "var(--accent)",
  } as const,
  sliderVal: {
    fontSize: "12px",
    color: "var(--text-muted)",
    width: "36px",
    textAlign: "right" as const,
    flexShrink: 0,
  } as const,
};

const BG_PRESETS = [
  { id: "transparent", label: "투명", value: "transparent" },
  { id: "white", label: "흰색", value: "#FFFFFF" },
  { id: "light", label: "라이트", value: "#F7F8FA" },
  { id: "dark", label: "다크", value: "#1A1A2E" },
  { id: "custom", label: "직접 선택", value: "" },
] as const;

export default function StyleControlsTab({ slide, presetId, fontMood, globalStyle, onChange, onStyleChange, onPresetChange, onFontMoodChange, onClearCustomHtml, onApplyGlobalStyle }: StyleControlsTabProps) {
  const overrides = slide.styleOverrides ?? {};
  const tmpl = TEMPLATES[slide.templateId];
  const availableTemplates = TEMPLATES_BY_KIND[slide.kind];
  const heroInputRef = useRef<HTMLInputElement>(null);

  const currentBg = globalStyle?.bgGradient ?? "transparent";
  const matchedPreset = BG_PRESETS.find((p) => p.value === currentBg);
  const [bgMode, setBgMode] = useState(matchedPreset?.id ?? "custom");
  const [customBg, setCustomBg] = useState(matchedPreset ? "" : currentBg);
  const [activePaletteId, setActivePaletteId] = useState<string | null>(null);
  const [aiPaletteLoading, setAiPaletteLoading] = useState(false);
  const [aiPalette, setAiPalette] = useState<PaletteEntry | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const paletteImageRef = useRef<HTMLInputElement>(null);

  const setText = useCallback(
    (field: "title" | "bodyText" | "footerText", value: string) => {
      onChange({ [field]: value });
    },
    [onChange],
  );

  const handleAiPaletteUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUri = reader.result as string;
        setAiPaletteLoading(true);
        setAiError(null);
        setAiPalette(null);

        fetch("/api/design/generate-palette", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUri: dataUri }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error((data as Record<string, string>).error ?? `HTTP ${String(res.status)}`);
            }
            return res.json() as Promise<{ palette: PaletteEntry }>;
          })
          .then((data) => {
            setAiPalette(data.palette);
          })
          .catch((err: unknown) => {
            setAiError(err instanceof Error ? err.message : String(err));
          })
          .finally(() => {
            setAiPaletteLoading(false);
          });
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  const handleHeroUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        onChange({ heroImageDataUri: reader.result as string });
      };
      reader.readAsDataURL(file);
    },
    [onChange],
  );

  return (
    <div style={{ overflowY: "auto", flex: 1, paddingRight: "4px" }}>
      {/* ── Code mode warning ───────────────────── */}
      {slide.customHtml && (
        <div
          style={{
            padding: "10px 12px",
            marginBottom: "12px",
            borderRadius: "8px",
            background: "rgba(229, 85, 85, 0.08)",
            border: "1px solid rgba(229, 85, 85, 0.2)",
            fontSize: "12px",
            lineHeight: "1.5",
            color: "var(--text)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>
            코드 모드 활성
          </div>
          <div style={{ color: "var(--text-muted)" }}>
            스타일 변경이 미리보기에 반영되지 않습니다.
            코드 탭의 HTML이 우선 적용됩니다.
          </div>
          <button
            type="button"
            style={{
              marginTop: "8px",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(229, 85, 85, 0.3)",
              background: "none",
              color: "#e55",
              fontSize: "11px",
              cursor: "pointer",
            }}
            onClick={onClearCustomHtml}
          >
            코드 초기화 (템플릿 모드로 복귀)
          </button>
        </div>
      )}
      {/* ── Preset selector ────────────────────── */}
      <div style={s.section}>
        <label style={s.label}>프리셋</label>
        <select
          style={s.select}
          value={presetId ?? "default"}
          onChange={(e) => onPresetChange(e.target.value)}
        >
          <option value="default">기본 (Bold Display)</option>
          <option value="news">뉴스 (Impact)</option>
          <option value="beauty">뷰티 (Editorial)</option>
          <option value="tech">테크 (Clean Sans)</option>
          <option value="lifestyle">라이프스타일 (Editorial)</option>
          <option value="finance">금융 (Minimal)</option>
          <option value="music">음악 (Bold Display)</option>
        </select>
      </div>

      {/* ── Palette grid ────────────────────────── */}
      <div style={s.section}>
        <label style={s.label}>팔레트</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
          {PALETTE_LIST.map((p) => {
            const isActive = activePaletteId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                title={p.name}
                style={{
                  padding: "6px",
                  borderRadius: "8px",
                  border: isActive ? "2px solid var(--accent)" : "1px solid var(--border-light)",
                  background: "var(--bg-card)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column" as const,
                  alignItems: "center",
                  gap: "4px",
                  transition: "all var(--transition)",
                }}
                onClick={() => {
                  setActivePaletteId(p.id);
                  onApplyGlobalStyle({
                    bgGradient: p.background,
                    textColor: p.textColor,
                    accentColor: p.accent,
                  });
                }}
              >
                <div style={{ display: "flex", gap: "2px" }}>
                  {[p.background, p.primary, p.secondary, p.accent, p.textColor].map((c, i) => (
                    <span
                      key={i}
                      style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "3px",
                        background: c,
                        border: "1px solid rgba(0,0,0,0.1)",
                        display: "block",
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: "9px", color: "var(--text-muted)", lineHeight: 1 }}>
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── AI Palette from image ────────────────── */}
      <div style={s.section}>
        <label style={s.label}>AI 팔레트 생성</label>
        <div
          style={{
            border: "2px dashed var(--border)",
            borderRadius: "8px",
            padding: "10px",
            textAlign: "center",
            cursor: aiPaletteLoading ? "wait" : "pointer",
            fontSize: "12px",
            color: "var(--text-muted)",
            opacity: aiPaletteLoading ? 0.6 : 1,
          }}
          onClick={() => {
            if (!aiPaletteLoading) paletteImageRef.current?.click();
          }}
        >
          {aiPaletteLoading ? "분석 중..." : "이미지에서 팔레트 추출"}
        </div>
        <input
          ref={paletteImageRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleAiPaletteUpload(file);
            e.target.value = "";
          }}
        />
        {aiError && (
          <div style={{ fontSize: "11px", color: "var(--red)", marginTop: "6px" }}>
            {aiError}
          </div>
        )}
        {aiPalette && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid var(--border-light)",
              background: "var(--bg-card)",
            }}
          >
            <div style={{ display: "flex", gap: "3px", marginBottom: "6px" }}>
              {[aiPalette.background, aiPalette.primary, aiPalette.secondary, aiPalette.accent, aiPalette.textColor].map((c, i) => (
                <span
                  key={i}
                  style={{
                    flex: 1,
                    height: "24px",
                    borderRadius: "4px",
                    background: c,
                    border: "1px solid rgba(0,0,0,0.1)",
                    display: "block",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{aiPalette.name}</span>
              <button
                type="button"
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--accent)",
                  background: "var(--accent-light)",
                  color: "var(--accent)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => {
                  setActivePaletteId("ai-generated");
                  onApplyGlobalStyle({
                    bgGradient: aiPalette.background,
                    textColor: aiPalette.textColor,
                    accentColor: aiPalette.accent,
                  });
                }}
              >
                적용
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Font mood selector ───────────────────── */}
      <div style={s.section}>
        <label style={s.label}>폰트 무드</label>
        <select
          style={s.select}
          value={fontMood ?? "bold-display"}
          onChange={(e) => onFontMoodChange(e.target.value)}
        >
          <option value="bold-display">Bold Display (Pretendard Bold)</option>
          <option value="clean-sans">Clean Sans (Noto Sans KR)</option>
          <option value="editorial">Editorial (Noto Serif KR)</option>
          <option value="minimal">Minimal (Pretendard SemiBold)</option>
          <option value="impact">Impact (Black Han Sans)</option>
          <option value="playful">Playful (Phase 2)</option>
        </select>
      </div>

      {/* ── Text fields ─────────────────────────── */}
      <div style={s.section}>
        <label style={s.label}>제목</label>
        <textarea
          style={s.textarea}
          value={slide.title}
          onChange={(e) => setText("title", e.target.value)}
          rows={2}
        />
      </div>
      <div style={s.section}>
        <label style={s.label}>본문</label>
        <textarea
          style={{ ...s.textarea, minHeight: "80px" }}
          value={slide.bodyText}
          onChange={(e) => setText("bodyText", e.target.value)}
          rows={3}
        />
      </div>
      <div style={s.section}>
        <label style={s.label}>푸터</label>
        <input
          style={s.input}
          value={slide.footerText}
          onChange={(e) => setText("footerText", e.target.value)}
        />
      </div>

      {/* ── Template selector ───────────────────── */}
      <div style={s.section}>
        <label style={s.label}>템플릿</label>
        <select
          style={s.select}
          value={slide.templateId}
          onChange={(e) => onChange({ templateId: e.target.value as TemplateId })}
        >
          {availableTemplates.map((tid) => (
            <option key={tid} value={tid}>
              {TEMPLATES[tid].label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Hero image upload ────────────────────── */}
      <div style={s.section}>
        <label style={s.label}>히어로 이미지</label>
        {slide.heroImageDataUri ? (
          <div style={{ position: "relative" }}>
            <img
              src={slide.heroImageDataUri}
              alt="Hero"
              style={{
                width: "100%",
                height: "80px",
                objectFit: "cover",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                display: "block",
              }}
            />
            <button
              type="button"
              style={{
                position: "absolute",
                top: "4px",
                right: "4px",
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                border: "none",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
              onClick={() => onChange({ heroImageDataUri: undefined })}
            >
              ×
            </button>
          </div>
        ) : (
          <div
            style={{
              border: "2px dashed var(--border)",
              borderRadius: "8px",
              padding: "12px",
              textAlign: "center",
              cursor: "pointer",
              fontSize: "12px",
              color: "var(--text-muted)",
            }}
            onClick={() => heroInputRef.current?.click()}
          >
            클릭하여 배경 이미지 업로드
          </div>
        )}
        <input
          ref={heroInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleHeroUpload(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* ── Background ──────────────────────────── */}
      <div style={s.section}>
        <label style={s.label}>배경</label>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "8px" }}>
          {BG_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              style={{
                padding: "5px 10px",
                borderRadius: "6px",
                border: bgMode === preset.id ? "1.5px solid var(--accent)" : "1px solid var(--border-light)",
                background: bgMode === preset.id ? "var(--accent-light)" : "var(--bg-card)",
                color: bgMode === preset.id ? "var(--accent)" : "var(--text-muted)",
                fontSize: "11px",
                fontWeight: bgMode === preset.id ? 600 : 400,
                cursor: "pointer",
              }}
              onClick={() => {
                setBgMode(preset.id);
                if (preset.id !== "custom") {
                  onApplyGlobalStyle({ bgGradient: preset.value });
                }
              }}
            >
              {preset.id === "transparent" && (
                <span style={{
                  display: "inline-block",
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  marginRight: "4px",
                  verticalAlign: "middle",
                  background: "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50%/8px 8px",
                  border: "1px solid var(--border)",
                }} />
              )}
              {preset.id !== "transparent" && preset.id !== "custom" && (
                <span style={{
                  display: "inline-block",
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  marginRight: "4px",
                  verticalAlign: "middle",
                  background: preset.value,
                  border: "1px solid var(--border)",
                }} />
              )}
              {preset.label}
            </button>
          ))}
        </div>
        {bgMode === "custom" && (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input
              type="color"
              style={s.colorInput}
              value={customBg.startsWith("#") ? customBg : "#5B5FC7"}
              onChange={(e) => {
                setCustomBg(e.target.value);
                onApplyGlobalStyle({ bgGradient: e.target.value });
              }}
            />
            <input
              type="text"
              style={{ ...s.input, flex: 1, fontSize: "11px", fontFamily: "var(--font-mono)" }}
              value={customBg || currentBg}
              placeholder="#hex 또는 linear-gradient(...)"
              onChange={(e) => {
                setCustomBg(e.target.value);
                onApplyGlobalStyle({ bgGradient: e.target.value });
              }}
            />
          </div>
        )}
      </div>

      {/* ── Colors ──────────────────────────────── */}
      <div style={s.section}>
        <label style={s.label}>색상</label>
        <div style={s.row}>
          <span style={{ fontSize: "12px", width: "60px", flexShrink: 0 }}>텍스트</span>
          <input
            type="color"
            style={s.colorInput}
            value={overrides.textColor ?? "#ffffff"}
            onChange={(e) => onStyleChange({ textColor: e.target.value })}
          />
          <span style={{ fontSize: "12px", width: "60px", flexShrink: 0 }}>악센트</span>
          <input
            type="color"
            style={s.colorInput}
            value={overrides.accentColor ?? "#5B5FC7"}
            onChange={(e) => onStyleChange({ accentColor: e.target.value })}
          />
        </div>
      </div>

      {/* ── Font size sliders ───────────────────── */}
      <div style={s.section}>
        <label style={s.label}>제목 크기</label>
        <div style={s.row}>
          <input
            type="range"
            min={20}
            max={120}
            style={s.slider}
            value={overrides.titleSizePx ?? tmpl.defaults.titleSizePx}
            onChange={(e) => onStyleChange({ titleSizePx: Number(e.target.value) })}
          />
          <span style={s.sliderVal}>{String(overrides.titleSizePx ?? tmpl.defaults.titleSizePx)}px</span>
        </div>
      </div>
      <div style={s.section}>
        <label style={s.label}>본문 크기</label>
        <div style={s.row}>
          <input
            type="range"
            min={16}
            max={80}
            style={s.slider}
            value={overrides.bodySizePx ?? tmpl.defaults.bodySizePx}
            onChange={(e) => onStyleChange({ bodySizePx: Number(e.target.value) })}
          />
          <span style={s.sliderVal}>{String(overrides.bodySizePx ?? tmpl.defaults.bodySizePx)}px</span>
        </div>
      </div>

      {/* ── Font weight ─────────────────────────── */}
      <div style={s.section}>
        <label style={s.label}>제목 굵기</label>
        <div style={s.row}>
          <input
            type="range"
            min={400}
            max={900}
            step={100}
            style={s.slider}
            value={overrides.titleWeight ?? tmpl.defaults.titleWeight}
            onChange={(e) => onStyleChange({ titleWeight: Number(e.target.value) })}
          />
          <span style={s.sliderVal}>{String(overrides.titleWeight ?? tmpl.defaults.titleWeight)}</span>
        </div>
      </div>

      {/* ── Card radius (V3 only) ───────────────── */}
      {slide.templateId === "body.fact.v3" && (
        <div style={s.section}>
          <label style={s.label}>카드 반경</label>
          <div style={s.row}>
            <input
              type="range"
              min={0}
              max={48}
              style={s.slider}
              value={overrides.cardRadius ?? 24}
              onChange={(e) => onStyleChange({ cardRadius: Number(e.target.value) })}
            />
            <span style={s.sliderVal}>{String(overrides.cardRadius ?? 24)}px</span>
          </div>
        </div>
      )}

      {/* ── Drop Shadow ──────────────────────────── */}
      <div style={s.section}>
        <label style={s.label}>그림자</label>
        <div style={s.row}>
          <span style={{ fontSize: "12px", width: "40px", flexShrink: 0 }}>X</span>
          <input
            type="range"
            min={-50}
            max={50}
            style={s.slider}
            value={globalStyle?.shadow?.offsetX ?? 0}
            onChange={(e) => {
              const cur = globalStyle?.shadow ?? { offsetX: 0, offsetY: 4, blur: 8, color: "rgba(0,0,0,0.3)" };
              onApplyGlobalStyle({ shadow: { ...cur, offsetX: Number(e.target.value) } });
            }}
          />
          <span style={s.sliderVal}>{String(globalStyle?.shadow?.offsetX ?? 0)}</span>
        </div>
        <div style={s.row}>
          <span style={{ fontSize: "12px", width: "40px", flexShrink: 0 }}>Y</span>
          <input
            type="range"
            min={-50}
            max={50}
            style={s.slider}
            value={globalStyle?.shadow?.offsetY ?? 0}
            onChange={(e) => {
              const cur = globalStyle?.shadow ?? { offsetX: 0, offsetY: 4, blur: 8, color: "rgba(0,0,0,0.3)" };
              onApplyGlobalStyle({ shadow: { ...cur, offsetY: Number(e.target.value) } });
            }}
          />
          <span style={s.sliderVal}>{String(globalStyle?.shadow?.offsetY ?? 0)}</span>
        </div>
        <div style={s.row}>
          <span style={{ fontSize: "12px", width: "40px", flexShrink: 0 }}>블러</span>
          <input
            type="range"
            min={0}
            max={50}
            style={s.slider}
            value={globalStyle?.shadow?.blur ?? 0}
            onChange={(e) => {
              const cur = globalStyle?.shadow ?? { offsetX: 0, offsetY: 4, blur: 8, color: "rgba(0,0,0,0.3)" };
              onApplyGlobalStyle({ shadow: { ...cur, blur: Number(e.target.value) } });
            }}
          />
          <span style={s.sliderVal}>{String(globalStyle?.shadow?.blur ?? 0)}</span>
        </div>
        <div style={s.row}>
          <span style={{ fontSize: "12px", width: "40px", flexShrink: 0 }}>색상</span>
          <input
            type="color"
            style={s.colorInput}
            value={(() => {
              const c = globalStyle?.shadow?.color ?? "";
              const m = c.match(/rgba?\((\d+),(\d+),(\d+)/);
              if (m) {
                const rr = Number(m[1]).toString(16).padStart(2, "0");
                const gg = Number(m[2]).toString(16).padStart(2, "0");
                const bb = Number(m[3]).toString(16).padStart(2, "0");
                return `#${rr}${gg}${bb}`;
              }
              return "#000000";
            })()}
            onChange={(e) => {
              const hex = e.target.value;
              const r = parseInt(hex.slice(1, 3), 16);
              const g = parseInt(hex.slice(3, 5), 16);
              const b = parseInt(hex.slice(5, 7), 16);
              const cur = globalStyle?.shadow ?? { offsetX: 0, offsetY: 4, blur: 8, color: "rgba(0,0,0,0.3)" };
              onApplyGlobalStyle({ shadow: { ...cur, color: `rgba(${String(r)},${String(g)},${String(b)},0.4)` } });
            }}
          />
          {globalStyle?.shadow && (
            <button
              type="button"
              style={{
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border-light)",
                background: "none",
                color: "var(--text-muted)",
                fontSize: "11px",
                cursor: "pointer",
                marginLeft: "auto",
              }}
              onClick={() => onApplyGlobalStyle({ shadow: undefined })}
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {/* ── Gaussian Blur ─────────────────────────── */}
      <div style={s.section}>
        <label style={s.label}>배경 블러</label>
        <div style={s.row}>
          <input
            type="range"
            min={0}
            max={30}
            step={0.5}
            style={s.slider}
            value={globalStyle?.blur ?? 0}
            onChange={(e) => onApplyGlobalStyle({ blur: Number(e.target.value) })}
          />
          <span style={s.sliderVal}>{String(globalStyle?.blur ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}
