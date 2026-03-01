import type { ImageBrief, RawImageCandidate, LicenseProfile } from "./types.js";

export interface ImageProvider {
  name: string;

  search(brief: ImageBrief): Promise<RawImageCandidate[]>;

  getLicenseInfo(candidate: RawImageCandidate): Promise<LicenseProfile>;

  fetchAsset(candidate: RawImageCandidate): Promise<{
    buffer: Buffer;
    mimeType: string;
  }>;
}
