import type { InsightsAdapter } from "./types";
import { threadsInsightsAdapter } from "./threads";
import { instagramInsightsAdapter } from "./instagram";
import { xInsightsAdapter } from "./x";

export type { PostInsights, AccountInsights, InsightsAdapter } from "./types";

const adapters: Record<string, InsightsAdapter> = {
  threads: threadsInsightsAdapter,
  instagram: instagramInsightsAdapter,
  x: xInsightsAdapter,
};

export function getInsightsAdapter(platform: string): InsightsAdapter | null {
  return adapters[platform] ?? null;
}
