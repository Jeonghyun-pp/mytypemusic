"use client";

import { useState, useCallback } from "react";
import type { SlideSpec, TemplateId, SlideKind } from "@/lib/studio/designEditor/types";

// ── Infographic template presets ────────────────────────────

interface InfographicPreset {
  templateId: TemplateId;
  kind: SlideKind;
  label: string;
  description: string;
  placeholder: string;
  example: string;
}

const INFOGRAPHIC_PRESETS: InfographicPreset[] = [
  {
    templateId: "infographic.bar.v1",
    kind: "infographic",
    label: "Bar Chart",
    description: "수평 막대 그래프 — 순위, 비교 데이터에 적합",
    placeholder: "Label | Value 형식으로 입력\n(한 줄에 하나씩, 최대 8개)",
    example: "BTS | 1200\nNewJeans | 980\naespa | 870\nSTAYC | 650\nIVE | 620",
  },
  {
    templateId: "infographic.donut.v1",
    kind: "infographic",
    label: "Donut Chart",
    description: "도넛 차트 — 비율, 점유율 표시에 적합",
    placeholder: "Label | Value 형식으로 입력\n(한 줄에 하나씩, 최대 6개)",
    example: "K-Pop | 45\nPop | 25\nHip-Hop | 15\nR&B | 10\nIndie | 5",
  },
  {
    templateId: "infographic.comparison.v1",
    kind: "infographic",
    label: "Comparison",
    description: "좌우 비교 — 두 항목의 지표를 나란히 비교",
    placeholder: "첫 줄: Left이름 | Right이름\n이후: Metric | Left값 | Right값\n(최대 6개 지표)",
    example: "BTS | NewJeans\n스트리밍 | 5억 | 3.2억\n팔로워 | 4200만 | 3100만\n앨범 판매 | 280만 | 190만",
  },
  {
    templateId: "infographic.timeline.v1",
    kind: "infographic",
    label: "Timeline",
    description: "타임라인 — 시간순 이벤트, 연혁 표시에 적합",
    placeholder: "Label | Date | Description 형식으로 입력\n(한 줄에 하나씩, 최대 6개)",
    example: "데뷔 | 2020.03 | 첫 미니앨범 발매\n첫 1위 | 2020.08 | 음악방송 1위\n월드투어 | 2021.05 | 아시아 10개 도시",
  },
];

// ── Styles ──────────────────────────────────────────────────

const st = {
  wrap: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    overflowY: "auto" as const,
    flex: 1,
  },
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  label: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  presetGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  presetBtn: {
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all 0.15s",
  },
  presetBtnActive: {
    borderColor: "var(--accent)",
    background: "rgba(108,92,231,0.08)",
  },
  presetName: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: "4px",
  },
  presetDesc: {
    fontSize: "11px",
    color: "var(--text-muted)",
    lineHeight: "1.4",
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "13px",
    color: "var(--text)",
    outline: "none",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "12px",
    fontFamily: "monospace",
    color: "var(--text)",
    outline: "none",
    resize: "vertical" as const,
    minHeight: "120px",
    lineHeight: "1.6",
  },
  exampleBtn: {
    padding: "4px 10px",
    borderRadius: "6px",
    border: "1px solid var(--border-light)",
    background: "none",
    fontSize: "11px",
    color: "var(--text-muted)",
    cursor: "pointer",
  },
  applyBtn: {
    padding: "10px 20px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
    marginTop: "4px",
  },
  hint: {
    fontSize: "11px",
    color: "var(--text-muted)",
    lineHeight: "1.5",
    padding: "8px 10px",
    background: "rgba(108,92,231,0.05)",
    borderRadius: "8px",
    borderLeft: "3px solid var(--accent)",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
};

// ── Component ───────────────────────────────────────────────

interface DataVizTabProps {
  slide: SlideSpec;
  onSlideChange: (patch: Partial<SlideSpec>) => void;
  onAddInfographicSlide: (templateId: TemplateId, title: string, bodyText: string, footerText: string) => void;
}

