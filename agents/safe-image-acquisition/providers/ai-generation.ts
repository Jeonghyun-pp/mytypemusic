import crypto from "node:crypto";
import axios from "axios";
import type { ImageProvider } from "../provider.js";
import type {
  ImageBrief,
  RawImageCandidate,
  LicenseProfile,
} from "../types.js";
import { ProviderError } from "../errors.js";

interface OpenAIImageResponse {
  data: {
    b64_json: string;
  }[];
}

const SAFETY_SUFFIX =
  "no logos, no brand names, no copyrighted characters, no watermarks, no real celebrity likeness";

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new ProviderError(
      "OPENAI_API_KEY environment variable is not set",
      { provider: "ai-generation" }
    );
  }
  return key;
}

function buildPrompt(brief: ImageBrief): string {
  return `${brief.topic}, ${brief.keywords.join(", ")}, cinematic lighting, high resolution, ${SAFETY_SUFFIX}`;
}

export class AIGenerationProvider implements ImageProvider {
  readonly name = "ai-generation";

  private lastBrief: ImageBrief | undefined;

  async search(brief: ImageBrief): Promise<RawImageCandidate[]> {
    getApiKey();
    this.lastBrief = brief;

    return [
      {
        id: crypto.randomUUID(),
        provider: "ai-generation",
        previewUrl: "",
        sourceUrl: "ai-generated",
        author: "AI",
        width: 1024,
        height: 1024,
      },
    ];
  }

  async getLicenseInfo(candidate: RawImageCandidate): Promise<LicenseProfile> {
    return {
      provider: "ai-generation",
      sourceUrl: candidate.sourceUrl,
      licenseText:
        "AI-generated image via OpenAI gpt-image-1. Full commercial and editorial rights per OpenAI usage policy.",

      allowedUses: ["commercial", "editorial"],
      allowedChannels: "any",
      territory: "worldwide",

      derivatives: {
        allowed: true,
        allowedTransforms: "any",
      },

      attribution: {
        required: false,
      },

      modelRelease: "not_provided",
      propertyRelease: "not_provided",

      restrictions: {
        editorialOnly: false,
      },

      confidence: "high",
    };
  }

  async fetchAsset(
    _candidate: RawImageCandidate
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const apiKey = getApiKey();

    if (!this.lastBrief) {
      throw new ProviderError(
        "No brief available. Call search() before fetchAsset().",
        { provider: "ai-generation" }
      );
    }

    const prompt = buildPrompt(this.lastBrief);

    let responseData: OpenAIImageResponse;
    try {
      const response = await axios.post<OpenAIImageResponse>(
        "https://api.openai.com/v1/images/generations",
        {
          model: "gpt-image-1",
          prompt,
          size: "1024x1024",
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      responseData = response.data;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error during image generation";
      throw new ProviderError(
        `AI image generation failed: ${message}`,
        { provider: "ai-generation" }
      );
    }

    const firstImage = responseData.data[0];
    if (!firstImage?.b64_json) {
      throw new ProviderError(
        "AI image generation returned no image data",
        { provider: "ai-generation" }
      );
    }

    return {
      buffer: Buffer.from(firstImage.b64_json, "base64"),
      mimeType: "image/png",
    };
  }
}
