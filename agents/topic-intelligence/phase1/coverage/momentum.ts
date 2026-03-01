import type { CoverageSource } from "./cluster.js";
import type { CoverageCluster } from "./cluster.js";

// ============================================================================
// Types
// ============================================================================

export type MomentumSignals = {
  totalSources: number;
  uniquePublishers: number;
  sourcesLast24h: number;
  sourcesLast72h: number;
  topClusterSize: number;
  score: number; // 0~100
};

// ============================================================================
// Main
// ============================================================================

/**
 * Compute simple momentum signals from coverage data.
 *
 * Score formula (0~100):
 *   base = 0
 *   + min(totalSources * 6, 30)
 *   + min(uniquePublishers * 10, 30)
 *   + min(sourcesLast24h * 8, 20)
 *   + min(topClusterSize * 4, 20)
 *   clamp 0..100
 */
export function computeMomentumSignals(params: {
  nowIso: string;
  sources: CoverageSource[];
  clusters: CoverageCluster[];
}): MomentumSignals {
  const { nowIso: nowStr, sources, clusters } = params;
  const now = new Date(nowStr).getTime();

  const MS_24H = 24 * 60 * 60 * 1000;
  const MS_72H = 72 * 60 * 60 * 1000;

  // Total sources
  const totalSources = sources.length;

  // Unique publishers
  const publisherSet = new Set<string>();
  for (const s of sources) {
    publisherSet.add(s.publisher ?? "unknown");
  }
  const uniquePublishers = publisherSet.size;

  // Recency counts (skip sources without publishedAt)
  let sourcesLast24h = 0;
  let sourcesLast72h = 0;
  for (const s of sources) {
    if (!s.publishedAt) continue;
    const pubTime = new Date(s.publishedAt).getTime();
    if (isNaN(pubTime)) continue;

    const age = now - pubTime;
    if (age <= MS_24H) {
      sourcesLast24h++;
      sourcesLast72h++;
    } else if (age <= MS_72H) {
      sourcesLast72h++;
    }
  }

  // Top cluster size
  const topClusterSize = clusters.length > 0 ? clusters[0]!.sources.length : 0;

  // Score
  let score = 0;
  score += Math.min(totalSources * 6, 30);
  score += Math.min(uniquePublishers * 10, 30);
  score += Math.min(sourcesLast24h * 8, 20);
  score += Math.min(topClusterSize * 4, 20);
  score = Math.max(0, Math.min(100, score));

  return {
    totalSources,
    uniquePublishers,
    sourcesLast24h,
    sourcesLast72h,
    topClusterSize,
    score,
  };
}
