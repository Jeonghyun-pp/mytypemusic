/**
 * Shared Font Registry — mood-aware, lazy-loading font system for Satori.
 *
 * Single source of truth for both Agent CLI and Studio API renderers.
 * Font files live in agents/cardnews-composition/fonts/.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

// ============================================================================
// Resolve fonts directory (works from any caller location)
// ============================================================================
// Use process.cwd() because __dirname is unreliable in bundled contexts
// (Turbopack/webpack rewrites it to the bundle output directory).
// Both `next dev` and Agent CLI run from the repo root.

const FONTS_DIR = path.resolve(process.cwd(), "agents", "cardnews-composition", "fonts");

// ============================================================================
// Types
// ============================================================================

export type FontMood =
  | "bold-display"
  | "clean-sans"
  | "editorial"
  | "playful"
  | "minimal"
  | "impact";

export interface FontSpec {
  name: string;
  file: string;
  weight: number;
  style: "normal";
}

export interface FontSet {
  primary: string;
  body: string;
  specs: FontSpec[];
  cssStack: string;
}

export interface SatoriFontEntry {
  name: string;
  data: ArrayBuffer;
  weight: number;
  style: "normal";
}

// ============================================================================
// Mood → FontSet mapping
// ============================================================================

const FONT_SETS: Record<FontMood, FontSet> = {
  "bold-display": {
    primary: "Pretendard",
    body: "Pretendard",
    specs: [
      { name: "Pretendard", file: "Pretendard-Regular.otf", weight: 400, style: "normal" },
      { name: "Pretendard", file: "Pretendard-Bold.otf", weight: 700, style: "normal" },
      { name: "Pretendard", file: "Pretendard-ExtraBold.otf", weight: 800, style: "normal" },
    ],
    cssStack: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
  },

  "clean-sans": {
    primary: "Noto Sans KR",
    body: "Noto Sans KR",
    specs: [
      { name: "Noto Sans KR", file: "NotoSansKR-Regular.otf", weight: 400, style: "normal" },
      { name: "Noto Sans KR", file: "NotoSansKR-Bold.otf", weight: 700, style: "normal" },
      { name: "Pretendard", file: "Pretendard-Regular.otf", weight: 400, style: "normal" },
    ],
    cssStack: '"Noto Sans KR", "Pretendard", sans-serif',
  },

  "editorial": {
    primary: "Noto Serif KR",
    body: "Pretendard",
    specs: [
      { name: "Noto Serif KR", file: "NotoSerifKR-Regular.otf", weight: 400, style: "normal" },
      { name: "Noto Serif KR", file: "NotoSerifKR-Bold.otf", weight: 700, style: "normal" },
      { name: "Pretendard", file: "Pretendard-Regular.otf", weight: 400, style: "normal" },
      { name: "Pretendard", file: "Pretendard-SemiBold.otf", weight: 600, style: "normal" },
    ],
    cssStack: '"Noto Serif KR", "Pretendard", serif',
  },

  "minimal": {
    primary: "Pretendard",
    body: "Pretendard",
    specs: [
      { name: "Pretendard", file: "Pretendard-Regular.otf", weight: 400, style: "normal" },
      { name: "Pretendard", file: "Pretendard-SemiBold.otf", weight: 600, style: "normal" },
    ],
    cssStack: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
  },

  "impact": {
    primary: "Black Han Sans",
    body: "Pretendard",
    specs: [
      { name: "Black Han Sans", file: "BlackHanSans-Regular.ttf", weight: 400, style: "normal" },
      { name: "Pretendard", file: "Pretendard-Regular.otf", weight: 400, style: "normal" },
      { name: "Pretendard", file: "Pretendard-Bold.otf", weight: 700, style: "normal" },
    ],
    cssStack: '"Black Han Sans", "Pretendard", sans-serif',
  },

  "playful": {
    primary: "Pretendard",
    body: "Pretendard",
    specs: [
      { name: "Pretendard", file: "Pretendard-Regular.otf", weight: 400, style: "normal" },
      { name: "Pretendard", file: "Pretendard-Bold.otf", weight: 700, style: "normal" },
      { name: "Pretendard", file: "Pretendard-ExtraBold.otf", weight: 800, style: "normal" },
    ],
    cssStack: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
  },
};

// ============================================================================
// CSS stacks shortcut (for consumers that only need the CSS string)
// ============================================================================

export const MOOD_CSS_STACKS: Record<FontMood, string> = Object.fromEntries(
  Object.entries(FONT_SETS).map(([mood, set]) => [mood, set.cssStack]),
) as Record<FontMood, string>;

// ============================================================================
// Per-file buffer cache (shared across moods)
// ============================================================================

const fileCache = new Map<string, ArrayBuffer>();

async function loadFontFile(fileName: string): Promise<ArrayBuffer> {
  const cached = fileCache.get(fileName);
  if (cached) return cached;

  const filePath = path.join(FONTS_DIR, fileName);
  const buf = await readFile(filePath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  fileCache.set(fileName, ab);
  return ab;
}

// Per-mood promise cache
const moodFontCache = new Map<FontMood, Promise<SatoriFontEntry[]>>();

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the FontSet definition for a given mood (synchronous lookup).
 */
export function getFontSet(mood: FontMood): FontSet {
  return FONT_SETS[mood];
}

/**
 * Get the default FontSet (bold-display).
 */
export function getDefaultFontSet(): FontSet {
  return FONT_SETS["bold-display"];
}

/**
 * Load all Satori font entries for a given mood.
 * Files are cached per-filename — shared fonts across moods load only once.
 * Per-mood results are also cached via promise.
 */
export function loadFontsForMood(mood: FontMood): Promise<SatoriFontEntry[]> {
  let cached = moodFontCache.get(mood);
  if (cached) return cached;

  cached = (async () => {
    const fontSet = FONT_SETS[mood];
    const seen = new Set<string>();
    const entries: SatoriFontEntry[] = [];

    for (const spec of fontSet.specs) {
      const key = `${spec.file}@${spec.weight}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const data = await loadFontFile(spec.file);
      entries.push({
        name: spec.name,
        data,
        weight: spec.weight,
        style: spec.style,
      });
    }

    return entries;
  })();

  moodFontCache.set(mood, cached);
  return cached;
}

/**
 * Check if a string is a valid FontMood.
 */
export function isValidFontMood(value: string): value is FontMood {
  return value in FONT_SETS;
}
