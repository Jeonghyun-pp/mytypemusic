import { tokenizeForCoverage } from "./tokenize.js";

// ============================================================================
// Types
// ============================================================================

export type CoverageSource = {
  idx: number;
  title: string;
  url: string;
  publisher?: string;
  publishedAt?: string;
};

export type CoverageCluster = {
  clusterId: string; // "c0", "c1", ...
  label: string; // top 2-4 tokens joined
  sources: CoverageSource[];
  centroidTokens: string[];
};

export type ClusterOptions = {
  jaccardThreshold?: number; // default 0.55
  maxClusters?: number; // default 5
};

// ============================================================================
// Helpers
// ============================================================================

/** Jaccard similarity between two token arrays (treated as sets). */
function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);

  if (setA.size === 0 && setB.size === 0) return 1;

  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Build a label from the most frequent tokens across cluster sources.
 * Returns top 2-4 tokens by frequency.
 */
function buildLabel(
  sourcesTokens: string[][],
): { label: string; centroidTokens: string[] } {
  const freq = new Map<string, number>();

  for (const tokens of sourcesTokens) {
    for (const t of tokens) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }

  // Sort by frequency desc, then alphabetically for stability
  const sorted = [...freq.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const topTokens = sorted.slice(0, 4).map(([token]) => token);
  // Use at least 2 tokens for the label
  const labelTokens = topTokens.length >= 2 ? topTokens : topTokens;

  return {
    label: labelTokens.join(" "),
    centroidTokens: topTokens,
  };
}

// ============================================================================
// Main
// ============================================================================

/**
 * Cluster sources by title token similarity (greedy, deterministic).
 *
 * 1. Tokenize each source title
 * 2. Greedy clustering: pick unassigned source as seed, assign others with
 *    Jaccard >= threshold to the same cluster
 * 3. Sort clusters by size descending
 * 4. Limit to maxClusters
 */
export function clusterSourcesByTitle(
  sources: CoverageSource[],
  opts?: ClusterOptions,
): CoverageCluster[] {
  const threshold = opts?.jaccardThreshold ?? 0.55;
  const maxClusters = opts?.maxClusters ?? 5;

  // Pre-tokenize all sources
  const tokenized = sources.map((s) => ({
    source: s,
    tokens: tokenizeForCoverage(s.title),
  }));

  const assigned = new Set<number>(); // indices into tokenized[]
  const clusters: CoverageCluster[] = [];

  for (let i = 0; i < tokenized.length; i++) {
    if (assigned.has(i)) continue;

    // Start new cluster with this seed
    const seed = tokenized[i]!;
    assigned.add(i);

    const clusterSources: CoverageSource[] = [seed.source];
    const clusterTokens: string[][] = [seed.tokens];

    // Find similar unassigned sources
    for (let j = i + 1; j < tokenized.length; j++) {
      if (assigned.has(j)) continue;

      const candidate = tokenized[j]!;
      if (jaccard(seed.tokens, candidate.tokens) >= threshold) {
        assigned.add(j);
        clusterSources.push(candidate.source);
        clusterTokens.push(candidate.tokens);
      }
    }

    const { label, centroidTokens } = buildLabel(clusterTokens);

    clusters.push({
      clusterId: `c${String(clusters.length)}`,
      label,
      sources: clusterSources,
      centroidTokens,
    });
  }

  // Sort by cluster size descending
  clusters.sort((a, b) => b.sources.length - a.sources.length);

  // Re-assign clusterIds after sorting
  for (let i = 0; i < clusters.length; i++) {
    clusters[i]!.clusterId = `c${String(i)}`;
  }

  return clusters.slice(0, maxClusters);
}
