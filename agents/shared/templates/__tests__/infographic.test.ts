/**
 * Infographic Templates — Unit Tests.
 * Tests that all 4 templates render valid HTML without crashing.
 */
import {
  renderInfographicBarV1,
  renderInfographicDonutV1,
  renderInfographicComparisonV1,
  renderInfographicTimelineV1,
} from "../infographic";
import type { SlideRenderSpec } from "../types";

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

function makeInput(body: string, overrides: Partial<SlideRenderSpec> = {}): SlideRenderSpec {
  return {
    title: "테스트 차트",
    bodyText: body,
    footerText: "@test_magazine",
    slideIndex: 0,
    ...overrides,
  };
}

console.log(`\nInfographic Template Tests\n`);

// ── Bar Chart ──
assert("bar — normal data", () => {
  const html = renderInfographicBarV1(makeInput("BTS | 1200\naespa | 980\nIVE | 870"));
  check(html.includes("BTS"), "should include label");
  check(html.includes("1200"), "should include value");
  check(html.includes("display:flex"), "should have flex layout");
});

assert("bar — empty body", () => {
  const html = renderInfographicBarV1(makeInput(""));
  check(typeof html === "string", "should not crash");
  check(html.includes("테스트 차트"), "should include title");
});

assert("bar — single item", () => {
  const html = renderInfographicBarV1(makeInput("Solo | 500"));
  check(html.includes("Solo"), "should include label");
});

assert("bar — no pipe separator", () => {
  const html = renderInfographicBarV1(makeInput("No pipe here\nAnother line"));
  check(typeof html === "string", "should not crash on malformed data");
});

// ── Donut Chart ──
assert("donut — normal data", () => {
  const html = renderInfographicDonutV1(makeInput("K-Pop | 45\nPop | 25\nHip-Hop | 15"));
  check(html.includes("<svg"), "should include SVG");
  check(html.includes("<path"), "should include arc paths");
  check(html.includes("K-Pop"), "should include label in legend");
});

assert("donut — all zeros", () => {
  const html = renderInfographicDonutV1(makeInput("A | 0\nB | 0\nC | 0"));
  check(typeof html === "string", "should not crash on zero values");
  check(html.includes("<svg"), "should still have SVG");
});

assert("donut — single item", () => {
  const html = renderInfographicDonutV1(makeInput("Only | 100"));
  check(html.includes("<path"), "should render one arc");
});

// ── Comparison ──
assert("comparison — normal data", () => {
  const html = renderInfographicComparisonV1(makeInput("BTS | NewJeans\n스트리밍 | 5억 | 3.2억\n팔로워 | 4200만 | 3100만"));
  check(html.includes("BTS"), "should include left name");
  check(html.includes("NewJeans"), "should include right name");
  check(html.includes("VS"), "should include VS");
  check(html.includes("스트리밍"), "should include metric");
});

assert("comparison — header only (no metrics)", () => {
  const html = renderInfographicComparisonV1(makeInput("Left | Right"));
  check(typeof html === "string", "should not crash with only header");
  check(html.includes("Left"), "should have header");
});

assert("comparison — empty body", () => {
  const html = renderInfographicComparisonV1(makeInput(""));
  check(typeof html === "string", "should not crash on empty");
});

// ── Timeline ──
assert("timeline — normal data", () => {
  const html = renderInfographicTimelineV1(makeInput("데뷔 | 2020.03 | 첫 미니앨범\n첫 1위 | 2020.08 | 음방 1위"));
  check(html.includes("데뷔"), "should include label");
  check(html.includes("2020.03"), "should include date");
  check(html.includes("첫 미니앨범"), "should include description");
});

assert("timeline — no extra field", () => {
  const html = renderInfographicTimelineV1(makeInput("Event A | 2023.01\nEvent B | 2023.06"));
  check(html.includes("Event A"), "should include label");
  check(!html.includes("undefined"), "should not show undefined");
});

assert("timeline — single item", () => {
  const html = renderInfographicTimelineV1(makeInput("Solo | 2024.01 | Only event"));
  check(typeof html === "string", "should not crash");
});

// ── Custom canvas sizes ──
assert("bar — custom canvas size", () => {
  const html = renderInfographicBarV1(makeInput("A | 100", { canvasWidth: 1200, canvasHeight: 1200 }));
  check(html.includes("1200px"), "should use custom width");
});

// ── Style overrides ──
assert("donut — style overrides", () => {
  const html = renderInfographicDonutV1(makeInput("A | 50\nB | 50", {
    textColor: "#FF0000",
    accentColor: "#00FF00",
    footerColor: "#0000FF",
    titleSizePx: 48,
  }));
  check(html.includes("#FF0000"), "should use custom text color");
  check(html.includes("#00FF00"), "should use custom accent color");
});

console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
