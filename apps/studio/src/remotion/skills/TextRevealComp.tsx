/**
 * TextReveal — animated text entrance with multiple reveal styles.
 *
 * Use cases: article titles, quote reveals, section headers.
 */
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { z } from "zod";
import { CLAMP, hexToRgba } from "./types";

// ── Schema ───────────────────────────────────────────

const textLineSchema = z.object({
  text: z.string(),
  fontSize: z.number().default(64),
  fontWeight: z.number().default(700),
  color: z.string().default("#FFFFFF"),
  delayFrames: z.number().default(0),
});

export const textRevealSchema = z.object({
  lines: z.array(textLineSchema).min(1),
  revealStyle: z.enum(["fade_up", "typewriter", "split", "scale_bounce"]).default("fade_up"),
  backgroundColor: z.string().default("#1A1A2E"),
  backgroundGradient: z.string().optional(),
  fontFamily: z.string().default("Pretendard, sans-serif"),
  lineSpacing: z.number().default(20),
  staggerFrames: z.number().default(10),
  holdFrames: z.number().default(60),
});

export type TextRevealProps = z.infer<typeof textRevealSchema>;

export function calculateTextRevealDuration(props: TextRevealProps): number {
  if (props.lines.length === 0) return props.holdFrames || 30;
  const lastLineDelay = (props.lines.length - 1) * props.staggerFrames;
  const maxCustomDelay = Math.max(0, ...props.lines.map((l) => l.delayFrames));
  const revealTime = 30; // frames for reveal animation
  return lastLineDelay + maxCustomDelay + revealTime + props.holdFrames;
}

// ── Reveal renderers ─────────────────────────────────

function FadeUpLine({ text, fontSize, fontWeight, color, progress }: {
  text: string; fontSize: number; fontWeight: number; color: string; progress: number;
}) {
  const y = interpolate(progress, [0, 1], [40, 0], CLAMP);
  return (
    <div style={{
      fontSize, fontWeight, color,
      opacity: progress,
      transform: `translateY(${y}px)`,
      textAlign: "center" as const,
      lineHeight: 1.3,
    }}>
      {text}
    </div>
  );
}

function TypewriterLine({ text, fontSize, fontWeight, color, progress }: {
  text: string; fontSize: number; fontWeight: number; color: string; progress: number;
}) {
  const chars = Math.floor(progress * text.length);
  const visible = text.slice(0, chars);
  const cursorOpacity = progress < 1 ? 1 : 0;
  return (
    <div style={{ fontSize, fontWeight, color, textAlign: "center" as const, lineHeight: 1.3 }}>
      {visible}
      <span style={{ opacity: cursorOpacity, marginLeft: 2 }}>|</span>
    </div>
  );
}

function ScaleBounce({ text, fontSize, fontWeight, color, progress, fps }: {
  text: string; fontSize: number; fontWeight: number; color: string; progress: number; fps: number;
}) {
  const frame = Math.round(progress * 30);
  const scale = spring({ fps, frame, config: { damping: 10, stiffness: 200 } });
  return (
    <div style={{
      fontSize, fontWeight, color,
      transform: `scale(${scale})`,
      opacity: Math.min(progress * 3, 1),
      textAlign: "center" as const,
      lineHeight: 1.3,
    }}>
      {text}
    </div>
  );
}

function SplitLine({ text, fontSize, fontWeight, color, progress }: {
  text: string; fontSize: number; fontWeight: number; color: string; progress: number;
}) {
  const mid = Math.ceil(text.length / 2);
  const left = text.slice(0, mid);
  const right = text.slice(mid);
  const offset = interpolate(progress, [0, 1], [60, 0], CLAMP);
  return (
    <div style={{
      fontSize, fontWeight, color,
      textAlign: "center" as const,
      lineHeight: 1.3,
      display: "flex",
      justifyContent: "center",
    }}>
      <span style={{ transform: `translateX(-${offset}px)`, opacity: progress }}>{left}</span>
      <span style={{ transform: `translateX(${offset}px)`, opacity: progress }}>{right}</span>
    </div>
  );
}

// ── Main composition ─────────────────────────────────

export const TextRevealComp: React.FC<TextRevealProps> = ({
  lines,
  revealStyle,
  backgroundColor,
  backgroundGradient,
  fontFamily,
  lineSpacing,
  staggerFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bg = backgroundGradient
    ? { background: backgroundGradient }
    : { backgroundColor };

  return (
    <AbsoluteFill style={{
      ...bg,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      padding: "60px",
      fontFamily,
      gap: `${lineSpacing}px`,
    }}>
      {lines.map((line, i) => {
        const start = i * staggerFrames + line.delayFrames;
        const revealDuration = revealStyle === "typewriter" ? 40 : 20;
        const progress = interpolate(
          frame,
          [start, start + revealDuration],
          [0, 1],
          CLAMP,
        );

        const props = {
          text: line.text,
          fontSize: line.fontSize,
          fontWeight: line.fontWeight,
          color: line.color,
          progress,
        };

        return (
          <div key={String(i)}>
            {revealStyle === "fade_up" && <FadeUpLine {...props} />}
            {revealStyle === "typewriter" && <TypewriterLine {...props} />}
            {revealStyle === "scale_bounce" && <ScaleBounce {...props} fps={fps} />}
            {revealStyle === "split" && <SplitLine {...props} />}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
