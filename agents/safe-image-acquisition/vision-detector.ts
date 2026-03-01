export type VisionResult = {
  containsPerson: boolean;
  containsLogo: boolean;
  hasWatermark: boolean;
  celebrityLikelihood: boolean;
};

export interface VisionDetector {
  analyze(buffer: Buffer): Promise<VisionResult>;
}

export class DisabledVisionDetector implements VisionDetector {
  async analyze(_buffer: Buffer): Promise<VisionResult> {
    return {
      containsPerson: false,
      containsLogo: false,
      hasWatermark: false,
      celebrityLikelihood: false,
    };
  }
}
