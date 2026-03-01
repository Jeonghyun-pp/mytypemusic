import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { z } from "zod";

// ── Schema ───────────────────────────────────────────

const textOverlaySchema = z.object({
  text: z.string(),
  startFrame: z.number(),
  durationFrames: z.number(),
  position: z.enum(["top", "center", "bottom"]),
  fontSize: z.number(),
  color: z.string(),
});

export const reelsSchema = z.object({
  videoUrl: z.string(),
  overlayTexts: z.array(textOverlaySchema),
  trimStartFrame: z.number(),
  trimEndFrame: z.number(),
});

// ── Types ────────────────────────────────────────────

export type TextOverlay = z.infer<typeof textOverlaySchema>;
export type ReelsProps = z.infer<typeof reelsSchema>;

// ── Animated text ────────────────────────────────────

const AnimatedText: React.FC<{ overlay: TextOverlay }> = ({ overlay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [overlay.durationFrames - 10, overlay.durationFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const scale = spring({ fps, frame, config: { damping: 14, stiffness: 200 } });

  const positionStyle: React.CSSProperties =
    overlay.position === "top"
      ? { top: "12%", bottom: "auto" }
      : overlay.position === "center"
        ? { top: "42%", bottom: "auto" }
        : { top: "auto", bottom: "12%" };

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        ...positionStyle,
      }}
    >
      <div
        style={{
          fontSize: overlay.fontSize,
          color: overlay.color,
          fontWeight: 700,
          fontFamily: "Pretendard, sans-serif",
          opacity: opacity * fadeOut,
          transform: `scale(${scale})`,
          textShadow: "2px 2px 12px rgba(0,0,0,0.6)",
          textAlign: "center",
          padding: "0 60px",
          lineHeight: 1.3,
        }}
      >
        {overlay.text}
      </div>
    </AbsoluteFill>
  );
};

// ── Main composition ─────────────────────────────────

export const ReelsComp: React.FC<ReelsProps> = ({
  videoUrl,
  overlayTexts,
  trimStartFrame,
  trimEndFrame,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {videoUrl ? (
        <OffthreadVideo
          src={videoUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          {...(trimStartFrame > 0 ? { startFrom: trimStartFrame } : {})}
          {...(trimEndFrame > 0 ? { endAt: trimEndFrame } : {})}
        />
      ) : (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: 36,
              fontFamily: "sans-serif",
            }}
          >
            Upload a video
          </div>
        </AbsoluteFill>
      )}

      {overlayTexts.map((overlay, i) => (
        <Sequence
          key={`overlay-${String(i)}`}
          from={overlay.startFrame}
          durationInFrames={overlay.durationFrames}
          layout="none"
        >
          <AnimatedText overlay={overlay} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
