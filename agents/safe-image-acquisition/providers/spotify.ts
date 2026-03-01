import crypto from "node:crypto";
import axios from "axios";
import type { ImageProvider } from "../provider.js";
import type {
  ImageBrief,
  RawImageCandidate,
  LicenseProfile,
} from "../types.js";
import { ProviderError } from "../errors.js";
import { spotifyClient } from "../../shared/spotify-client.js";

export class SpotifyProvider implements ImageProvider {
  readonly name = "spotify";

  async search(brief: ImageBrief): Promise<RawImageCandidate[]> {
    // Build search query from keywords
    const query = brief.keywords.slice(0, 3).join(" ");

    let albums;
    try {
      albums = await spotifyClient.searchAlbums(query, "KR", 10);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(
        `Spotify search failed: ${message}`,
        { provider: "spotify", query },
      );
    }

    const candidates: RawImageCandidate[] = [];

    for (const album of albums) {
      // Prefer the largest image (usually 640x640)
      const image = album.images[0];
      if (!image) continue;

      const id = crypto
        .createHash("sha256")
        .update(album.id)
        .digest("hex")
        .slice(0, 16);

      candidates.push({
        id: `spotify-${id}`,
        provider: "spotify",
        previewUrl: image.url,
        sourceUrl: album.external_urls.spotify,
        author: album.artists.map((a) => a.name).join(", "),
        width: image.width,
        height: image.height,
      });
    }

    return candidates;
  }

  async getLicenseInfo(_candidate: RawImageCandidate): Promise<LicenseProfile> {
    // Fixed license profile for Spotify album art
    // Basis: 한국 저작권법 제28조 (보도/비평 목적 공정이용)
    // Album cover art is editorial use for music review/recommendation
    return {
      provider: "spotify",
      sourceUrl: _candidate.sourceUrl,
      licenseUrl: "https://developer.spotify.com/terms",
      licenseText:
        "Spotify album cover art used for editorial/review purposes " +
        "under 한국 저작권법 제28조 (fair use for reporting/criticism).",

      allowedUses: ["editorial"],
      allowedChannels: ["instagram", "web"],
      territory: "worldwide",

      derivatives: {
        allowed: true,
        allowedTransforms: ["resize", "crop", "composite"],
      },

      attribution: {
        required: true,
        textTemplate: `Album art via Spotify — ${_candidate.author ?? "Unknown Artist"}`,
      },

      modelRelease: "not_provided",
      propertyRelease: "not_provided",

      restrictions: {
        editorialOnly: true,
        noCommercial: true,
      },

      confidence: "high",
    };
  }

  async fetchAsset(
    candidate: RawImageCandidate,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    let imageBuffer: ArrayBuffer;
    let contentType: string;

    try {
      const response = await axios.get<ArrayBuffer>(candidate.previewUrl, {
        timeout: 15_000,
        responseType: "arraybuffer",
      });
      imageBuffer = response.data;
      const ct = response.headers["content-type"];
      contentType =
        typeof ct === "string" && ct.startsWith("image/")
          ? ct.split(";")[0]!
          : "image/jpeg";
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(
        `Spotify image download failed: ${message}`,
        { provider: "spotify", imageUrl: candidate.previewUrl },
      );
    }

    return {
      buffer: Buffer.from(imageBuffer),
      mimeType: contentType,
    };
  }
}
