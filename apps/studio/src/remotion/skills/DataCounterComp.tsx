/**
 * DataCounter — animated number counters with labels.
 *
 * Use cases: streaming stats, chart rankings, milestones.
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

const counterSchema = z.object({
  label: z.string(),
  startValue: z.number().default(0),
  endValue: z.number(),
  prefix: z.string().default(""),
  suffix: z.string().default(""),
  color: z.string().optional(),
  decimals: z.number().default(0),
});

export const dataCounterSchema = z.object({
  counters: z.array(counterSchema).min(1),
  title: z.string().default(""),
  layout: z.enum(["row", "column", "grid"]).default("row"),
  backgroundColor: z.string().default("#1A1A2E"),
  textColor: z.string().default("#FFFFFF"),
  accentColor: z.string().default("#6C5CE7"),
  fontFamily: z.string().default("Pretendard, sans-serif"),
  countFrames: z.number().default(50),
  staggerFrames: z.number().default(8),
  holdFrames: z.number().default(60),
});

export type DataCounterProps = z.infer<typeof dataCounterSchema>;

export function calculateDataCounterDuration(props: DataCounterProps): number {
  return 15 + props.countFrames + (props.counters.length - 1) * props.staggerFrames + props.holdFrames;
}

// ── Counter item ─────────────────────────────────────

function CounterItem({ label, startValue, endValue, prefix, suffix, color, decimals, progress, accentColor, textColor, fontFamily }: {
  label: string; startValue: number; endValue: number;
  prefix: string; suffix: string; color?: string; decimals: number;
  progress: number; accentColor: string; textColor: string; fontFamily: string;
}) {
  const current = startValue + (endValue - startValue) * progress;
  const display = decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString();

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "8px",
      fontFamily,
    }}>
      <div style={{
        fontSize: 72,
        fontWeight: 800,
        color: color ?? accentColor,
        lineHeight: 1.1,
      }}>
        {prefix}{display}{suffix}
      </div>
      <div style={{
        fontSize: 22,
        fontWeight: 500,
        color: textColor,
        opacity: 0.8,
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Main composition ─────────────────────────────────

export const DataCounterComp: React.FC<DataCounterProps> = (props) => {
  const frame = useCurrentFrame();
  const {
    counters, title, layout, backgroundColor, textColor,
    accentColor, fontFamily, countFrames, staggerFrames,
  } = props;

  const introProgress = interpolate(frame, [0, 15], [0, 1], CLAMP);

  const layoutStyle: React.CSSProperties = layout === "column"
    ? { flexDirection: "column", gap: "40px" }
    : layout === "grid"
      ? { flexDirection: "row", flexWrap: "wrap", gap: "60px", justifyContent: "center" }
      : { flexDirection: "row", gap: "60px", justifyContent: "center" };

  return (
    <AbsoluteFill style={{
      backgroundColor,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: "50px",
      padding: "60px",
      fontFamily,
    }}>
      {title && (
        <div style={{
          fontSize: 38,
          fontWeight: 700,
          color: textColor,
          opacity: introProgress,
          textAlign: "center" as const,
        }}>
          {title}
        </div>
      )}

      <div style={{ display: "flex", ...layoutStyle, opacity: introProgress }}>
        {counters.map((counter, i) => {
          const start = 15 + i * staggerFrames;
          const progress = interpolate(frame, [start, start + countFrames], [0, 1], CLAMP);
          // Ease out cubic for natural deceleration
          const eased = 1 - Math.pow(1 - progress, 3);

          return (
            <CounterItem
              key={String(i)}
              {...counter}
              progress={eased}
              accentColor={accentColor}
              textColor={textColor}
              fontFamily={fontFamily}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
