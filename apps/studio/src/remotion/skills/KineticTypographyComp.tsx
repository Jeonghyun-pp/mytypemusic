/**
 * KineticTypography — words animated individually with dynamic motion.
 *
 * Use cases: song lyrics, article quotes, impactful statements.
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

const wordSchema = z.object({
  text: z.string(),
  emphasis: z.boolean().default(false),
  color: z.string().optional(),
});

export const kineticTypographySchema = z.object({
  words: z.array(wordSchema).min(1),
  style: z.enum(["cascade", "explode", "wave", "spotlight"]).default("cascade"),
  fontSize: z.number().default(72),
  fontFamily: z.string().default("Pretendard, sans-serif"),
  backgroundColor: z.string().default("#0A0A1A"),
  textColor: z.string().default("#FFFFFF"),
  emphasisColor: z.string().default("#6C5CE7"),
  framesPerWord: z.number().default(12),
  holdFrames: z.number().default(60),
});

export type KineticTypographyProps = z.infer<typeof kineticTypographySchema>;

export function calculateKineticDuration(props: KineticTypographyProps): number {
  return props.words.length * props.framesPerWord + props.holdFrames;
}

// ── Word renderers ───────────────────────────────────

function CascadeWord({ text, progress, fontSize, color, fps }: {
  text: string; progress: number; fontSize: number; color: string; fps: number;
}) {
  const frame = Math.round(progress * 20);
  const scale = spring({ fps, frame, config: { damping: 12, stiffness: 180 } });
  const y = interpolate(progress, [0, 1], [80, 0], CLAMP);
  return (
    <span style={{
      display: "inline-block",
      fontSize, color,
      transform: `translateY(${y}px) scale(${scale})`,
      opacity: Math.min(progress * 4, 1),
      margin: "0 8px",
    }}>
      {text}
    </span>
  );
}

function ExplodeWord({ text, progress, fontSize, color }: {
  text: string; progress: number; fontSize: number; color: string;
}) {
  const scale = interpolate(progress, [0, 0.3, 1], [3, 1, 1], CLAMP);
  const opacity = interpolate(progress, [0, 0.15], [0, 1], CLAMP);
  return (
    <span style={{
      display: "inline-block",
      fontSize, color,
      transform: `scale(${scale})`,
      opacity,
      margin: "0 8px",
    }}>
      {text}
    </span>
  );
}

function WaveWord({ text, progress, fontSize, color, index }: {
  text: string; progress: number; fontSize: number; color: string; index: number;
}) {
  const wave = Math.sin(progress * Math.PI * 2 + index * 0.5) * 15;
  const opacity = interpolate(progress, [0, 0.2], [0, 1], CLAMP);
  return (
    <span style={{
      display: "inline-block",
      fontSize, color,
      transform: `translateY(${wave}px)`,
      opacity,
      margin: "0 8px",
    }}>
      {text}
    </span>
  );
}

function SpotlightWord({ text, progress, fontSize, color, isActive }: {
  text: string; progress: number; fontSize: number; color: string; isActive: boolean;
}) {
  const opacity = isActive ? 1 : 0.2;
  const scale = isActive ? 1.15 : 1;
  return (
    <span style={{
      display: "inline-block",
      fontSize, color,
      transform: `scale(${scale})`,
      opacity,
      margin: "0 8px",
      transition: "opacity 0.1s, transform 0.1s",
    }}>
      {text}
    </span>
  );
}

// ── Main composition ─────────────────────────────────

export const KineticTypographyComp: React.FC<KineticTypographyProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const {
    words, style, fontSize, fontFamily,
    backgroundColor, textColor, emphasisColor, framesPerWord,
  } = props;

  // Determine which word is currently being revealed
  const activeIndex = Math.min(
    Math.floor(frame / framesPerWord),
    words.length - 1,
  );

  return (
    <AbsoluteFill style={{
      backgroundColor,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontFamily,
      fontWeight: 700,
      padding: "60px",
    }}>
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        maxWidth: "90%",
        lineHeight: 1.4,
      }}>
        {words.map((word, i) => {
          const wordStart = i * framesPerWord;
          const progress = interpolate(
            frame,
            [wordStart, wordStart + framesPerWord],
            [0, 1],
            CLAMP,
          );

          // Hide words that haven't started yet (except spotlight shows all)
          if (frame < wordStart && style !== "spotlight") {
            return <span key={String(i)} style={{ display: "none" }} />;
          }

          const color = word.emphasis ? (word.color ?? emphasisColor) : (word.color ?? textColor);
          const fSize = word.emphasis ? fontSize * 1.2 : fontSize;

          if (style === "cascade") {
            return <CascadeWord key={String(i)} text={word.text} progress={progress} fontSize={fSize} color={color} fps={fps} />;
          }
          if (style === "explode") {
            return <ExplodeWord key={String(i)} text={word.text} progress={progress} fontSize={fSize} color={color} />;
          }
          if (style === "wave") {
            return <WaveWord key={String(i)} text={word.text} progress={progress} fontSize={fSize} color={color} index={i} />;
          }
          // spotlight
          return <SpotlightWord key={String(i)} text={word.text} progress={progress} fontSize={fSize} color={color} isActive={i === activeIndex} />;
        })}
      </div>
    </AbsoluteFill>
  );
};
