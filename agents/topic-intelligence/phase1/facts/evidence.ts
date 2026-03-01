import type { ScoredBodyFact } from "./scoreFacts.js";
import type { CoverageCluster } from "../coverage/cluster.js";
import { tokenizeForCoverage } from "../coverage/tokenize.js";

// ============================================================================
// Helpers
// ============================================================================

/** Tokenize text into words, keeping only tokens with length >= 2. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/** Check if a fact's tokens overlap with a source title. */
function hasTokenOverlap(factTokens: string[], titleLower: string): boolean {
  return factTokens.some((token) => titleLower.includes(token));
}

/**
 * Find the best-matching cluster for a fact based on token overlap.
 * Returns the cluster with the most overlapping centroid tokens.
 */
function findBestCluster(
  factTokens: string[],
  clusters: CoverageCluster[],
): CoverageCluster | undefined {
  let best: CoverageCluster | undefined;
  let bestOverlap = 0;

  for (const cluster of clusters) {
    const centroidSet = new Set(cluster.centroidTokens);
    let overlap = 0;
    for (const t of factTokens) {
      if (centroidSet.has(t)) overlap++;
    }
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = cluster;
    }
  }

  return bestOverlap > 0 ? best : undefined;
}

// ============================================================================
// Main
// ============================================================================

/**
 * Build evidence URLs for each scored body fact.
 *
 * Rules:
 * - Each fact always includes its own url as the first evidence
 * - If preferClusterUrls=true and clusters provided:
 *   find the best-matching cluster and add its source urls first
 * - Then fall back to title-token overlap matching from selectedSources
 * - Max evidenceUrls per fact (default 3), deduplicated
 */
export function buildEvidenceUrls(
  scoredFacts: ScoredBodyFact[],
  selectedSources: Array<{ url: string; title: string; publisher?: string }>,
  opts?: {
    preferClusterUrls?: boolean;
    clusters?: CoverageCluster[];
    maxEvidenceUrls?: number;
  },
): Array<{ text: string; evidenceUrls: string[] }> {
  const maxEvidence = opts?.maxEvidenceUrls ?? 3;
  const preferCluster = opts?.preferClusterUrls ?? true;
  const clusters = opts?.clusters;

  return scoredFacts.map((fact) => {
    const evidenceUrls: string[] = [fact.url];
    const seen = new Set<string>([fact.url]);

    // Tokenize fact text for matching
    const factTokens = tokenizeForCoverage(fact.text);

    // Priority 1: Cluster-based evidence
    if (preferCluster && clusters && clusters.length > 0) {
      const bestCluster = findBestCluster(factTokens, clusters);
      if (bestCluster) {
        for (const src of bestCluster.sources) {
          if (evidenceUrls.length >= maxEvidence) break;
          if (seen.has(src.url)) continue;
          evidenceUrls.push(src.url);
          seen.add(src.url);
        }
      }
    }

    // Priority 2: Title-token overlap (existing logic)
    if (evidenceUrls.length < maxEvidence) {
      const simpleFact = tokenize(fact.text);
      for (const source of selectedSources) {
        if (evidenceUrls.length >= maxEvidence) break;
        if (seen.has(source.url)) continue;

        const titleLower = source.title.toLowerCase();
        if (hasTokenOverlap(simpleFact, titleLower)) {
          evidenceUrls.push(source.url);
          seen.add(source.url);
        }
      }
    }

    return { text: fact.text, evidenceUrls };
  });
}
