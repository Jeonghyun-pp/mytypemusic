/**
 * Benchmark Report Builder — aggregates historical quality + style performance
 * data into a BenchmarkReport for the Design Critic.
 *
 * Combines:
 *   1. Quality Store: historical scores by dimension, pass rates
 *   2. Style Performance: engagement-correlated style attributes
 *   3. Platform norms: what works best per platform
 */

import type {
  BenchmarkReport,
  DesignContentType,
  DesignPlatform,
} from "./types";
import { getQualityStats, getRecentRecords } from "./quality-store";
import {
  getStyleInsights,
  getTopTemplates,
  getPerformanceSummary,
} from "./style-performance";

/**
 * Build a BenchmarkReport for a given content type + platform.
 *
 * This aggregates all available historical data to give the Design Critic
 * context about past performance baselines and what style choices
 * have worked well.
 */
export function buildBenchmarkReport(
  contentType: DesignContentType,
  platform: DesignPlatform,
): BenchmarkReport {
  // 1. Historical baseline from quality-store
  const overallStats = getQualityStats();
  const filteredStats = getQualityStats({ contentType, platform });
  const effectiveStats = filteredStats.totalDesigns >= 3 ? filteredStats : overallStats;

  // Compute per-dimension averages from recent records
  const recentRecords = getRecentRecords(100);
  const dimensionTotals = new Map<string, { sum: number; count: number }>();
  for (const record of recentRecords) {
    for (const score of record.scores) {
      const entry = dimensionTotals.get(score.dimension) ?? { sum: 0, count: 0 };
      entry.sum += score.score;
      entry.count++;
      dimensionTotals.set(score.dimension, entry);
    }
  }
  const byDimension: Record<string, number> = {};
  for (const [dim, { sum, count }] of dimensionTotals) {
    byDimension[dim] = Math.round((sum / count) * 100) / 100;
  }

  // 2. Top performing styles from style-performance
  const styleInsights = getStyleInsights({ contentType, platform });
  const fallbackInsights = styleInsights.length >= 3
    ? styleInsights
    : getStyleInsights({ contentType });

  const topPerformingStyles = fallbackInsights
    .filter((i) => i.sampleSize >= 2 && i.comparedToAvg > 0)
    .slice(0, 8)
    .map((i) => ({
      attribute: i.attribute,
      value: i.value,
      engagementRate: i.avgEngagementRate,
      comparedToAvg: i.comparedToAvg,
      sampleSize: i.sampleSize,
    }));

  // 3. Platform norms
  const platformStats = getQualityStats({ platform });
  const topTemplates = getTopTemplates(3, { platform })
    .map((t) => t.templateId);

  // Find best colorMood and layoutStyle for this platform
  const platformInsights = getStyleInsights({ platform });
  const bestColorMood = platformInsights
    .find((i) => i.attribute === "colorMood" && i.sampleSize >= 2)
    ?.value;
  const bestLayoutStyle = platformInsights
    .find((i) => i.attribute === "layoutStyle" && i.sampleSize >= 2)
    ?.value;

  // 4. Confidence
  const perfSummary = getPerformanceSummary();
  const totalSamples = effectiveStats.totalDesigns + perfSummary.withEngagement;
  const confidence: BenchmarkReport["confidence"] =
    totalSamples >= 50 ? "high" : totalSamples >= 15 ? "medium" : "low";

  return {
    historicalBaseline: {
      averageScore: effectiveStats.averageScore,
      passRate: effectiveStats.passRate,
      byDimension,
    },
    topPerformingStyles,
    platformNorms: {
      platform,
      avgScore: platformStats.averageScore,
      topTemplates,
      bestColorMood,
      bestLayoutStyle,
    },
    totalSamples,
    confidence,
  };
}
