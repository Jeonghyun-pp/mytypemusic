import axios from "axios";
import type { ImageProvider } from "../provider.js";
import type {
  ImageBrief,
  RawImageCandidate,
  LicenseProfile,
} from "../types.js";
import { ProviderError } from "../errors.js";

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  src: {
    original: string;
    medium: string;
  };
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
}

interface PexelsPhotoResponse {
  src: {
    original: string;
  };
}

function getApiKey(): string {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    throw new ProviderError(
      "PEXELS_API_KEY environment variable is not set",
      { provider: "pexels" }
    );
  }
  return key;
}

export class PexelsProvider implements ImageProvider {
  readonly name = "pexels";

  async search(brief: ImageBrief): Promise<RawImageCandidate[]> {
    const apiKey = getApiKey();
    const query = brief.keywords.join(" ");

    let data: PexelsSearchResponse;
    try {
      const response = await axios.get<PexelsSearchResponse>(
        "https://api.pexels.com/v1/search",
        {
          params: {
            query,
            per_page: 10,
            orientation: "landscape",
          },
          headers: {
            Authorization: apiKey,
          },
        }
      );
      data = response.data;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error during search";
      throw new ProviderError(`Pexels search failed: ${message}`, {
        provider: "pexels",
        query,
      });
    }

    return data.photos.map(
      (photo): RawImageCandidate => ({
        id: String(photo.id),
        provider: "pexels",
        previewUrl: photo.src.medium,
        sourceUrl: photo.url,
        author: photo.photographer,
        width: photo.width,
        height: photo.height,
      })
    );
  }

  async getLicenseInfo(candidate: RawImageCandidate): Promise<LicenseProfile> {
    return {
      provider: "pexels",
      sourceUrl: candidate.sourceUrl,
      licenseUrl: "https://www.pexels.com/license/",

      allowedUses: ["commercial", "editorial"],
      allowedChannels: "any",
      territory: "worldwide",

      derivatives: {
        allowed: true,
        allowedTransforms: "any",
      },

      attribution: {
        required: false,
        textTemplate: `Photo by ${candidate.author ?? "Unknown"} from Pexels`,
      },

      modelRelease: "unknown",
      propertyRelease: "unknown",

      restrictions: {
        editorialOnly: false,
      },

      confidence: "high",
    };
  }

  async fetchAsset(
    candidate: RawImageCandidate
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const apiKey = getApiKey();

    let photoData: PexelsPhotoResponse;
    try {
      const photoResponse = await axios.get<PexelsPhotoResponse>(
        `https://api.pexels.com/v1/photos/${candidate.id}`,
        {
          headers: {
            Authorization: apiKey,
          },
        }
      );
      photoData = photoResponse.data;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error fetching photo details";
      throw new ProviderError(
        `Pexels photo detail fetch failed: ${message}`,
        { provider: "pexels", photoId: candidate.id }
      );
    }

    let imageBuffer: ArrayBuffer;
    try {
      const imageResponse = await axios.get<ArrayBuffer>(
        photoData.src.original,
        { responseType: "arraybuffer" }
      );
      imageBuffer = imageResponse.data;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error downloading image";
      throw new ProviderError(
        `Pexels image download failed: ${message}`,
        { provider: "pexels", photoId: candidate.id }
      );
    }

    return {
      buffer: Buffer.from(imageBuffer),
      mimeType: "image/jpeg",
    };
  }
}
