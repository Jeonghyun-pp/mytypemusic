"use client";

import type { TextOverlay } from "@/remotion/ReelsComp";

interface TextOverlayPanelProps {
  overlays: TextOverlay[];
  onChange: (overlays: TextOverlay[]) => void;
  fps: number;
}

const POSITIONS = ["top", "center", "bottom"] as const;

export default function TextOverlayPanel({ overlays, onChange, fps }: TextOverlayPanelProps) {
  function addOverlay() {
    onChange([
      ...overlays,
      {
        text: "",
        startFrame: 0,
        durationFrames: fps * 3,
        position: "bottom",
        fontSize: 48,
        color: "#ffffff",
      },
    ]);
  }

  function removeOverlay(idx: number) {
    onChange(overlays.filter((_, i) => i !== idx));
  }

  function updateOverlay(idx: number, patch: Partial<TextOverlay>) {
    onChange(overlays.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.label}>Text Overlays</span>
        <button type="button" style={s.addBtn} onClick={addOverlay}>
          + Add
        </button>
      </div>

      {overlays.length === 0 && (
        <span style={s.emptyHint}>No text overlays yet</span>
      )}

      {overlays.map((overlay, idx) => (
        <div key={idx} style={s.card}>
          <div style={s.cardHeader}>
            <span style={s.cardTitle}>Text {idx + 1}</span>
            <button type="button" style={s.removeBtn} onClick={() => removeOverlay(idx)}>
              x
            </button>
          </div>

          <textarea
            style={s.textarea}
            value={overlay.text}
            onChange={(e) => updateOverlay(idx, { text: e.target.value })}
            placeholder="Enter text..."
            rows={2}
          />

          <div style={s.row}>
            <div style={s.field}>
              <span style={s.fieldLabel}>Position</span>
              <select
                style={s.select}
                value={overlay.position}
                onChange={(e) =>
                  updateOverlay(idx, { position: e.target.value as TextOverlay["position"] })
                }
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div style={s.field}>
              <span style={s.fieldLabel}>Size</span>
              <input
                style={s.input}
                type="number"
                min={16}
                max={120}
                value={overlay.fontSize}
                onChange={(e) => updateOverlay(idx, { fontSize: Number(e.target.value) || 48 })}
              />
            </div>
            <div style={s.field}>
              <span style={s.fieldLabel}>Color</span>
              <input
                style={{ ...s.input, padding: "2px", height: "30px" }}
                type="color"
                value={overlay.color}
                onChange={(e) => updateOverlay(idx, { color: e.target.value })}
              />
            </div>
          </div>

          <div style={s.row}>
            <div style={s.field}>
              <span style={s.fieldLabel}>Start (s)</span>
              <input
                style={s.input}
                type="number"
                min={0}
                step={0.5}
                value={Math.round((overlay.startFrame / fps) * 10) / 10}
                onChange={(e) =>
                  updateOverlay(idx, { startFrame: Math.round(Number(e.target.value) * fps) })
                }
              />
            </div>
            <div style={s.field}>
              <span style={s.fieldLabel}>Duration (s)</span>
              <input
                style={s.input}
                type="number"
                min={0.5}
                step={0.5}
                value={Math.round((overlay.durationFrames / fps) * 10) / 10}
                onChange={(e) =>
                  updateOverlay(idx, {
                    durationFrames: Math.max(fps, Math.round(Number(e.target.value) * fps)),
                  })
                }
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const s = {
  container: { display: "flex", flexDirection: "column" as const, gap: "8px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: "13px", color: "var(--text-muted)", fontWeight: 600 },
  addBtn: {
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 600,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  emptyHint: { fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" as const },
  card: {
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "10px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: "12px", fontWeight: 600, color: "var(--text)" },
  removeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: "14px",
  },
  textarea: {
    width: "100%",
    padding: "6px 8px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--text)",
    fontSize: "13px",
    fontFamily: "inherit",
    resize: "vertical" as const,
    outline: "none",
  },
  row: { display: "flex", gap: "8px" },
  field: { flex: 1, display: "flex", flexDirection: "column" as const, gap: "2px" },
  fieldLabel: { fontSize: "11px", color: "var(--text-muted)" },
  select: {
    padding: "4px 6px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--text)",
    fontSize: "12px",
    outline: "none",
  },
  input: {
    padding: "4px 6px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--text)",
    fontSize: "12px",
    outline: "none",
    width: "100%",
  },
};
