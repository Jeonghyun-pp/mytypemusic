/**
 * SplitScreen — side-by-side or top-bottom comparison view.
 *
 * Use cases: before/after, versus comparisons, album art + text.
 */
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { z } from "zod";
import { CLAMP, hexToRgba } from "./types";

// ── Schema ───────────────────────────────────────────

const panelSchema = z.object({
  imageUrl: z.string().optional(),
  backgroundColor: z.string().default("#1A1A2E"),
  title: z.string().default(""),
  subtitle: z.string().default(""),
  body: z.string().default(""),
  textColor: z.string().default("#FFFFFF"),
  accentColor: z.string().default("#6C5CE7"),
});

export const splitScreenSchema = z.object({
  left: panelSchema,
  right: panelSchema,
  direction: z.enum(["horizontal", "vertical"]).default("horizontal"),
  splitRatio: z.number().min(0.1).max(0.9).default(0.5),
  dividerColor: z.string().default("#6C5CE7"),
  dividerWidth: z.number().default(4),
  animateIn: z.enum(["slide", "reveal", "fade"]).default("slide"),
  fontFamily: z.string().default("Pretendard, sans-serif"),
  holdFrames: z.number().default(120),
});

export type SplitScreenProps = z.infer<typeof splitScreenSchema>;

export function calculateSplitScreenDuration(props: SplitScreenProps): number {
  return 30 + props.holdFrames; // 30 frames animation + hold
}

// ── Panel renderer ───────────────────────────────────

function Panel({ panel, fontFamily }: { panel: z.infer<typeof panelSchema>; fontFamily: string }) {
  return (
    <div style={{
      width: "100%",
      height: "100%",
      position: "relative",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: panel.backgroundColor,
      overflow: "hidden",
    }}>
      {panel.imageUrl && (
        <Img src={panel.imageUrl} style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }} />
      )}
      {panel.imageUrl && (
        <div style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundColor: hexToRgba("#000000", 0.35),
        }} />
      )}
      <div style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
        padding: "40px",
        fontFamily,
        textAlign: "center" as const,
      }}>
        {panel.title && (
          <div style={{ fontSize: 36, fontWeight: 700, color: panel.textColor }}>{panel.title}</div>
        )}
        {panel.subtitle && (
          <div style={{ fontSize: 22, fontWeight: 500, color: panel.accentColor }}>{panel.subtitle}</div>
        )}
        {panel.body && (
          <div style={{ fontSize: 18, color: panel.textColor, opacity: 0.85, lineHeight: 1.5, maxWidth: 400 }}>
            {panel.body}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main composition ─────────────────────────────────

export const SplitScreenComp: React.FC<SplitScreenProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const {
    left, right, direction, splitRatio, dividerColor,
    dividerWidth, animateIn, fontFamily,
  } = props;

  const progress = interpolate(frame, [0, 30], [0, 1], CLAMP);
  const isHorizontal = direction === "horizontal";

  let leftStyle: React.CSSProperties = {};
  let rightStyle: React.CSSProperties = {};

  switch (animateIn) {
    case "slide": {
      const offset = (1 - progress) * 100;
      if (isHorizontal) {
        leftStyle = { transform: `translateX(-${offset}%)` };
        rightStyle = { transform: `translateX(${offset}%)` };
      } else {
        leftStyle = { transform: `translateY(-${offset}%)` };
        rightStyle = { transform: `translateY(${offset}%)` };
      }
      break;
    }
    case "reveal": {
      if (isHorizontal) {
        leftStyle = { clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` };
        rightStyle = { clipPath: `inset(0 0 0 ${(1 - progress) * 100}%)` };
      } else {
        leftStyle = { clipPath: `inset(0 0 ${(1 - progress) * 100}% 0)` };
        rightStyle = { clipPath: `inset(${(1 - progress) * 100}% 0 0 0)` };
      }
      break;
    }
    case "fade":
      leftStyle = { opacity: progress };
      rightStyle = { opacity: progress };
      break;
  }

  const pctLeft = `${splitRatio * 100}%`;
  const pctRight = `${(1 - splitRatio) * 100}%`;

  return (
    <AbsoluteFill style={{
      display: "flex",
      flexDirection: isHorizontal ? "row" : "column",
      backgroundColor: "#000",
    }}>
      <div style={{
        width: isHorizontal ? pctLeft : "100%",
        height: isHorizontal ? "100%" : pctLeft,
        overflow: "hidden",
        ...leftStyle,
      }}>
        <Panel panel={left} fontFamily={fontFamily} />
      </div>

      {/* Divider */}
      <div style={{
        width: isHorizontal ? dividerWidth : "100%",
        height: isHorizontal ? "100%" : dividerWidth,
        backgroundColor: dividerColor,
        opacity: progress,
      }} />

      <div style={{
        width: isHorizontal ? pctRight : "100%",
        height: isHorizontal ? "100%" : pctRight,
        overflow: "hidden",
        ...rightStyle,
      }}>
        <Panel panel={right} fontFamily={fontFamily} />
      </div>
    </AbsoluteFill>
  );
};
