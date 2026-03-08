/**
 * ChartAnimation — animated bar/line/pie charts for data visualization.
 *
 * Use cases: trend data, ranking comparisons, streaming stats.
 */
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { z } from "zod";
import { CLAMP, hexToRgba } from "./types";

// ── Schema ───────────────────────────────────────────

const dataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
  color: z.string().optional(),
});

export const chartAnimationSchema = z.object({
  chartType: z.enum(["bar", "horizontal_bar", "pie", "progress"]).default("bar"),
  title: z.string().default(""),
  data: z.array(dataPointSchema).min(1),
  colors: z.array(z.string()).default(["#6C5CE7", "#00CEC9", "#FD79A8", "#FDCB6E", "#E17055"]),
  backgroundColor: z.string().default("#1A1A2E"),
  textColor: z.string().default("#FFFFFF"),
  fontFamily: z.string().default("Pretendard, sans-serif"),
  animationFrames: z.number().default(45),
  holdFrames: z.number().default(60),
  showValues: z.boolean().default(true),
  maxValue: z.number().optional(),
  unit: z.string().default(""),
});

export type ChartAnimationProps = z.infer<typeof chartAnimationSchema>;

export function calculateChartDuration(props: ChartAnimationProps): number {
  return props.animationFrames + props.holdFrames + 15; // 15 frames intro
}

// ── Bar chart ────────────────────────────────────────

function BarChart({ data, colors, progress, maxVal, showValues, unit, textColor, fontFamily }: {
  data: ChartAnimationProps["data"]; colors: string[]; progress: number;
  maxVal: number; showValues: boolean; unit: string; textColor: string; fontFamily: string;
}) {
  const barWidth = Math.min(80, Math.floor(600 / data.length));
  const gap = Math.max(8, Math.floor(barWidth * 0.3));

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      gap: `${gap}px`,
      height: 500,
      width: "100%",
      fontFamily,
    }}>
      {data.map((d, i) => {
        const color = d.color ?? colors[i % colors.length]!;
        const height = (d.value / maxVal) * 400 * progress;
        const val = Math.round(d.value * progress);
        return (
          <div key={String(i)} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {showValues && (
              <div style={{ color: textColor, fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
                {val}{unit}
              </div>
            )}
            <div style={{
              width: barWidth,
              height: `${height}px`,
              backgroundColor: color,
              borderRadius: "6px 6px 0 0",
            }} />
            <div style={{
              color: textColor,
              fontSize: 14,
              marginTop: 8,
              textAlign: "center" as const,
              maxWidth: barWidth + 20,
              overflow: "hidden",
            }}>
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Horizontal bar chart ─────────────────────────────

function HorizontalBarChart({ data, colors, progress, maxVal, showValues, unit, textColor, fontFamily }: {
  data: ChartAnimationProps["data"]; colors: string[]; progress: number;
  maxVal: number; showValues: boolean; unit: string; textColor: string; fontFamily: string;
}) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      width: "80%",
      fontFamily,
    }}>
      {data.map((d, i) => {
        const color = d.color ?? colors[i % colors.length]!;
        const width = (d.value / maxVal) * 100 * progress;
        const val = Math.round(d.value * progress);
        return (
          <div key={String(i)} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: textColor, fontSize: 18 }}>
              <span>{d.label}</span>
              {showValues && <span style={{ fontWeight: 600 }}>{val}{unit}</span>}
            </div>
            <div style={{ height: 28, backgroundColor: hexToRgba(color, 0.2), borderRadius: 6, overflow: "hidden" }}>
              <div style={{
                width: `${width}%`,
                height: "100%",
                backgroundColor: color,
                borderRadius: 6,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Progress circles (pie-like) ──────────────────────

function ProgressChart({ data, colors, progress, showValues, unit, textColor, fontFamily }: {
  data: ChartAnimationProps["data"]; colors: string[]; progress: number;
  showValues: boolean; unit: string; textColor: string; fontFamily: string;
}) {
  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: "40px",
      fontFamily,
    }}>
      {data.map((d, i) => {
        const color = d.color ?? colors[i % colors.length]!;
        const pct = Math.min(d.value, 100) * progress;
        const val = Math.round(d.value * progress);
        const deg = (pct / 100) * 360;
        return (
          <div key={String(i)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: `conic-gradient(${color} ${deg}deg, ${hexToRgba(color, 0.15)} ${deg}deg)`,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                backgroundColor: "#1A1A2E",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: textColor,
                fontSize: 22,
                fontWeight: 700,
              }}>
                {showValues ? `${val}${unit}` : ""}
              </div>
            </div>
            <div style={{ color: textColor, fontSize: 16 }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main composition ─────────────────────────────────

export const ChartAnimationComp: React.FC<ChartAnimationProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const {
    chartType, title, data, colors, backgroundColor, textColor,
    fontFamily, animationFrames, showValues, maxValue, unit,
  } = props;

  const introProgress = interpolate(frame, [0, 15], [0, 1], CLAMP);
  const chartProgress = interpolate(frame, [15, 15 + animationFrames], [0, 1], CLAMP);

  const maxVal = maxValue ?? (data.length > 0 ? Math.max(...data.map((d) => d.value)) : 1);

  const chartProps = {
    data, colors, progress: chartProgress, maxVal,
    showValues, unit, textColor, fontFamily,
  };

  return (
    <AbsoluteFill style={{
      backgroundColor,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: "40px",
      padding: "60px",
      fontFamily,
    }}>
      {title && (
        <div style={{
          fontSize: 42,
          fontWeight: 700,
          color: textColor,
          opacity: introProgress,
          transform: `translateY(${(1 - introProgress) * 20}px)`,
          textAlign: "center" as const,
        }}>
          {title}
        </div>
      )}

      <div style={{ opacity: introProgress }}>
        {chartType === "bar" && <BarChart {...chartProps} />}
        {chartType === "horizontal_bar" && <HorizontalBarChart {...chartProps} />}
        {(chartType === "pie" || chartType === "progress") && <ProgressChart {...chartProps} />}
      </div>
    </AbsoluteFill>
  );
};
