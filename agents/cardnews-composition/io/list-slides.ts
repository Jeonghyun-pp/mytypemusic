import fs from "node:fs";
import path from "node:path";

const SLIDE_HTML_RE = /^slide_\d\d\.html$/;
const SLIDE_INDEX_RE = /^slide_(\d\d)\.html$/;

/**
 * List slide HTML files in outDir, sorted by filename.
 * Matches pattern: slide_XX.html (two-digit zero-padded).
 * Returns absolute paths.
 */
export function listSlideHtml(outDir: string): string[] {
  const absDir = path.resolve(outDir);

  let entries: string[];
  try {
    entries = fs.readdirSync(absDir);
  } catch {
    return [];
  }

  return entries
    .filter((f) => SLIDE_HTML_RE.test(f))
    .sort()
    .map((f) => path.join(absDir, f));
}

export interface SlidePair {
  index: number;
  htmlPath: string;
  pngPath: string;
}

/**
 * List slide HTML/PNG pairs in outDir, sorted by index.
 * For each slide_XX.html, expects a matching slide_XX.png.
 * Throws if any PNG is missing.
 */
export function listSlidePairs(outDir: string): SlidePair[] {
  const absDir = path.resolve(outDir);

  let entries: string[];
  try {
    entries = fs.readdirSync(absDir);
  } catch {
    return [];
  }

  const htmlFiles = entries.filter((f) => SLIDE_HTML_RE.test(f)).sort();
  const pairs: SlidePair[] = [];

  for (const htmlFile of htmlFiles) {
    const m = SLIDE_INDEX_RE.exec(htmlFile);
    if (!m || !m[1]) continue;

    const idx = parseInt(m[1], 10);
    const pngFile = htmlFile.replace(/\.html$/, ".png");

    if (!entries.includes(pngFile)) {
      throw new Error(
        `missing ${pngFile} (run --mode deck-png)`
      );
    }

    pairs.push({
      index: idx,
      htmlPath: path.join(absDir, htmlFile),
      pngPath: path.join(absDir, pngFile),
    });
  }

  return pairs;
}
