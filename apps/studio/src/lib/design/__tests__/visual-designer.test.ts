/**
 * Visual Designer Agent — Integration Test.
 *
 * Tests both Path A (template) and Path B (LLM-generated) for:
 *   - Card news generation
 *   - SNS image generation
 *   - Style overrides from DesignBrief
 *
 * Requires OPENAI_API_KEY in environment.
 * Run from apps/studio:
 *   set -a && . .env && npx tsx --tsconfig tsconfig.json src/lib/design/__tests__/visual-designer.test.ts
 */

import { generateDesignBrief } from "../design-director";
import { generateVisualDesign, designWithTemplate } from "../visual-designer";
import type { DesignBrief, DesignEngineInput } from "../types";

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

const SAMPLE_SLIDES = [
  { title: "ALBUM REVIEW", body: "NewJeans 새 앨범 완벽 해부", footer: "Web Magazine" },
  { title: "프로듀서 분석", body: "250의 레트로 사운드스케이프가 뉴진스의 세계관을 확장한다", footer: "1/5" },
  { title: "타이틀곡 해부", body: "Supernatural은 90년대 유로비트를 현대적으로 재해석한 트랙이다", footer: "2/5" },
  { title: "핵심 포인트", body: "하니의 보컬과 해린의 래핑이 절묘하게 어우러진다", footer: "3/5" },
  { title: "더 알아보기", body: "매거진에서 전체 리뷰를 확인하세요", footer: "Web Magazine" },
];

// ── Test 1: Path A - Card news with template ────────────

async function testPathACardNews() {
  const input: DesignEngineInput = {
    topic: "NewJeans 3rd Mini Album Review",
    content: "뉴진스의 세 번째 미니앨범 리뷰입니다.",
  };
  const brief = await generateDesignBrief(input);

  const result = await generateVisualDesign(
    { brief, contentSlides: SAMPLE_SLIDES },
    "card_news",
    "instagram",
  );

  check(result.designPath === "template", `designPath should be template, got ${result.designPath}`);
  check(result.slides.length === 5, `should have 5 slides, got ${result.slides.length}`);
  check(result.slides[0]!.width === 1080, "width should be 1080");
  check(result.slides[0]!.height === 1080, "height should be 1080");

  // Verify jsxCode contains rendered HTML (not JSON)
  check(result.slides[0]!.jsxCode.includes("<div"), "jsxCode should contain HTML");
  check(result.slides[0]!.jsxCode.includes("style="), "jsxCode should contain inline styles");

  console.log(`        slides: ${result.slides.length}`);
  console.log(`        first slide HTML length: ${result.slides[0]!.jsxCode.length} chars`);
}

// ── Test 2: Path A - SNS image ──────────────────────────

async function testPathASns() {
  const input: DesignEngineInput = {
    topic: "K-POP 트렌드",
    content: "2026 상반기 트렌드 분석",
  };
  const brief = await generateDesignBrief(input);

  const result = await generateVisualDesign(
    { brief, contentSlides: [{ title: "K-POP 2026 트렌드", body: "올해의 5가지 키워드" }] },
    "sns_image",
    "twitter",
  );

  check(result.designPath === "template", "SNS should use template path");
  check(result.slides.length === 1, "SNS should have 1 slide");
  check(result.slides[0]!.width === 1200, "twitter width should be 1200");
  check(result.slides[0]!.height === 675, "twitter height should be 675");

  console.log(`        platform: twitter (${result.slides[0]!.width}x${result.slides[0]!.height})`);
}

// ── Test 3: Path B - LLM-generated ──────────────────────

async function testPathBGenerated() {
  const input: DesignEngineInput = {
    topic: "BTS 컴백 분석",
    content: "BTS의 완전체 컴백에 대한 심층 분석입니다.",
  };
  const brief = await generateDesignBrief(input);

  const result = await generateVisualDesign(
    {
      brief,
      contentSlides: [
        { title: "BTS COMEBACK", body: "완전체 컴백의 의미", role: "cover" as const },
      ],
      preferGenerated: true,
    },
    "sns_image",
    "instagram",
  );

  check(result.designPath === "generated", "should use generated path");
  check(result.slides.length === 1, "should have 1 slide");
  check(result.slides[0]!.jsxCode.includes("<div"), "jsxCode should contain HTML");
  check(result.slides[0]!.jsxCode.includes("display"), "jsxCode should contain display style");

  console.log(`        HTML length: ${result.slides[0]!.jsxCode.length} chars`);
  console.log(`        First 200 chars: ${result.slides[0]!.jsxCode.slice(0, 200)}...`);
}

// ── Run all tests ───────────────────────────────────────

async function main() {
  console.log(`\nVisual Designer Agent Tests\n`);

  await assert("Path A: Card news (template-based, 5 slides)", testPathACardNews);
  await assert("Path A: SNS image (Twitter 1200x675)", testPathASns);
  await assert("Path B: LLM-generated HTML (Instagram 1080x1080)", testPathBGenerated);

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
