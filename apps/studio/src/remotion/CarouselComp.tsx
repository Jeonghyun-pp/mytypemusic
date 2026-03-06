import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { z } from "zod";

// ── Schema ───────────────────────────────────────────

const slideSchema = z.object({
  imageUrl: z.string(),
  durationFrames: z.number().default(90), // 3 sec at 30fps
});

const subtitleSchema = z.object({
  text: z.string(),
  startFrame: z.number(),
  durationFrames: z.number(),
});

export const carouselSchema = z.object({
  slides: z.array(slideSchema),
  transition: z.enum(["fade", "slide", "zoom", "blur"]).default("fade"),
  transitionDurationFrames: z.number().default(15),
  backgroundMusicUrl: z.string().optional(),
  backgroundMusicVolume: z.number().default(0.3),
  subtitles: z.array(subtitleSchema).default([]),
});

export type CarouselProps = z.infer<typeof carouselSchema>;

/** Calculate total duration from slides + transitions. */
export function calculateCarouselDuration(props: CarouselProps): number {
  const { slides, transitionDurationFrames } = props;
  if (slides.length === 0) return 30;
  let total = 0;
  for (const slide of slides) {
    total += slide.durationFrames;
  }
  // Transitions overlap
  total -= transitionDurationFrames * Math.max(0, slides.length - 1);
  return Math.max(total, 30);
}

// ── Transition renderers ─────────────────────────────

interface SlideTransitionProps {
  progress: number; // 0 → 1 (entering), or used for exit
  type: CarouselProps["transition"];
  children: React.ReactNode;
}

const SlideTransition: React.FC<SlideTransitionProps> = ({ progress, type, children }) => {
  let style: React.CSSProperties = {};

  switch (type) {
    case "fade":
      style = { opacity: progress };
      break;
    case "slide":
      style = { transform: `translateX(${(1 - progress) * 100}%)` };
      break;
    case "zoom":
      style = {
        opacity: progress,
        transform: `scale(${0.8 + 0.2 * progress})`,
      };
      break;
    case "blur":
      style = {
        opacity: progress,
        filter: `blur(${(1 - progress) * 20}px)`,
      };
      break;
  }

  return (
    <AbsoluteFill style={style}>
      {children}
    </AbsoluteFill>
  );
};

// ── Subtitle overlay ─────────────────────────────────

const SubtitleOverlay: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const scale = spring({ fps, frame, config: { damping: 14, stiffness: 200 } });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: "10%",
      }}
    >
      <div
        style={{
          fontSize: 48,
          color: "#fff",
          fontWeight: 700,
          fontFamily: "Pretendard, sans-serif",
          opacity,
          transform: `scale(${scale})`,
          textShadow: "2px 2px 12px rgba(0,0,0,0.7)",
          textAlign: "center",
          padding: "0 60px",
          lineHeight: 1.3,
          maxWidth: "90%",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// ── Main composition ─────────────────────────────────

export const CarouselComp: React.FC<CarouselProps> = ({
  slides,
  transition,
  transitionDurationFrames,
  backgroundMusicUrl,
  backgroundMusicVolume,
  subtitles,
}) => {
  const frame = useCurrentFrame();

  // Calculate the start frame for each slide
  const slideStarts: number[] = [];
  let offset = 0;
  for (let i = 0; i < slides.length; i++) {
    slideStarts.push(offset);
    offset += slides[i]!.durationFrames - transitionDurationFrames;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Slides with transitions */}
      {slides.map((slide, i) => {
        const start = slideStarts[i]!;
        const dur = slide.durationFrames;

        return (
          <Sequence
            key={`slide-${String(i)}`}
            from={start}
            durationInFrames={dur}
            layout="none"
          >
            <SlideRenderer
              imageUrl={slide.imageUrl}
              transition={transition}
              transitionDuration={transitionDurationFrames}
              totalDuration={dur}
              isFirst={i === 0}
              isLast={i === slides.length - 1}
            />
          </Sequence>
        );
      })}

      {/* Background music */}
      {backgroundMusicUrl && (
        <Audio src={backgroundMusicUrl} volume={backgroundMusicVolume} />
      )}

      {/* Subtitles */}
      {subtitles.map((sub, i) => (
        <Sequence
          key={`sub-${String(i)}`}
          from={sub.startFrame}
          durationInFrames={sub.durationFrames}
          layout="none"
        >
          <SubtitleOverlay text={sub.text} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// ── Per-slide renderer with enter/exit transitions ───

const SlideRenderer: React.FC<{
  imageUrl: string;
  transition: CarouselProps["transition"];
  transitionDuration: number;
  totalDuration: number;
  isFirst: boolean;
  isLast: boolean;
}> = ({ imageUrl, transition: transType, transitionDuration, totalDuration, isFirst, isLast }) => {
  const frame = useCurrentFrame();

  // Enter transition (skip for first slide)
  const enterProgress = isFirst
    ? 1
    : interpolate(frame, [0, transitionDuration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  return (
    <SlideTransition progress={enterProgress} type={transType}>
      <Img
        src={imageUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </SlideTransition>
  );
};
