/**
 * Slideshow — animated image slideshow with text overlays.
 *
 * Use cases: album art galleries, artist photo collections, event highlights.
 * Extends existing CarouselComp with text overlays and more transitions.
 */
import {
  AbsoluteFill,
  Img,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { z } from "zod";
import { CLAMP, hexToRgba } from "./types";

// ── Schema ───────────────────────────────────────────

const slideSchema = z.object({
  imageUrl: z.string(),
  title: z.string().default(""),
  subtitle: z.string().default(""),
  durationFrames: z.number().default(90),
});

export const slideshowSchema = z.object({
  slides: z.array(slideSchema).min(1),
  transition: z.enum(["fade", "slide_left", "slide_up", "zoom", "ken_burns"]).default("fade"),
  transitionFrames: z.number().default(15),
  textPosition: z.enum(["bottom", "center", "top"]).default("bottom"),
  textColor: z.string().default("#FFFFFF"),
  overlayColor: z.string().default("#000000"),
  overlayOpacity: z.number().default(0.4),
  fontFamily: z.string().default("Pretendard, sans-serif"),
  showProgress: z.boolean().default(false),
});

export type SlideshowProps = z.infer<typeof slideshowSchema>;

export function calculateSlideshowDuration(props: SlideshowProps): number {
  const { slides, transitionFrames } = props;
  if (slides.length === 0) return 30;
  let total = slides.reduce((s, sl) => s + sl.durationFrames, 0);
  total -= transitionFrames * Math.max(0, slides.length - 1);
  return Math.max(total, 30);
}

// ── Slide renderer ───────────────────────────────────

function SlideItem({ imageUrl, title, subtitle, transition, transitionFrames, duration, isFirst, textPosition, textColor, overlayColor, overlayOpacity, fontFamily }: {
  imageUrl: string; title: string; subtitle: string;
  transition: SlideshowProps["transition"]; transitionFrames: number; duration: number;
  isFirst: boolean; textPosition: SlideshowProps["textPosition"];
  textColor: string; overlayColor: string; overlayOpacity: number; fontFamily: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = isFirst
    ? 1
    : interpolate(frame, [0, transitionFrames], [0, 1], CLAMP);

  // Ken Burns slow zoom
  const kenBurnsScale = transition === "ken_burns"
    ? interpolate(frame, [0, duration], [1, 1.15], CLAMP)
    : 1;

  let enterStyle: React.CSSProperties = {};
  switch (transition) {
    case "fade":
      enterStyle = { opacity: enterProgress };
      break;
    case "slide_left":
      enterStyle = { transform: `translateX(${(1 - enterProgress) * 100}%)` };
      break;
    case "slide_up":
      enterStyle = { transform: `translateY(${(1 - enterProgress) * 100}%)` };
      break;
    case "zoom":
      enterStyle = { opacity: enterProgress, transform: `scale(${0.8 + 0.2 * enterProgress})` };
      break;
    case "ken_burns":
      enterStyle = { opacity: enterProgress };
      break;
  }

  const textY = interpolate(frame, [transitionFrames, transitionFrames + 20], [30, 0], CLAMP);
  const textOpacity = interpolate(frame, [transitionFrames, transitionFrames + 20], [0, 1], CLAMP);

  const justify = textPosition === "top" ? "flex-start"
    : textPosition === "center" ? "center"
    : "flex-end";

  const padding = textPosition === "top" ? "100px 60px 60px"
    : textPosition === "center" ? "60px"
    : "60px 60px 120px";

  return (
    <AbsoluteFill style={enterStyle}>
      <Img
        src={imageUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${kenBurnsScale})`,
        }}
      />
      {/* Overlay */}
      <AbsoluteFill style={{ backgroundColor: hexToRgba(overlayColor, overlayOpacity) }} />
      {/* Text */}
      {(title || subtitle) && (
        <AbsoluteFill style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: justify,
          alignItems: "center",
          padding,
          fontFamily,
          gap: "12px",
        }}>
          {title && (
            <div style={{
              fontSize: 48,
              fontWeight: 700,
              color: textColor,
              textAlign: "center" as const,
              opacity: textOpacity,
              transform: `translateY(${textY}px)`,
              textShadow: "2px 2px 8px rgba(0,0,0,0.6)",
            }}>
              {title}
            </div>
          )}
          {subtitle && (
            <div style={{
              fontSize: 28,
              fontWeight: 400,
              color: textColor,
              textAlign: "center" as const,
              opacity: textOpacity * 0.9,
              transform: `translateY(${textY}px)`,
              textShadow: "1px 1px 6px rgba(0,0,0,0.6)",
            }}>
              {subtitle}
            </div>
          )}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

// ── Main composition ─────────────────────────────────

export const SlideshowComp: React.FC<SlideshowProps> = (props) => {
  const {
    slides, transition, transitionFrames, textPosition,
    textColor, overlayColor, overlayOpacity, fontFamily, showProgress,
  } = props;
  const frame = useCurrentFrame();

  // Calculate start frames
  const starts: number[] = [];
  let offset = 0;
  for (let i = 0; i < slides.length; i++) {
    starts.push(offset);
    offset += slides[i]!.durationFrames - transitionFrames;
  }

  const totalDur = calculateSlideshowDuration(props);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {slides.map((slide, i) => (
        <Sequence
          key={String(i)}
          from={starts[i]!}
          durationInFrames={slide.durationFrames}
          layout="none"
        >
          <SlideItem
            {...slide}
            transition={transition}
            transitionFrames={transitionFrames}
            duration={slide.durationFrames}
            isFirst={i === 0}
            textPosition={textPosition}
            textColor={textColor}
            overlayColor={overlayColor}
            overlayOpacity={overlayOpacity}
            fontFamily={fontFamily}
          />
        </Sequence>
      ))}

      {/* Progress bar */}
      {showProgress && (
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: `${(frame / totalDur) * 100}%`,
          height: 4,
          backgroundColor: "#6C5CE7",
        }} />
      )}
    </AbsoluteFill>
  );
};
