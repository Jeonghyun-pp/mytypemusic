// ============================================================================
// Template Variation Selectors
// ============================================================================

export type VariationId = "v1" | "v2" | "v3" | "v4";
export type CoverVariationId = "v1" | "v2";

const BODY_VARIANTS: readonly VariationId[] = ["v1", "v2", "v3"];
const COVER_VARIANTS: readonly CoverVariationId[] = ["v1", "v2"];

/**
 * Simple string hash (djb2-style).
 * Returns a non-negative integer.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Pick a body fact template variation.
 *
 * Rules:
 *   - If seed is provided: hash(seed + index) → map to 0..2
 *   - If no seed: index % 3
 */
export function pickBodyVariation(params: {
  seed?: string;
  index: number;
}): VariationId {
  if (params.seed) {
    const hash = simpleHash(`${params.seed}:${params.index}`);
    return BODY_VARIANTS[hash % 3]!;
  }
  return BODY_VARIANTS[params.index % 3]!;
}

/**
 * Pick a cover template variation.
 *
 * Rules:
 *   - If seed is provided: hash(seed + "cover") → map to 0..1
 *   - If no seed: default to "v1"
 */
export function pickCoverVariation(params: {
  seed?: string;
}): CoverVariationId {
  if (params.seed) {
    const hash = simpleHash(`${params.seed}:cover`);
    return COVER_VARIANTS[hash % 2]!;
  }
  return "v1";
}
