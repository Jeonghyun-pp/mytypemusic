import { Composition } from "remotion";
import { ReelsComp, reelsSchema } from "./ReelsComp";
import {
  CarouselComp,
  carouselSchema,
  calculateCarouselDuration,
} from "./CarouselComp";

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
    </>
  );
};
