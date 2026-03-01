import type { ImageBrief } from "./types.js";
import type { SourceTrack } from "./routing.js";

export type VisualMapContext = {
  category: "music" | "fashion" | "celebrity" | "issue";
  track: SourceTrack;
};

const STYLE_KEYWORDS: readonly string[] = [
  "high resolution",
  "cinematic lighting",
  "clean composition",
  "magazine editorial style",
  "no text",
  "no logos",
  "no watermark",
];

const CATEGORY_PRESETS: Record<string, readonly string[]> = {
  music: [
    "stage lights",
    "concert crowd silhouette",
    "festival atmosphere",
    "neon glow",
    "night scene",
  ],
  fashion: [
    "street style",
    "runway lighting",
    "fabric texture",
    "minimal backdrop",
    "editorial fashion",
  ],
  celebrity: [
    "red carpet lighting",
    "paparazzi flash",
    "silhouette portrait",
    "premiere backdrop",
    "luxury mood",
  ],
  issue: [
    "newspaper texture",
    "abstract background",
    "global map abstract",
    "data chart background",
    "dramatic mood",
  ],
};

const FILTERED_PATTERNS: readonly RegExp[] = [
  /^[A-Z][a-z]+\s+[A-Z]/,
  /@/,
  /official/i,
  /[™®]/,
  /^\d{4}$/,
];

function isFilteredToken(token: string): boolean {
  return FILTERED_PATTERNS.some((pattern) => pattern.test(token));
}

function dedupePreserveOrder(arr: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of arr) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export function mapBriefToVisualConcept(
  brief: ImageBrief,
  ctx: VisualMapContext
): ImageBrief {
  if (ctx.track === "PR" || ctx.track === "EDITORIAL") {
    return { ...brief, keywords: [...brief.keywords] };
  }

  const cleaned = brief.keywords
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0)
    .filter((k) => !isFilteredToken(k));

  const preset = CATEGORY_PRESETS[ctx.category] ?? [];

  const merged = dedupePreserveOrder([
    ...cleaned,
    ...preset,
    ...STYLE_KEYWORDS,
  ]);

  return {
    ...brief,
    keywords: merged,
  };
}
