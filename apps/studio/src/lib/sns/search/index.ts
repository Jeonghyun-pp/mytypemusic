import type { SearchAdapter } from "./types";
import { xSearchAdapter } from "./x";
import { instagramSearchAdapter } from "./instagram";

const adapters: Record<string, SearchAdapter> = {
  x: xSearchAdapter,
  instagram: instagramSearchAdapter,
};

export function getSearchAdapter(platform: string): SearchAdapter | null {
  return adapters[platform] ?? null;
}

export type { SearchAdapter, PostSearchResult } from "./types";
