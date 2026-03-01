import axios from "axios";
import type { ImageProvider } from "../provider.js";
import type {
  ImageBrief,
  RawImageCandidate,
  LicenseProfile,
} from "../types.js";
import { ProviderError } from "../errors.js";

interface UnsplashSearchResult {
  id: string;
  width: number;
  height: number;
  urls: {
    small: string;
    full: string;
  };
  links: {
    html: string;
  };
  user: {
    name: string;
  };
}

interface UnsplashSearchResponse {
  results: UnsplashSearchResult[];
}

interface UnsplashPhotoResponse {
  urls: {
    full: string;
  };
}

function getAccessKey(): string {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    throw new ProviderError("UNSPLASH_ACCESS_KEY environment variable is not set", {
      provider: "unsplash",
    });
  }
  return key;
}

export class UnsplashProvider implements ImageProvider {
  readonly name = "unsplash";

  async search(brief: ImageBrief): Promise<RawImageCandidate[]> {
    const accessKey = getAccessKey();
    const query = brief.keywords.join(" ");

    let data: UnsplashSearchResponse;
    try {
      const response = await axios.get<UnsplashSearchResponse>(
        "https://api.unsplash.com/search/photos",
        {
          params: {
            query,
            per_page: 10,
            orientation: "landscape",
          },
          headers: {
            Authorization: `Client-ID ${accessKey}`,
          },
        }
      );
      data = response.data;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error during search";
      throw new ProviderError(`Unsplash search failed: ${message}`, {
        provider: "unsplash",
        query,
      });
    }

    return data.results.map(
      (item): RawImageCandidate => ({
        id: item.id,
        provider: "unsplash",
        previewUrl: item.urls.small,
        sourceUrl: item.links.html,
        author: item.user.name,
        width: item.width,
        height: item.height,
      })
    );
  }

  async getLicenseInfo(candidate: RawImageCandidate): Promise<LicenseProfile> {
    return {
      provider: "unsplash",
      sourceUrl: candidate.sourceUrl,
      licenseUrl: "https://unsplash.com/license",

      allowedUses: ["commercial", "editorial"],
      allowedChannels: "any",
      territory: "worldwide",

      derivatives: {
        allowed: true,
        allowedTransforms: "any",
      },

      attribution: {
        required: true,
        textTemplate: `Photo by ${candidate.author ?? "Unknown"} on Unsplash`,
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
    const accessKey = getAccessKey();

    let photoData: UnsplashPhotoResponse;
    try {
      const photoResponse = await axios.get<UnsplashPhotoResponse>(
        `https://api.unsplash.com/photos/${candidate.id}`,
        {
          headers: {
            Authorization: `Client-ID ${accessKey}`,
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
        `Unsplash photo detail fetch failed: ${message}`,
        { provider: "unsplash", photoId: candidate.id }
      );
    }

    let imageBuffer: ArrayBuffer;
    try {
      const imageResponse = await axios.get<ArrayBuffer>(photoData.urls.full, {
        responseType: "arraybuffer",
      });
      imageBuffer = imageResponse.data;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error downloading image";
      throw new ProviderError(
        `Unsplash image download failed: ${message}`,
        { provider: "unsplash", photoId: candidate.id }
      );
    }

    return {
      buffer: Buffer.from(imageBuffer),
      mimeType: "image/jpeg",
    };
  }
}
