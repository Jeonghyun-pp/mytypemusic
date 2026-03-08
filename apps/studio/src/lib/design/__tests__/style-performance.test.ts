/**
 * Style Performance Tracker — Unit Tests.
 */
import {
  recordDesignStyle,
  updateEngagement,
  getStyleInsights,
  getStyleRecommendation,
  getTopTemplates,
  getPerformanceSummary,
  getPerformanceRecords,
  clearPerformanceRecords,
} from "../style-performance";
import type { StylePerformanceRecord } from "../style-performance";

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

function makeRecord(overrides: Partial<StylePerformanceRecord> = {}): StylePerformanceRecord {
  return {
    id: `design_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    contentType: "album_review",
    format: "card_news",
    platform: "instagram",
    templateId: "cover.hero.v1",
    designPath: "template",
    typographyMood: "sans_modern",
    layoutStyle: "editorial",
    colorMood: "vibrant",
    primaryColor: "#6C5CE7",
    hasImage: true,
    slideCount: 5,
    ...overrides,
  };
}

console.log(`\nStyle Performance Tracker Tests\n`);

clearPerformanceRecords();

// Test 1
assert("record + get", () => {
  const rec = makeRecord({ id: "test1" });
  recordDesignStyle(rec);
  const records = getPerformanceRecords(10);
  check(records.length === 1, `expected 1, got ${records.length}`);
  check(records[0]!.id === "test1", "id mismatch");
});

// Test 2
assert("update engagement", () => {
  const updated = updateEngagement("test1", {
    impressions: 1000,
    engagements: 50,
    saves: 10,
    shares: 5,
    clicks: 20,
  });
  check(updated === true, "should return true");
  const records = getPerformanceRecords(10);
  check(records[0]!.engagementRate === 0.05, `engagement rate: ${records[0]!.engagementRate}`);
});

// Test 3
assert("update engagement — nonexistent", () => {
  const updated = updateEngagement("nonexistent", { impressions: 100 });
  check(updated === false, "should return false for nonexistent");
});

// Test 4
assert("insights — not enough data", () => {
  const insights = getStyleInsights();
  // Only 1 record with engagement — need 3+
  check(insights.length === 0, `expected 0 insights, got ${insights.length}`);
});

// Test 5
assert("insights — with enough data", () => {
  // Add more records with engagement
  for (let i = 0; i < 5; i++) {
    const rec = makeRecord({
      id: `batch_a_${i}`,
      typographyMood: "sans_modern",
      layoutStyle: "editorial",
      colorMood: "vibrant",
    });
    recordDesignStyle(rec);
    updateEngagement(`batch_a_${i}`, { impressions: 1000, engagements: 50 + i * 10 });
  }

  for (let i = 0; i < 3; i++) {
    const rec = makeRecord({
      id: `batch_b_${i}`,
      typographyMood: "display_impact",
      layoutStyle: "bold",
      colorMood: "dark",
    });
    recordDesignStyle(rec);
    updateEngagement(`batch_b_${i}`, { impressions: 1000, engagements: 20 + i * 5 });
  }

  const insights = getStyleInsights();
  check(insights.length > 0, "should have insights");
  // sans_modern should have higher engagement rate than display_impact
  const sansMod = insights.find((i) => i.attribute === "typographyMood" && i.value === "sans_modern");
  const dispImp = insights.find((i) => i.attribute === "typographyMood" && i.value === "display_impact");
  check(sansMod !== undefined, "should find sans_modern");
  check(dispImp !== undefined, "should find display_impact");
  check(sansMod!.avgEngagementRate > dispImp!.avgEngagementRate, "sans_modern should outperform display_impact");
});

// Test 6
assert("recommendation", () => {
  const rec = getStyleRecommendation("album_review", "instagram");
  check(rec.contentType === "album_review", "content type");
  check(rec.platform === "instagram", "platform");
  check(rec.reasoning.length > 0, "should have reasoning");
  check(rec.recommendedStyles.typographyMood === "sans_modern", `recommended typo: ${rec.recommendedStyles.typographyMood}`);
});

// Test 7
assert("top templates", () => {
  const top = getTopTemplates(5);
  check(top.length >= 1, "should have at least 1 template");
  check(top[0]!.templateId === "cover.hero.v1", `top template: ${top[0]!.templateId}`);
  check(top[0]!.sampleSize >= 2, `sample size: ${top[0]!.sampleSize}`);
});

// Test 8
assert("summary", () => {
  const summary = getPerformanceSummary();
  check(summary.totalRecords === 9, `total: ${summary.totalRecords}`);
  check(summary.withEngagement === 9, `with engagement: ${summary.withEngagement}`);
  check(summary.avgEngagementRate > 0, "avg rate > 0");
});

// Test 9
assert("filter by platform", () => {
  // Add a twitter record
  const rec = makeRecord({ id: "twitter1", platform: "twitter", typographyMood: "serif_classic" });
  recordDesignStyle(rec);
  updateEngagement("twitter1", { impressions: 500, engagements: 100 });

  // Another twitter record for min sample size
  const rec2 = makeRecord({ id: "twitter2", platform: "twitter", typographyMood: "serif_classic" });
  recordDesignStyle(rec2);
  updateEngagement("twitter2", { impressions: 500, engagements: 80 });

  // Another one to meet 3+ threshold
  const rec3 = makeRecord({ id: "twitter3", platform: "twitter", typographyMood: "serif_classic" });
  recordDesignStyle(rec3);
  updateEngagement("twitter3", { impressions: 500, engagements: 90 });

  const insights = getStyleInsights({ platform: "twitter" });
  check(insights.length > 0, "should have twitter insights");
  check(insights.every((i) => i.sampleSize >= 2), "all samples from twitter");
});

// Test 10
assert("clear records", () => {
  clearPerformanceRecords();
  const summary = getPerformanceSummary();
  check(summary.totalRecords === 0, "should be empty");
});

console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
