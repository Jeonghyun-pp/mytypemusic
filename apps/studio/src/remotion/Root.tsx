import { Composition } from "remotion";
import { ReelsComp, reelsSchema } from "./ReelsComp";
import {
  CarouselComp,
  carouselSchema,
  calculateCarouselDuration,
} from "./CarouselComp";
import {
  TextRevealComp,
  textRevealSchema,
  calculateTextRevealDuration,
  ChartAnimationComp,
  chartAnimationSchema,
  calculateChartDuration,
  DataCounterComp,
  dataCounterSchema,
  calculateDataCounterDuration,
  SlideshowComp,
  slideshowSchema,
  calculateSlideshowDuration,
  SplitScreenComp,
  splitScreenSchema,
  calculateSplitScreenDuration,
  KineticTypographyComp,
  kineticTypographySchema,
  calculateKineticDuration,
  ParticleEffectComp,
  particleEffectSchema,
  calculateParticleDuration,
} from "./skills";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Reels"
        component={ReelsComp}
        schema={reelsSchema}
        durationInFrames={FPS * 10}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          videoUrl: "",
          overlayTexts: [],
          trimStartFrame: 0,
          trimEndFrame: FPS * 10,
        }}
      />
      <Composition
        id="Carousel"
        component={CarouselComp}
        schema={carouselSchema}
        calculateMetadata={({ props }) => ({
          durationInFrames: calculateCarouselDuration(props),
        })}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          slides: [],
          transition: "fade" as const,
          transitionDurationFrames: 15,
          backgroundMusicVolume: 0.3,
          subtitles: [],
        }}
      />

      {/* Motion Skills */}
      <Composition
        id="TextReveal"
        component={TextRevealComp}
        schema={textRevealSchema}
        calculateMetadata={({ props }) => ({
          durationInFrames: calculateTextRevealDuration(props),
        })}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{
          lines: [{ text: "Hello World", fontSize: 64, fontWeight: 700, color: "#FFFFFF", delayFrames: 0 }],
          revealStyle: "fade_up" as const,
          backgroundColor: "#1A1A2E",
          fontFamily: "Pretendard, sans-serif",
          lineSpacing: 20,
          staggerFrames: 10,
          holdFrames: 60,
        }}
      />
      <Composition
        id="ChartAnimation"
        component={ChartAnimationComp}
        schema={chartAnimationSchema}
        calculateMetadata={({ props }) => ({
          durationInFrames: calculateChartDuration(props),
        })}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{
          chartType: "bar" as const,
          title: "",
          data: [{ label: "A", value: 100 }],
          colors: ["#6C5CE7", "#00CEC9", "#FD79A8", "#FDCB6E", "#E17055"],
          backgroundColor: "#1A1A2E",
          textColor: "#FFFFFF",
          fontFamily: "Pretendard, sans-serif",
          animationFrames: 45,
          holdFrames: 60,
          showValues: true,
          unit: "",
        }}
      />
      <Composition
        id="DataCounter"
        component={DataCounterComp}
        schema={dataCounterSchema}
        calculateMetadata={({ props }) => ({
          durationInFrames: calculateDataCounterDuration(props),
        })}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{
          counters: [{ label: "Count", startValue: 0, endValue: 100, prefix: "", suffix: "", decimals: 0 }],
          title: "",
          layout: "row" as const,
          backgroundColor: "#1A1A2E",
          textColor: "#FFFFFF",
          accentColor: "#6C5CE7",
          fontFamily: "Pretendard, sans-serif",
          countFrames: 50,
          staggerFrames: 8,
          holdFrames: 60,
        }}
      />
      <Composition
        id="Slideshow"
        component={SlideshowComp}
        schema={slideshowSchema}
        calculateMetadata={({ props }) => ({
          durationInFrames: calculateSlideshowDuration(props),
        })}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{
          slides: [],
          transition: "fade" as const,
          transitionFrames: 15,
          textPosition: "bottom" as const,
          textColor: "#FFFFFF",
          overlayColor: "#000000",
          overlayOpacity: 0.4,
          fontFamily: "Pretendard, sans-serif",
          showProgress: false,
        }}
      />
      <Composition
        id="SplitScreen"
        component={SplitScreenComp}
        schema={splitScreenSchema}
        calculateMetadata={({ props }) => ({
          durationInFrames: calculateSplitScreenDuration(props),
        })}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{
          left: { backgroundColor: "#1A1A2E", title: "", subtitle: "", body: "", textColor: "#FFFFFF", accentColor: "#6C5CE7" },
          right: { backgroundColor: "#2A1A3E", title: "", subtitle: "", body: "", textColor: "#FFFFFF", accentColor: "#6C5CE7" },
          direction: "horizontal" as const,
          splitRatio: 0.5,
          dividerColor: "#6C5CE7",
          dividerWidth: 4,
          animateIn: "slide" as const,
          fontFamily: "Pretendard, sans-serif",
          holdFrames: 120,
        }}
      />
      <Composition
        id="KineticTypography"
        component={KineticTypographyComp}
        schema={kineticTypographySchema}
        calculateMetadata={({ props }) => ({
          durationInFrames: calculateKineticDuration(props),
        })}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{
          words: [{ text: "Hello", emphasis: false }],
          style: "cascade" as const,
          fontSize: 72,
          fontFamily: "Pretendard, sans-serif",
          backgroundColor: "#0A0A1A",
          textColor: "#FFFFFF",
          emphasisColor: "#6C5CE7",
          framesPerWord: 12,
          holdFrames: 60,
        }}
      />
      <Composition
        id="ParticleEffect"
        component={ParticleEffectComp}
        schema={particleEffectSchema}
        calculateMetadata={({ props }) => ({
          durationInFrames: calculateParticleDuration(props),
        })}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{
          particleCount: 40,
          particleType: "circle" as const,
          colors: ["#6C5CE7", "#00CEC9", "#FD79A8", "#FDCB6E", "#E17055"],
          backgroundColor: "#0A0A1A",
          direction: "up" as const,
          speed: 1,
          minSize: 4,
          maxSize: 16,
          title: "",
          subtitle: "",
          textColor: "#FFFFFF",
          fontFamily: "Pretendard, sans-serif",
          holdFrames: 150,
          seed: 42,
        }}
      />
    </>
  );
};
