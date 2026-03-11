import { describe, it, expect, beforeEach } from "vitest";
import { buildBenchmarkReport } from "../benchmark";
import { saveQualityRecord, clearQualityRecords } from "../quality-store";
import { recordDesignStyle, clearPerformanceRecords, updateEngagement } from "../style-performance";
import type { DesignQualityRecord } from "../types";
import type { StylePerformanceRecord } from "../style-performance";

function makeQualityRecord(overrides?: Partial<DesignQualityRecord>): DesignQualityRecord {
  return {
    designId: `design_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    contentType: "trending",
    format: "card_news",
    platform: "instagram",
    scores: [
      { dimension: "VISUAL_HIERARCHY", score: 8, feedback: "good" },
      { dimension: "BRAND_CONSISTENCY", score: 7, feedback: "ok" },
      { dimension: "READABILITY", score: 9, feedback: "great" },
      { dimension: "AESTHETIC_QUALITY", score: 7, feedback: "ok" },
      { dimension: "PLATFORM_FIT", score: 8, feedback: "good" },
    ],
    averageScore: 7.8,
    verdict: "refine",
    iterationCount: 2,
    designPath: "template",
    generationTimeMs: 5000,
    ...overrides,
  };
}

function makePerfRecord(id: string, overrides?: Partial<StylePerformanceRecord>): StylePerformanceRecord {
  return {
    id,
    createdAt: Date.now(),
    contentType: "trending",
    format: "card_news",
    platform: "instagram",
    designPath: "template",
    hasImage: true,
    slideCount: 5,
    typographyMood: "sans_modern",
    layoutStyle: "bold",
    colorMood: "vibrant",
    ...overrides,
  };
}

describe("buildBenchmarkReport", () => {
  beforeEach(() => {
    clearQualityRecords();
    clearPerformanceRecords();
  });

  it("returns a valid report with zero data", () => {
    const report = buildBenchmarkReport("trending", "instagram");
    expect(report.totalSamples).toBe(0);
    expect(report.confidence).toBe("low");
    expect(report.historicalBaseline.averageScore).toBe(0);
    expect(report.topPerformingStyles).toHaveLength(0);
  });

  it("computes historical baseline from quality records", () => {
    for (let i = 0; i < 5; i++) {
      saveQualityRecord(makeQualityRecord({ averageScore: 7 + i * 0.2 }));
    }

    const report = buildBenchmarkReport("trending", "instagram");
    expect(report.historicalBaseline.averageScore).toBeGreaterThan(0);
    expect(report.historicalBaseline.passRate).toBeGreaterThanOrEqual(0);
    expect(report.historicalBaseline.byDimension).toHaveProperty("VISUAL_HIERARCHY");
  });

  it("includes top performing styles from engagement data", () => {
    // Create records with engagement data
    for (let i = 0; i < 5; i++) {
      const rec = makePerfRecord(`perf_${String(i)}`, { colorMood: "vibrant" });
      recordDesignStyle(rec);
      updateEngagement(`perf_${String(i)}`, { impressions: 1000, engagements: 100 + i * 20 });
    }
    for (let i = 0; i < 5; i++) {
      const rec = makePerfRecord(`perf_muted_${String(i)}`, { colorMood: "muted" });
      recordDesignStyle(rec);
      updateEngagement(`perf_muted_${String(i)}`, { impressions: 1000, engagements: 30 });
    }

    const report = buildBenchmarkReport("trending", "instagram");
    // vibrant should appear in top performing styles (higher engagement)
    const vibrantStyle = report.topPerformingStyles.find(
      (s) => s.attribute === "colorMood" && s.value === "vibrant",
    );
    expect(vibrantStyle).toBeDefined();
    expect(vibrantStyle!.comparedToAvg).toBeGreaterThan(0);
  });

  it("sets confidence based on total samples", () => {
    // Low confidence with < 15 samples
    for (let i = 0; i < 3; i++) {
      saveQualityRecord(makeQualityRecord());
    }
    expect(buildBenchmarkReport("trending", "instagram").confidence).toBe("low");
  });

  it("includes platform norms", () => {
    for (let i = 0; i < 5; i++) {
      saveQualityRecord(makeQualityRecord({ platform: "instagram", averageScore: 8.5 }));
    }

    const report = buildBenchmarkReport("trending", "instagram");
    expect(report.platformNorms.platform).toBe("instagram");
    expect(report.platformNorms.avgScore).toBeGreaterThan(0);
  });
});
