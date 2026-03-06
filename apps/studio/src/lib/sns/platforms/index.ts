import type { SnsOAuthAdapter, SnsPlatform } from "../types";
import { threadsAdapter } from "./threads";
import { instagramAdapter } from "./instagram";
import { xAdapter } from "./x";
import { linkedinAdapter } from "./linkedin";
import { wordpressAdapter } from "./wordpress";
import { youtubeAdapter } from "./youtube";
import { tiktokAdapter } from "./tiktok";

const adapters: Partial<Record<SnsPlatform, SnsOAuthAdapter>> = {
  threads: threadsAdapter,
  instagram: instagramAdapter,
  x: xAdapter,
  linkedin: linkedinAdapter,
  wordpress: wordpressAdapter,
  youtube: youtubeAdapter,
  tiktok: tiktokAdapter,
};

export function getAdapter(platform: string): SnsOAuthAdapter {
  const adapter = adapters[platform as SnsPlatform];
  if (!adapter) {
    throw new Error(
      `OAuth adapter not implemented for platform: ${platform}. ` +
        `Available: ${Object.keys(adapters).join(", ")}`,
    );
  }
  return adapter;
}

export function listAvailablePlatforms(): SnsPlatform[] {
  return Object.keys(adapters) as SnsPlatform[];
}
