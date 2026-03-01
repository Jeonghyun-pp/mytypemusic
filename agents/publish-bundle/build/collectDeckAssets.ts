import fs from "node:fs/promises";
import path from "node:path";

// ============================================================================
// Types
// ============================================================================

export type SlideKind = "cover" | "fact" | "summary" | "cta" | "credits";

export type DeckAssets = {
  size: { width: number; height: number };
  format: "png";
  manifestPath?: string;
  slides: Array<{
    index: number;
    kind: SlideKind;
    filePath: string;
  }>;
};

// ============================================================================
// Natural-sort comparator for filenames (handles slide_01, slide_02, slide_10)
// ============================================================================

function naturalCompare(a: string, b: string): number {
  const aParts = a.split(/(\d+)/);
  const bParts = b.split(/(\d+)/);
  const len = Math.min(aParts.length, bParts.length);

  for (let i = 0; i < len; i++) {
    const ap = aParts[i] ?? "";
    const bp = bParts[i] ?? "";
    const aNum = Number(ap);
    const bNum = Number(bp);

    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      if (ap < bp) return -1;
      if (ap > bp) return 1;
    }
  }
  return aParts.length - bParts.length;
}

// ============================================================================
// PNG discovery helpers
// ============================================================================

/**
 * Try to extract PNG paths from a layout_manifest.json.
 * Supports both single-slide and multi-slide (deck) manifest formats.
 */
async function pngsFromManifest(
  manifestPath: string,
  topicOutputsDir: string,
): Promise<string[] | undefined> {
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, "utf-8");
  } catch {
    return undefined;
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }

  const pngs: string[] = [];

  // Multi-slide deck format: slides[].outputs.png
  const slides = manifest["slides"];
  if (Array.isArray(slides)) {
    for (const slide of slides) {
      if (slide && typeof slide === "object") {
        const s = slide as Record<string, unknown>;
        const outputs = s["outputs"] as Record<string, unknown> | undefined;
        if (outputs && typeof outputs["png"] === "string") {
          pngs.push(path.resolve(topicOutputsDir, outputs["png"]));
        }
      }
    }
  }

  // Single-slide format: outputs.png
  if (pngs.length === 0) {
    const outputs = manifest["outputs"] as Record<string, unknown> | undefined;
    if (outputs && typeof outputs["png"] === "string") {
      pngs.push(path.resolve(topicOutputsDir, outputs["png"]));
    }
  }

  return pngs.length > 0 ? pngs : undefined;
}

/**
 * Recursively find all *.png files under a directory.
 */
async function findPngsRecursive(dir: string): Promise<string[]> {
  const results: string[] = [];

  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return results;
  }

  for (const name of names) {
    const full = path.join(dir, name);
    let stat;
    try {
      stat = await fs.stat(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      const sub = await findPngsRecursive(full);
      results.push(...sub);
    } else if (stat.isFile() && name.endsWith(".png")) {
      results.push(full);
    }
  }

  return results;
}

// ============================================================================
// Main
// ============================================================================

export async function collectDeckAssets(params: {
  topicId: string;
  topicOutputsDir: string;
  contentPlanSlides: Array<{ kind: SlideKind }>;
  manifestPath?: string;
}): Promise<{ deck: DeckAssets; warnings: string[] }> {
  const { topicOutputsDir, contentPlanSlides, manifestPath } = params;
  const warnings: string[] = [];

  let pngPaths: string[] | undefined;

  // Strategy 1: try manifest
  if (manifestPath) {
    pngPaths = await pngsFromManifest(manifestPath, topicOutputsDir);
    if (pngPaths === undefined) {
      warnings.push(
        "layout_manifest.json exists but no PNG paths could be extracted — falling back to scan",
      );
    }
  }

  // Strategy 2: scan for *.png
  if (pngPaths === undefined) {
    const allPngs = await findPngsRecursive(topicOutputsDir);
    if (allPngs.length > 0) {
      pngPaths = allPngs.sort(naturalCompare);
    }
  }

  // Build slides array
  const slides: DeckAssets["slides"] = [];
  const expectedCount = contentPlanSlides.length;

  if (pngPaths === undefined || pngPaths.length === 0) {
    warnings.push(
      `No PNG files found under ${topicOutputsDir} — deck.slides will be empty`,
    );
  } else {
    // Verify each PNG exists, map kind from contentPlanSlides order
    const usableCount = Math.min(pngPaths.length, expectedCount);
    if (pngPaths.length < expectedCount) {
      warnings.push(
        `Found ${String(pngPaths.length)} PNGs but content-plan has ${String(expectedCount)} slides — only ${String(usableCount)} will be included`,
      );
    }

    for (let i = 0; i < usableCount; i++) {
      const pngPath = pngPaths[i]!;
      const kind = contentPlanSlides[i]!.kind;

      // Verify file actually exists
      try {
        await fs.stat(pngPath);
      } catch {
        warnings.push(`PNG not found at resolved path: ${pngPath} — skipping`);
        continue;
      }

      slides.push({
        index: i + 1,
        kind,
        filePath: pngPath,
      });
    }
  }

  return {
    deck: {
      size: { width: 1080, height: 1350 },
      format: "png",
      slides,
      manifestPath,
    },
    warnings,
  };
}