export default function DataVizTab({
  slide,
  onSlideChange,
  onAddInfographicSlide,
}: DataVizTabProps) {
  const [selectedPreset, setSelectedPreset] = useState<InfographicPreset | null>(
    () => INFOGRAPHIC_PRESETS.find((p) => p.templateId === slide.templateId) ?? null,
  );
  const [title, setTitle] = useState(slide.kind === "infographic" ? slide.title : "");
  const [dataText, setDataText] = useState(slide.kind === "infographic" ? slide.bodyText : "");
  const [footer, setFooter] = useState(slide.kind === "infographic" ? slide.footerText : "@your_magazine");

  const isCurrentInfographic = slide.kind === "infographic";

  const handleSelectPreset = useCallback((preset: InfographicPreset) => {
    setSelectedPreset(preset);
    if (!title) setTitle(preset.label);
  }, [title]);

  const handleLoadExample = useCallback(() => {
    if (selectedPreset) {
      setDataText(selectedPreset.example);
      if (!title) setTitle(selectedPreset.label);
    }
  }, [selectedPreset, title]);

  const handleApplyToCurrent = useCallback(() => {
    if (!selectedPreset) return;
    onSlideChange({
      kind: "infographic",
      templateId: selectedPreset.templateId,
      title: title || selectedPreset.label,
      bodyText: dataText,
      footerText: footer,
    });
  }, [selectedPreset, title, dataText, footer, onSlideChange]);

  const handleAddNew = useCallback(() => {
    if (!selectedPreset) return;
    onAddInfographicSlide(
      selectedPreset.templateId,
      title || selectedPreset.label,
      dataText,
      footer,
    );
  }, [selectedPreset, title, dataText, footer, onAddInfographicSlide]);

  // Sync from slide when it's an infographic
  const handleSyncFromSlide = useCallback(() => {
    if (isCurrentInfographic) {
      setTitle(slide.title);
      setDataText(slide.bodyText);
      setFooter(slide.footerText);
      const preset = INFOGRAPHIC_PRESETS.find((p) => p.templateId === slide.templateId);
      if (preset) setSelectedPreset(preset);
    }
  }, [isCurrentInfographic, slide]);

  return (
    <div style={st.wrap}>
      {/* Template selection */}
      <div style={st.section}>
        <div style={st.label}>Chart Type</div>
        <div style={st.presetGrid}>
          {INFOGRAPHIC_PRESETS.map((preset) => (
            <button
              key={preset.templateId}
              type="button"
              style={{
                ...st.presetBtn,
                ...(selectedPreset?.templateId === preset.templateId ? st.presetBtnActive : {}),
              }}
              onClick={() => handleSelectPreset(preset)}
            >
              <div style={st.presetName}>{preset.label}</div>
              <div style={st.presetDesc}>{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {selectedPreset && (
        <>
          {/* Title */}
          <div style={st.section}>
            <div style={st.label}>Title</div>
            <input
              type="text"
              style={st.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="차트 제목"
            />
          </div>

          {/* Data input */}
          <div style={st.section}>
            <div style={st.row}>
              <div style={st.label}>Data</div>
              <button type="button" style={st.exampleBtn} onClick={handleLoadExample}>
                예시 불러오기
              </button>
            </div>
            <textarea
              style={st.textarea}
              value={dataText}
              onChange={(e) => setDataText(e.target.value)}
              placeholder={selectedPreset.placeholder}
            />
          </div>

          {/* Footer */}
          <div style={st.section}>
            <div style={st.label}>Footer</div>
            <input
              type="text"
              style={st.input}
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="@your_magazine"
            />
          </div>

          {/* Format hint */}
          <div style={st.hint}>
            {selectedPreset.placeholder}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "8px" }}>
            {isCurrentInfographic ? (
              <button
                type="button"
                style={st.applyBtn}
                onClick={handleApplyToCurrent}
              >
                현재 슬라이드에 적용
              </button>
            ) : (
              <>
                <button
                  type="button"
                  style={st.applyBtn}
                  onClick={handleApplyToCurrent}
                >
                  현재 슬라이드 변환
                </button>
                <button
                  type="button"
                  style={{
                    ...st.applyBtn,
                    background: "var(--bg-input)",
                    color: "var(--text)",
                    border: "1px solid var(--border-light)",
                  }}
                  onClick={handleAddNew}
                >
                  새 슬라이드 추가
                </button>
              </>
            )}
          </div>

          {isCurrentInfographic && (
            <button
              type="button"
              style={st.exampleBtn}
              onClick={handleSyncFromSlide}
            >
              현재 슬라이드에서 데이터 불러오기
            </button>
          )}
        </>
      )}
    </div>
  );
}
