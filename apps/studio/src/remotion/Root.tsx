import { Composition } from "remotion";
import { ReelsComp, reelsSchema } from "./ReelsComp";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
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
  );
};
