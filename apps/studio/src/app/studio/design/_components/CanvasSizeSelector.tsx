"use client";

import type { CanvasSize, HeroImageFit } from "@/lib/studio/designEditor/types";

interface CanvasSizeSelectorProps {
  value: CanvasSize | undefined;
  onChange: (size: CanvasSize) => void;
  heroImageFit: HeroImageFit;
  onHeroImageFitChange: (fit: HeroImageFit) => void;
}

const PRESETS: CanvasSize[] = [
  { width: 1080, height: 1350, label: "4:5" },
  { width: 1080, height: 1080, label: "1:1" },
  { width: 1080, height: 1920, label: "9:16" },
  { width: 1920, height: 1080, label: "16:9" },
];

const s = {
  wrapper: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  } as const,
  btn: {
    padding: "4px 10px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    fontSize: "11px",
    color: "var(--text-muted)",
    cursor: "pointer",
    transition: "all var(--transition)",
    whiteSpace: "nowrap" as const,
  } as const,
  active: {
    padding: "4px 10px",
    borderRadius: "8px",
    border: "1px solid var(--accent)",
    background: "var(--accent)",
    fontSize: "11px",
    color: "#fff",
    cursor: "pointer",
    transition: "all var(--transition)",
    whiteSpace: "nowrap" as const,
    fontWeight: 600,
  } as const,
  sep: {
    width: "1px",
    height: "16px",
    background: "var(--border-light)",
    flexShrink: 0,
  } as const,
};

export default function CanvasSizeSelector({ value, onChange, heroImageFit, onHeroImageFitChange }: CanvasSizeSelectorProps) {
  const currentW = value?.width ?? 1080;
  const currentH = value?.height ?? 1350;

  return (
    <div style={s.wrapper}>
      {PRESETS.map((preset) => {
        const isActive = preset.width === currentW && preset.height === currentH;
        return (
          <button
            key={preset.label}
            type="button"
            style={isActive ? s.active : s.btn}
            onClick={() => onChange(preset)}
            title={`${String(preset.width)} x ${String(preset.height)}`}
          >
            {preset.label}
          </button>
        );
      })}
      <span style={s.sep} />
      <button
        type="button"
        style={heroImageFit === "cover" ? s.active : s.btn}
        onClick={() => onHeroImageFitChange("cover")}
        title="이미지 비율 유지 (잘림 허용)"
      >
        잘림
      </button>
      <button
        type="button"
        style={heroImageFit === "fill" ? s.active : s.btn}
        onClick={() => onHeroImageFitChange("fill")}
        title="이미지를 캔버스에 맞춰 늘림"
      >
        채움
      </button>
    </div>
  );
}
