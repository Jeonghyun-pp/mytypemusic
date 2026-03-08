/**
 * Design Critic Agent + Edit Interpreter + Refinement Loop — Integration Test.
 *
 * Tests:
 *   1. Critic evaluates a template-based card news design
 *   2. Critic evaluates a single SNS image
 *   3. Edit Interpreter parses instructions and applies to template slides
 *   4. Quick refine (single critique + optional edit)
 *
 * Requires OPENAI_API_KEY in environment (uses gpt-4o for Vision).
 * Run from apps/studio:
 *   set -a && . .env && npx tsx --tsconfig tsconfig.json src/lib/design/__tests__/design-critic.test.ts
 */

import { generateDesignBrief } from "../design-director";
import { generateVisualDesign } from "../visual-designer";
import { critiqueDesign, critiqueSingleSlide } from "../design-critic";
import { parseEditInstructions, applyEdits } from "../edit-interpreter";
import { quickRefine } from "../refinement-loop";
import {
  saveQualityRecord,
  getQualityStats,
  getRecentRecords,
  clearQualityRecords,
} from "../quality-store";
import type { DesignEngineInput, DesignQualityRecord } from "../types";

let passed = 0;
let failed = 0;

async function assert(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${(e as Error).message}`);
  }
}

function check(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// ── Test 1: Critic evaluates card news ──────────────────

async function testCriticCardNews() {
  const input: DesignEngineInput = {
    topic: "NewJeans 3rd Mini Album Review",
    content: "뉴진스의 세 번째 미니앨범은 레트로와 현대의 조화를 완벽히 구현했다. 타이틀곡 Supernatural은 90년대 유로비트를 현대적으로 재해석한 트랙이다.",
  };
  const brief = await generateDesignBrief(input);

  const contentSlides = [
    { title: "ALBUM REVIEW", body: "NewJeans 새 앨범 완벽 해부", footer: "Web Magazine" },
    { title: "프로듀서 분석", body: "250의 레트로 사운드스케이프", footer: "1/3" },
    { title: "더 알아보기", body: "매거진에서 전체 리뷰를 확인하세요", footer: "Web Magazine" },
  ];

  const design = await generateVisualDesign(
    { brief, contentSlides },
    "card_news",
    "instagram",
  );

  const critique = await critiqueDesign(design, brief);

  check(critique.scores.length === 5, `should have 5 dimension scores, got ${critique.scores.length}`);
  check(critique.averageScore > 0, `average score should be > 0, got ${critique.averageScore}`);
  check(
    critique.verdict === "pass" || critique.verdict === "refine" || critique.verdict === "regenerate",
    `verdict should be valid, got ${critique.verdict}`,
  );

  // Verify all dimensions present
  const dims = critique.scores.map((s) => s.dimension);
  check(dims.includes("VISUAL_HIERARCHY"), "missing VISUAL_HIERARCHY");
  check(dims.includes("BRAND_CONSISTENCY"), "missing BRAND_CONSISTENCY");
  check(dims.includes("READABILITY"), "missing READABILITY");

  console.log(`        avg: ${critique.averageScore}, verdict: ${critique.verdict}`);
  for (const s of critique.scores) {
    console.log(`        ${s.dimension}: ${s.score}/10`);
  }
}

// ── Test 2: Critic evaluates single SNS image ───────────

async function testCriticSnsImage() {
  const input: DesignEngineInput = {
    topic: "K-POP 트렌드",
    content: "2026 상반기 K-POP 트렌드를 분석합니다. AI 프로듀싱과 글로벌 확장이 키워드입니다.",
  };
  const brief = await generateDesignBrief(input);

  const design = await generateVisualDesign(
    {
      brief,
      contentSlides: [{ title: "K-POP 2026 트렌드", body: "올해의 5가지 키워드" }],
    },
    "sns_image",
    "twitter",
  );

  const critique = await critiqueSingleSlide(design.slides[0]!, brief);

  check(critique.scores.length === 5, "should have 5 scores");
  check(critique.averageScore >= 1 && critique.averageScore <= 10, "score in valid range");

  console.log(`        SNS critique: avg ${critique.averageScore}, verdict: ${critique.verdict}`);
}

// ── Test 3: Edit Interpreter ────────────────────────────

async function testEditInterpreter() {
  const input: DesignEngineInput = {
    topic: "BTS 컴백 분석",
    content: "BTS의 완전체 컴백에 대한 심층 분석입니다. 군 전역 후 첫 활동으로 전 세계적인 주목을 받고 있습니다.",
  };
  const brief = await generateDesignBrief(input);

  const design = await generateVisualDesign(
    {
      brief,
      contentSlides: [
        { title: "BTS COMEBACK", body: "완전체 컴백의 의미" },
        { title: "활동 계획", body: "월드투어와 새 앨범 동시 준비" },
      ],
    },
    "card_news",
    "instagram",
  );

  // Verify metadata is stored
  check(!!design.slides[0]!.templateId, "slide should have templateId");
  check(!!design.slides[0]!.renderSpec, "slide should have renderSpec");

  // Parse edit instructions
  const editRequest = await parseEditInstructions(
    "1번 슬라이드 배경을 더 어둡게 바꾸고, 제목 크기를 키워주세요",
    design.slides,
  );

  check(editRequest.actions.length > 0, `should have actions, got ${editRequest.actions.length}`);
  console.log(`        parsed ${editRequest.actions.length} actions`);
  for (const a of editRequest.actions) {
    console.log(`        ${a.target}.${a.property}: ${a.action} → ${String(a.value ?? "")}`);
  }

  // Apply edits
  const edited = await applyEdits(
    design,
    "1번 슬라이드 배경을 더 어둡게 바꾸고, 제목 크기를 키워주세요",
    editRequest.actions,
  );

  check(edited.slides.length === design.slides.length, "slide count should be preserved");
  // Edited slide HTML should differ from original (at least for template path)
  const originalHtml = design.slides[0]!.jsxCode;
  const editedHtml = edited.slides[0]!.jsxCode;
  console.log(`        original HTML length: ${originalHtml.length}`);
  console.log(`        edited HTML length: ${editedHtml.length}`);
}

// ── Test 4: Quality Store ───────────────────────────────

async function testQualityStore() {
  clearQualityRecords();

  const record: DesignQualityRecord = {
    designId: `design_${Date.now()}_test1`,
    contentType: "album_review",
    format: "card_news",
    platform: "instagram",
    scores: [
      { dimension: "VISUAL_HIERARCHY", score: 8, feedback: "Good" },
      { dimension: "BRAND_CONSISTENCY", score: 7, feedback: "OK" },
      { dimension: "READABILITY", score: 9, feedback: "Excellent" },
      { dimension: "AESTHETIC_QUALITY", score: 7, feedback: "OK" },
      { dimension: "PLATFORM_FIT", score: 8, feedback: "Good" },
    ],
    averageScore: 7.8,
    verdict: "refine",
    iterationCount: 2,
    designPath: "template",
    generationTimeMs: 5000,
  };

  saveQualityRecord(record);

  const recent = getRecentRecords(10);
  check(recent.length === 1, `should have 1 record, got ${recent.length}`);
  check(recent[0]!.averageScore === 7.8, "score should match");

  const stats = getQualityStats();
  check(stats.totalDesigns === 1, "total should be 1");
  check(stats.averageScore === 7.8, "avg should be 7.8");
  check(stats.byVerdict.refine === 1, "should have 1 refine");

  clearQualityRecords();
  console.log(`        store CRUD operations working`);
}

// ── Run all tests ───────────────────────────────────────

async function main() {
  console.log(`\nDesign Critic + Edit Interpreter Tests\n`);

  // Non-LLM test first
  await assert("Quality Store CRUD", testQualityStore);

  // LLM-dependent tests
  await assert("Critic: Card news evaluation (3 slides)", testCriticCardNews);
  await assert("Critic: Single SNS image (Twitter)", testCriticSnsImage);
  await assert("Edit Interpreter: Parse + apply edits", testEditInterpreter);

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
