"use client";

import { useState } from "react";
import { CONTENT_CATEGORIES } from "@/lib/studio/contentCategories";
import type { CategoryId, FrequencyConfig } from "@/lib/studio/plan/types";
import { DAY_LABELS } from "@/lib/studio/plan/types";

interface PlanConfigFormProps {
  onGenerate: (config: {
    startDate: string;
    endDate: string;
    frequency: FrequencyConfig;
    preferences?: {
      focusCategories?: CategoryId[];
      avoidCategories?: CategoryId[];
      typeRatio?: { post: number; reels: number; promotion: number };
      notes?: string;
    };
  }) => void;
  isGenerating: boolean;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const PRESETS = [
  { label: "이번 주", days: 7, offset: 0 },
  { label: "다음 주", days: 7, offset: 7 },
  { label: "2주", days: 14, offset: 0 },
] as const;

export default function PlanConfigForm({ onGenerate, isGenerating }: PlanConfigFormProps) {
  const today = new Date();
  const [startDate, setStartDate] = useState(toDateStr(today));
  const [endDate, setEndDate] = useState(toDateStr(addDays(today, 6)));
  const [weeklyTotal, setWeeklyTotal] = useState(5);
  const [maxPerDay, setMaxPerDay] = useState(2);
  const [heavyDays, setHeavyDays] = useState<number[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [focusCategories, setFocusCategories] = useState<CategoryId[]>([]);
  const [avoidCategories, setAvoidCategories] = useState<CategoryId[]>([]);
  const [postRatio, setPostRatio] = useState(60);
  const [reelsRatio, setReelsRatio] = useState(30);
  const [promoRatio, setPromoRatio] = useState(10);
  const [notes, setNotes] = useState("");

  function applyPreset(preset: (typeof PRESETS)[number]) {
    const start = addDays(today, preset.offset);
    setStartDate(toDateStr(start));
    setEndDate(toDateStr(addDays(start, preset.days - 1)));
  }

  function toggleCategory(
    id: CategoryId,
    list: CategoryId[],
    setList: (v: CategoryId[]) => void,
    otherList: CategoryId[],
    setOther: (v: CategoryId[]) => void,
  ) {
    if (list.includes(id)) {
      setList(list.filter((c) => c !== id));
    } else {
      setList([...list, id]);
      setOther(otherList.filter((c) => c !== id));
    }
  }

  function handleSubmit() {
    const prefs: NonNullable<PlanConfigFormProps["onGenerate"] extends (c: infer C) => void ? C : never>["preferences"] = {};
    if (focusCategories.length) prefs.focusCategories = focusCategories;
    if (avoidCategories.length) prefs.avoidCategories = avoidCategories;
    prefs.typeRatio = { post: postRatio, reels: reelsRatio, promotion: promoRatio };
    if (notes.trim()) prefs.notes = notes.trim();

    onGenerate({
      startDate,
      endDate,
      frequency: {
        weeklyTotal,
        maxPerDay,
        ...(heavyDays.length > 0 ? { heavyDays } : {}),
      },
      preferences: prefs,
    });
  }

  return (
    <div style={styles.container}>
      {/* Date range */}
      <div style={styles.row}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>기간</label>
          <div style={styles.dateRow}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.dateInput}
            />
            <span style={styles.dateSep}>~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={styles.dateInput}
            />
          </div>
          <div style={styles.presetRow}>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                style={styles.presetBtn}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Frequency */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>주간 게시 설정</label>

          {/* Weekly total */}
          <div style={styles.freqInputRow}>
            <span style={styles.freqInputLabel}>주간 총</span>
            <button
              style={styles.stepBtn}
              onClick={() => setWeeklyTotal(Math.max(1, weeklyTotal - 1))}
              disabled={weeklyTotal <= 1}
            >
              -
            </button>
            <span style={styles.freqValue}>{weeklyTotal}</span>
            <button
              style={styles.stepBtn}
              onClick={() => setWeeklyTotal(Math.min(21, weeklyTotal + 1))}
              disabled={weeklyTotal >= 21}
            >
              +
            </button>
            <span style={styles.freqInputUnit}>개</span>
          </div>

          {/* Max per day */}
          <div style={styles.freqInputRow}>
            <span style={styles.freqInputLabel}>일당 최대</span>
            <div style={styles.freqRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  style={{
                    ...styles.freqBtn,
                    ...(maxPerDay === n ? styles.freqBtnActive : {}),
                  }}
                  onClick={() => setMaxPerDay(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <span style={styles.freqInputUnit}>개</span>
          </div>

          {/* Heavy days */}
          <div style={styles.freqInputRow}>
            <span style={styles.freqInputLabel}>집중 요일</span>
            <div style={styles.freqRow}>
              {DAY_LABELS.map((label, idx) => (
                <button
                  key={idx}
                  style={{
                    ...styles.dayBtn,
                    ...(heavyDays.includes(idx) ? styles.dayBtnActive : {}),
                  }}
                  onClick={() =>
                    setHeavyDays(
                      heavyDays.includes(idx)
                        ? heavyDays.filter((d) => d !== idx)
                        : [...heavyDays, idx],
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate button */}
        <button
          style={{
            ...styles.generateBtn,
            ...(isGenerating ? styles.generateBtnDisabled : {}),
          }}
          onClick={handleSubmit}
          disabled={isGenerating}
        >
          {isGenerating ? "생성 중..." : "플랜 생성"}
        </button>
      </div>

      {/* Advanced toggle */}
      <button
        style={styles.advancedToggle}
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? "고급 설정 접기 ▲" : "고급 설정 ▼"}
      </button>

      {showAdvanced && (
        <div style={styles.advancedSection}>
          {/* Type ratio */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>타입 비율</label>
            <div style={styles.ratioRow}>
              <div style={styles.ratioItem}>
                <span style={styles.ratioLabel}>Post</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={postRatio}
                  onChange={(e) => setPostRatio(Number(e.target.value))}
                  style={styles.ratioSlider}
                />
                <span style={styles.ratioVal}>{postRatio}%</span>
              </div>
              <div style={styles.ratioItem}>
                <span style={styles.ratioLabel}>Reels</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={reelsRatio}
                  onChange={(e) => setReelsRatio(Number(e.target.value))}
                  style={styles.ratioSlider}
                />
                <span style={styles.ratioVal}>{reelsRatio}%</span>
              </div>
              <div style={styles.ratioItem}>
                <span style={styles.ratioLabel}>Promo</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={promoRatio}
                  onChange={(e) => setPromoRatio(Number(e.target.value))}
                  style={styles.ratioSlider}
                />
                <span style={styles.ratioVal}>{promoRatio}%</span>
              </div>
            </div>
          </div>

          {/* Focus categories */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>선호 카테고리</label>
            <div style={styles.chipRow}>
              {CONTENT_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  style={{
                    ...styles.chip,
                    ...(focusCategories.includes(c.id as CategoryId)
                      ? styles.chipFocus
                      : {}),
                  }}
                  onClick={() =>
                    toggleCategory(
                      c.id as CategoryId,
                      focusCategories,
                      setFocusCategories,
                      avoidCategories,
                      setAvoidCategories,
                    )
                  }
                  title={c.description}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Avoid categories */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>제외 카테고리</label>
            <div style={styles.chipRow}>
              {CONTENT_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  style={{
                    ...styles.chip,
                    ...(avoidCategories.includes(c.id as CategoryId)
                      ? styles.chipAvoid
                      : {}),
                  }}
                  onClick={() =>
                    toggleCategory(
                      c.id as CategoryId,
                      avoidCategories,
                      setAvoidCategories,
                      focusCategories,
                      setFocusCategories,
                    )
                  }
                  title={c.description}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>추가 요청</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예: 3월 페스티벌 시즌 반영, 데이식스 컴백 주제 포함..."
              style={styles.textarea}
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    padding: "24px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
  } as React.CSSProperties,

  row: {
    display: "flex",
    gap: "24px",
    alignItems: "flex-end",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  } as React.CSSProperties,

  label: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } as React.CSSProperties,

  dateRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  } as React.CSSProperties,

  dateInput: {
    padding: "8px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "13px",
    outline: "none",
  } as React.CSSProperties,

  dateSep: {
    color: "var(--text-muted)",
    fontSize: "14px",
  } as React.CSSProperties,

  presetRow: {
    display: "flex",
    gap: "6px",
  } as React.CSSProperties,

  presetBtn: {
    padding: "4px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "11px",
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  freqInputRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  } as React.CSSProperties,

  freqInputLabel: {
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text)",
    width: "64px",
    flexShrink: 0,
  } as React.CSSProperties,

  freqInputUnit: {
    fontSize: "12px",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  freqValue: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text)",
    minWidth: "24px",
    textAlign: "center" as const,
  } as React.CSSProperties,

  stepBtn: {
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  freqRow: {
    display: "flex",
    gap: "4px",
  } as React.CSSProperties,

  freqBtn: {
    padding: "6px 12px",
    borderRadius: "8px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-light)",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  freqBtnActive: {
    background: "var(--accent)",
    color: "#fff",
    borderColor: "var(--accent)",
    fontWeight: 600,
  } as React.CSSProperties,

  dayBtn: {
    padding: "6px 10px",
    borderRadius: "8px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-light)",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  dayBtnActive: {
    background: "var(--accent-light)",
    color: "var(--accent)",
    borderColor: "var(--accent)",
    fontWeight: 600,
  } as React.CSSProperties,

  generateBtn: {
    padding: "12px 32px",
    borderRadius: "12px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
    marginLeft: "auto",
    alignSelf: "flex-end" as const,
  } as React.CSSProperties,

  generateBtnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  } as React.CSSProperties,

  advancedToggle: {
    padding: "6px 0",
    border: "none",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "12px",
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all var(--transition)",
  } as React.CSSProperties,

  advancedSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    paddingTop: "8px",
    borderTop: "1px solid var(--border-light)",
  } as React.CSSProperties,

  ratioRow: {
    display: "flex",
    gap: "20px",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  ratioItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: 1,
    minWidth: "180px",
  } as React.CSSProperties,

  ratioLabel: {
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text)",
    width: "42px",
  } as React.CSSProperties,

  ratioSlider: {
    flex: 1,
    accentColor: "var(--accent)",
  } as React.CSSProperties,

  ratioVal: {
    fontSize: "12px",
    color: "var(--text-muted)",
    width: "36px",
    textAlign: "right" as const,
  } as React.CSSProperties,

  chipRow: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  chip: {
    padding: "5px 12px",
    borderRadius: "8px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-light)",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "11px",
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  chipFocus: {
    background: "var(--accent-light)",
    color: "var(--accent)",
    borderColor: "var(--accent)",
    fontWeight: 600,
  } as React.CSSProperties,

  chipAvoid: {
    background: "rgba(239,68,68,0.1)",
    color: "var(--red)",
    borderColor: "var(--red)",
    fontWeight: 600,
  } as React.CSSProperties,

  textarea: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "13px",
    resize: "vertical" as const,
    outline: "none",
    fontFamily: "inherit",
  } as React.CSSProperties,
};
