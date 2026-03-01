"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import { ReelsComp, reelsSchema, type ReelsProps } from "@/remotion/ReelsComp";

interface PlayerPreviewProps {
  inputProps: ReelsProps;
  durationInFrames: number;
}

export interface PlayerPreviewHandle {
  getCurrentFrame: () => number;
}

const PlayerPreview = forwardRef<PlayerPreviewHandle, PlayerPreviewProps>(
  function PlayerPreview({ inputProps, durationInFrames }, ref) {
    const playerRef = useRef<PlayerRef>(null);

    const getCurrentFrame = useCallback(() => {
      const frame = playerRef.current?.getCurrentFrame();
      return frame ?? 0;
    }, []);

    useImperativeHandle(ref, () => ({ getCurrentFrame }), [getCurrentFrame]);

    return (
      <div style={s.wrapper}>
        <Player
          ref={playerRef}
          component={ReelsComp}
          schema={reelsSchema}
          inputProps={inputProps}
          durationInFrames={Math.max(1, durationInFrames)}
          compositionWidth={1080}
          compositionHeight={1920}
          fps={30}
          controls
          loop
          style={{ width: "100%", height: "100%" }}
          autoPlay={false}
        />
      </div>
    );
  },
);

export default PlayerPreview;

const s = {
  wrapper: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#111",
    borderRadius: "8px",
    overflow: "hidden",
  } as const,
};
