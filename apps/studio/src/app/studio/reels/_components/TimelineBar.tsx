"use client";

interface TimelineBarProps {
  trimStart: number;
  trimEnd: number;
  totalFrames: number;
  fps: number;
  onTrimChange: (start: number, end: number) => void;
}

function framesToSec(frames: number, fps: number): string {
  return (frames / fps).toFixed(1);
}

export default function TimelineBar({
  trimStart,
  trimEnd,
  totalFrames,
  fps,
  onTrimChange,
}: TimelineBarProps) {
  const maxFrames = Math.max(totalFrames, 1);

  return (
    <div style={s.container}>
      <span style={s.label}>Trim</span>

      <div style={s.sliderRow}>
        <span style={s.timeLabel}>{framesToSec(trimStart, fps)}s</span>
        <div style={s.sliderWrap}>
          <input
            type="range"
            min={0}
            max={maxFrames}
            value={trimStart}
            onChange={(e) => {
              const v = Number(e.target.value);
              onTrimChange(Math.min(v, trimEnd - fps), trimEnd);
            }}
            style={s.slider}
          />
          <input
            type="range"
            min={0}
            max={maxFrames}
            value={trimEnd}
            onChange={(e) => {
              const v = Number(e.target.value);
              onTrimChange(trimStart, Math.max(v, trimStart + fps));
            }}
            style={s.slider}
          />
        </div>
        <span style={s.timeLabel}>{framesToSec(trimEnd, fps)}s</span>
      </div>

      <div style={s.info}>
        Duration: {framesToSec(trimEnd - trimStart, fps)}s
        {" / "}
        Total: {framesToSec(totalFrames, fps)}s
      </div>
    </div>
  );
}

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    color: "var(--text-muted)",
    fontWeight: 600,
  },
  sliderRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  sliderWrap: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  },
  slider: {
    width: "100%",
    accentColor: "var(--accent)",
    cursor: "pointer",
  },
  timeLabel: {
    fontSize: "11px",
    color: "var(--text-muted)",
    minWidth: "36px",
    textAlign: "center" as const,
    fontVariantNumeric: "tabular-nums",
  },
  info: {
    fontSize: "11px",
    color: "var(--text-muted)",
    textAlign: "center" as const,
  },
};
