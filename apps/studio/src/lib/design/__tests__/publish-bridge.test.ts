/**
 * Publish Bridge — Unit Tests (no API/LLM required).
 * Tests pure helper functions.
 */
import { prepareForPublishing } from "../publish-bridge";
import type { DesignBrief, VisualDesignResult } from "../types";
import { clearPerformanceRecords, getPerformanceRecords } from "../style-performance";

let passed = 0;
let failed = 0;

function check(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assert(name: string, fn: () => Promise<void> | void) {
  const result = fn();
  if (result && typeof result.then === "function") {
    result
      .then(() => { passed++; console.log(`  PASS  ${name}`); })
      .catch((e: Error) => { failed++; console.error(`  FAIL  ${name}: ${e.message}`); });
    return result;
  }
  passed++;
  console.log(`  PASS  ${name}`);
}

function makeBrief(overrides: Partial<DesignBrief> = {}): DesignBrief {
  return {
    contentType: "album_review",
    mood: "에너지틱한",
    keyMessage: "NewJeans 새 앨범 분석",
    visualConcept: "네온 글로우",
    colorDirection: { primary: "#6C5CE7", mood: "vibrant" },
    layoutStyle: "editorial",
    typographyMood: "sans_modern",
    outputs: [],
    ...overrides,
  } as DesignBrief;
}

function makeVisualResult(): VisualDesignResult {
  return {
    format: "card_news",
    slides: [
      { index: 0, jsxCode: "<div>slide1</div>", width: 1080, height: 1080, platform: "instagram" },
      { index: 1, jsxCode: "<div>slide2</div>", width: 1080, height: 1080, platform: "instagram" },
    ],
    designPath: "template",
  };
}

// Mock render function
async function mockRender(html: string, w: number, h: number): Promise<string> {
  return `data:image/png;base64,MOCK_${w}x${h}`;
}

console.log(`\nPublish Bridge Tests\n`);

clearPerformanceRecords();

async function runAll() {
  // Test 1
  await assert("prepareForPublishing — basic", async () => {
    const result = await prepareForPublishing({
      brief: makeBrief(),
      visualResult: makeVisualResult(),
      platform: "instagram",
      renderSlide: mockRender,
    });

    check(result.platform === "instagram", "platform");
    check(result.imageDataUris.length === 2, `images: ${result.imageDataUris.length}`);
    check(result.imageDataUris[0]!.startsWith("data:image/png"), "image data URI format");
    check(result.text.length > 0, "text not empty");
    check(result.hashtags.length > 0, "hashtags not empty");
    check(result.hashtags.some((h) => h.startsWith("#")), "hashtags start with #");
    check(result.designMeta.contentType === "album_review", "design meta content type");
  });

  // Test 2
  await assert("prepareForPublishing — caption override", async () => {
    const result = await prepareForPublishing({
      brief: makeBrief(),
      visualResult: makeVisualResult(),
      platform: "instagram",
      renderSlide: mockRender,
      captionOverride: "Custom caption text",
    });

    check(result.text === "Custom caption text", `text: ${result.text}`);
  });

  // Test 3
  await assert("prepareForPublishing — twitter truncation", async () => {
    const longMessage = "A".repeat(300);
    const result = await prepareForPublishing({
      brief: makeBrief({ keyMessage: longMessage }),
      visualResult: makeVisualResult(),
      platform: "twitter",
      renderSlide: mockRender,
    });

    check(result.text.length <= 280, `twitter text length: ${result.text.length}`);
    check(result.text.endsWith("..."), "should be truncated");
  });

  // Test 4
  await assert("prepareForPublishing — extra hashtags", async () => {
    const result = await prepareForPublishing({
      brief: makeBrief(),
      visualResult: makeVisualResult(),
      platform: "instagram",
      renderSlide: mockRender,
      extraHashtags: ["NewJeans", "#CustomTag"],
    });

    check(result.hashtags.includes("#NewJeans"), "should include extra hashtag");
    check(result.hashtags.includes("#CustomTag"), "should include extra with # stripped");
  });

  // Test 5
  await assert("records style for performance tracking", async () => {
    const records = getPerformanceRecords(10);
    check(records.length >= 4, `should have records, got ${records.length}`);
    check(records.some((r) => r.contentType === "album_review"), "should track content type");
    check(records.some((r) => r.typographyMood === "sans_modern"), "should track typography");
  });

  // Test 6 — empty slides guard
  await assert("rejects empty slides", async () => {
    let threw = false;
    try {
      await prepareForPublishing({
        brief: makeBrief(),
        visualResult: { ...makeVisualResult(), slides: [] },
        platform: "instagram",
        renderSlide: mockRender,
      });
    } catch (e) {
      threw = true;
      check((e as Error).message.includes("no slides"), "error message");
    }
    check(threw, "should throw on empty slides");
  });

  // Test 7
  await assert("youtube_thumb — no caption", async () => {
    const result = await prepareForPublishing({
      brief: makeBrief(),
      visualResult: makeVisualResult(),
      platform: "youtube_thumb",
      renderSlide: mockRender,
    });

    check(result.text === "", `youtube thumb should have no caption, got: "${result.text}"`);
    check(result.hashtags.length === 0, "youtube thumb should have no hashtags");
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failed > 0) process.exit(1);
}

void runAll();
