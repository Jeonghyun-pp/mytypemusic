import type {
  ValidatedAssetSubset,
  ValidatedPostSubset,
} from "./validated-post.schema.js";

// ============================================================================
// Hero Asset Selection
// ============================================================================

/**
 * Pick the best hero asset from the validated images.
 *
 * Priority:
 *   1. role === "hero_unedited"
 *   2. role === "background_editable"
 *   3. null (no suitable asset)
 */
export function pickHeroAsset(
  images: ValidatedAssetSubset[]
): ValidatedAssetSubset | null {
  const hero = images.find((img) => img.role === "hero_unedited");
  if (hero) return hero;

  const bg = images.find((img) => img.role === "background_editable");
  if (bg) return bg;

  return null;
}

/**
 * Pick a hero asset by slide index for per-slide hero image support.
 *
 * Priority:
 *   1. images[slideIndex] if it exists and has role "hero_unedited"
 *   2. Last hero_unedited image (if slideIndex exceeds array length)
 *   3. Falls back to pickHeroAsset() (single-image backward compat)
 */
export function pickHeroAssetByIndex(
  images: ValidatedAssetSubset[],
  slideIndex: number,
): ValidatedAssetSubset | null {
  // Filter to hero_unedited images only
  const heroes = images.filter((img) => img.role === "hero_unedited");

  if (heroes.length === 0) {
    // No per-slide heroes — fall back to original single-pick logic
    return pickHeroAsset(images);
  }

  // Use slideIndex (0-based) to pick; clamp to last available
  const idx = Math.min(slideIndex, heroes.length - 1);
  return heroes[idx] ?? null;
}

// ============================================================================
// Credits Resolution
// ============================================================================

export interface ResolvedCredits {
  /** Single-line string for the slide footer (lines joined with " · ") */
  footerCredits: string;
  /** Individual credit lines (for debugging / manifest) */
  footerLines: string[];
  /** Caption appendix text (empty string if none) */
  captionAppendix: string;
}

/**
 * Resolve footer credits and caption appendix for a given asset.
 *
 * footerLines resolution priority:
 *   1. perImageCredits entry matching usedAsset.assetId
 *   2. Top 1–2 entries from footerCredits (empty strings excluded)
 *   3. usedAsset.recommendedAttribution
 *   4. usedAsset.sourceUrl (last-resort fallback, only when attribution is required)
 *
 * If attribution is required (post-level OR asset-level) and footerLines
 * is still empty after all fallbacks, throws immediately.
 */
export function resolveCredits(
  compliance: ValidatedPostSubset,
  usedAsset: ValidatedAssetSubset
): ResolvedCredits {
  // ---- captionAppendix ----
  const captionAppendix = compliance.attribution?.captionAppendix ?? "";

  // ---- footerLines (priority cascade) ----
  let footerLines: string[] = [];

  // 1) perImageCredits — exact assetId match
  const perImage = compliance.attribution?.perImageCredits;
  if (perImage) {
    const match = perImage.find((c) => c.assetId === usedAsset.assetId);
    if (match) {
      footerLines = [match.text];
    }
  }

  // 2) footerCredits — top 1–2 entries, empty strings excluded
  if (footerLines.length === 0) {
    const footer = compliance.attribution?.footerCredits;
    if (footer && footer.length > 0) {
      footerLines = footer
        .map((c) => c.text)
        .filter((t) => t.length > 0)
        .slice(0, 2);
    }
  }

  // 3) recommendedAttribution from the asset itself
  if (footerLines.length === 0 && usedAsset.recommendedAttribution) {
    footerLines = [usedAsset.recommendedAttribution];
  }

  // 4) Last-resort fallback: sourceUrl (only when attribution is required)
  if (
    footerLines.length === 0 &&
    usedAsset.license?.attribution?.required === true
  ) {
    footerLines = [usedAsset.sourceUrl];
  }

  // ---- Enforce: attribution required → footerLines must not be empty ----
  const mustHaveAttribution =
    compliance.attributionRequired === true ||
    usedAsset.license?.attribution?.required === true;

  if (mustHaveAttribution && footerLines.length === 0) {
    throw new Error(
      "footerCredits required: attribution is mandatory for this post/asset " +
        `but no credit text could be resolved (assetId=${usedAsset.assetId})`
    );
  }

  return {
    footerCredits: footerLines.join(" \u00B7 "),
    footerLines,
    captionAppendix,
  };
}
