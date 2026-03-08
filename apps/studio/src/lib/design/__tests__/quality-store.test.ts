/**
 * Quality Store — Unit Test (no LLM required).
 */
import {
  saveQualityRecord,
  getQualityRecord,
  getQualityStats,
  getRecentRecords,
  getQualityTrends,
  clearQualityRecords,
} from "../quality-store";
import type { DesignQualityRecord } from "../types";

let passed = 0;
let failed = 0;

function check(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assert(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL  ${name}: ${(e as Error).message}`);
  }
}

function makeRecord(overrides: Partial<DesignQualityRecord> = {}): DesignQualityRecord {
  return {
    designId: `design_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    contentType: "album_review",
    format: "card_news",
    platform: "instagram",
    scores: [
      { dimension: "VISUAL_HIERARCHY", score: 8, feedback: "Good" },
      { dimension: "BRAND_CONSISTENCY", score: 7, feedback: "OK" },
      { dimension: "READABILITY", score: 9, feedback: "Great" },
      { dimension: "AESTHETIC_QUALITY", score: 8, feedback: "Nice" },
      { dimension: "PLATFORM_FIT", score: 7, feedback: "OK" },
    ],
    averageScore: 7.8,
    verdict: "refine",
    iterationCount: 2,
    designPath: "template",
    generationTimeMs: 5000,
    ...overrides,
  };
}

console.log(`\nQuality Store Unit Tests\n`);

clearQualityRecords();

// Test 1
assert("save + getByDesignId", () => {
  const r = makeRecord({ designId: "design_1709000000000_abc" });
  saveQualityRecord(r);
  const got = getQualityRecord("design_1709000000000_abc");
  check(got !== undefined, "should find record");
  check(got!.averageScore === 7.8, "score mismatch");
});

// Test 2
assert("aggregate stats with 2 records", () => {
  saveQualityRecord(makeRecord({
    designId: "design_1709000001000_def",
    contentType: "trending",
    format: "sns_image",
    platform: "twitter",
    averageScore: 8.8,
    verdict: "pass",
    iterationCount: 1,
    designPath: "generated",
    generationTimeMs: 3000,
  }));

  const stats = getQualityStats();
  check(stats.totalDesigns === 2, `expected 2 designs, got ${stats.totalDesigns}`);
  check(stats.passRate === 0.5, `pass rate should be 0.5, got ${stats.passRate}`);
  check(stats.byVerdict.pass === 1, "1 pass");
  check(stats.byVerdict.refine === 1, "1 refine");
  check(stats.byDesignPath["template"]!.count === 1, "1 template");
  check(stats.byDesignPath["generated"]!.count === 1, "1 generated");
});

// Test 3
assert("filter by contentType", () => {
  const stats = getQualityStats({ contentType: "album_review" });
  check(stats.totalDesigns === 1, "1 album_review");
  check(stats.averageScore === 7.8, "album_review avg 7.8");
});

// Test 4
assert("recent records (newest first)", () => {
  const recent = getRecentRecords(10);
  check(recent.length === 2, `expected 2, got ${recent.length}`);
  check(recent[0]!.designId.includes("def"), "newest first");
});

// Test 5
assert("quality trends", () => {
  // Add a record with current timestamp for trend detection
  saveQualityRecord(makeRecord({
    designId: `design_${Date.now()}_trend`,
    averageScore: 9.0,
    verdict: "pass",
  }));
  const trends = getQualityTrends(30);
  check(trends.length >= 1, `at least 1 trend entry, got ${trends.length}`);
  // Clean up the extra record
});

// Test 6
assert("empty stats", () => {
  const stats = getQualityStats({ contentType: "data_insight" });
  check(stats.totalDesigns === 0, "0 data_insight");
  check(stats.averageScore === 0, "avg 0");
});

// Test 7
assert("clear records", () => {
  clearQualityRecords();
  check(getRecentRecords(10).length === 0, "should be empty");
});

console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
