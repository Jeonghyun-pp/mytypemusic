"use client";

import { useCallback } from "react";
import type { TextLayer } from "@/lib/studio/designEditor/layerTypes";
import type { Layer } from "@/lib/studio/designEditor/layerTypes";

interface TextToolbarProps {
  layer: TextLayer;
  onUpdate: (patch: Partial<Layer>) => void;
  /** Available font families from the design system */
  fonts?: string[];
}

const DEFAULT_FONTS = [
  "Pretendard, sans-serif",
  "Noto Sans KR, sans-serif",
  "Noto Serif KR, serif",
  "Montserrat, sans-serif",
  "Playfair Display, serif",
  "Inter, sans-serif",
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96, 120];
const FONT_WEIGHTS = [
  { label: "Thin", value: 100 },
  { label: "Light", value: 300 },
  { label: "Regular", value: 400 },
  { label: "Medium", value: 500 },
  { label: "Semi", value: 600 },
  { label: "Bold", value: 700 },
  { label: "Black", value: 900 },
];

const s = {
  bar: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "6px 8px",
    background: "var(--bg-card)",
    border: "1px solid var(--border-light)",
    borderRadius: "8px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
    flexWrap: "wrap" as const,
    maxWidth: "400px",
  },
  select: {
    padding: "3px 6px",
    borderRadius: "4px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "11px",
    color: "var(--text)",
    outline: "none",
    cursor: "pointer",
  },
  btn: (active: boolean) => ({
    width: "26px",
    height: "26px",
    borderRadius: "4px",
    border: "1px solid var(--border-light)",
    background: active ? "var(--accent)" : "var(--bg-card)",
    color: active ? "#fff" : "var(--text)",
    fontSize: "12px",
    fontWeight: 600 as const,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.1s ease",
  }),
  colorInput: {
    width: "26px",
    height: "26px",
    borderRadius: "4px",
    border: "1px solid var(--border-light)",
    padding: "1px",
    cursor: "pointer",
    background: "none",
  },
  separator: {
    width: "1px",
    height: "20px",
    background: "var(--border-light)",
    margin: "0 2px",
  },
  slider: {
    width: "60px",
    cursor: "pointer",
  },
  sliderLabel: {
    fontSize: "9px",
    color: "var(--text-muted)",
    whiteSpace: "nowrap" as const,
  },
};

export default function TextToolbar({ layer, onUpdate, fonts }: TextToolbarProps) {
  const fontList = fonts ?? DEFAULT_FONTS;

  const update = useCallback(
    (patch: Partial<TextLayer>) => onUpdate(patch as Partial<Layer>),
    [onUpdate],
  );

  return (
    <div
      style={s.bar}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Font family */}
      <select
        value={layer.fontFamily ?? fontList[0]}
        onChange={(e) => update({ fontFamily: e.target.value })}
        style={{ ...s.select, maxWidth: "110px" }}
      >
        {fontList.map((f) => (
          <option key={f} value={f}>{f.split(",")[0]}</option>
        ))}
      </select>

      {/* Font size */}
      <select
        value={layer.fontSize}
        onChange={(e) => update({ fontSize: Number(e.target.value) })}
        style={{ ...s.select, width: "50px" }}
      >
        {FONT_SIZES.map((sz) => (
          <option key={sz} value={sz}>{sz}</option>
        ))}
      </select>

      {/* Font weight */}
      <select
        value={layer.fontWeight}
        onChange={(e) => update({ fontWeight: Number(e.target.value) })}
        style={{ ...s.select, width: "65px" }}
      >
        {FONT_WEIGHTS.map((w) => (
          <option key={w.value} value={w.value}>{w.label}</option>
        ))}
      </select>

      <div style={s.separator} />

      {/* Text color */}
      <input
        type="color"
        value={layer.color}
        onChange={(e) => update({ color: e.target.value })}
        style={s.colorInput}
        title="텍스트 색상"
      />

      <div style={s.separator} />

      {/* Alignment */}
      <button
        type="button"
        style={s.btn(layer.textAlign === "left")}
        onClick={() => update({ textAlign: "left" })}
        title="왼쪽 정렬"
      >
        ≡
      </button>
      <button
        type="button"
        style={s.btn(layer.textAlign === "center")}
        onClick={() => update({ textAlign: "center" })}
        title="가운데 정렬"
      >
        ≡
      </button>
      <button
        type="button"
        style={s.btn(layer.textAlign === "right")}
        onClick={() => update({ textAlign: "right" })}
        title="오른쪽 정렬"
      >
        ≡
      </button>

      <div style={s.separator} />

      {/* Line height */}
      <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
        <span style={s.sliderLabel}>행간</span>
        <input
          type="range"
          min="0.8"
          max="3"
          step="0.1"
          value={layer.lineHeight}
          onChange={(e) => update({ lineHeight: parseFloat(e.target.value) })}
          style={s.slider}
        />
        <span style={{ ...s.sliderLabel, width: "24px" }}>{layer.lineHeight.toFixed(1)}</span>
      </div>

      {/* Letter spacing */}
      <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
        <span style={s.sliderLabel}>자간</span>
        <input
          type="range"
          min="-5"
          max="20"
          step="0.5"
          value={layer.letterSpacing}
          onChange={(e) => update({ letterSpacing: parseFloat(e.target.value) })}
          style={s.slider}
        />
        <span style={{ ...s.sliderLabel, width: "24px" }}>{layer.letterSpacing.toFixed(1)}</span>
      </div>
    </div>
  );
}
