/**
 * Style Transfer & Spotify Style Extractor — Unit Tests (no LLM/API required).
 * Tests pure functions only.
 */
import { styleTokenToColorOverrides } from "../style-transfer";
import { mergeStyleTokens } from "../spotify-style-extractor";
import type { StyleToken } from "../types";

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

function makeToken(overrides: Partial<StyleToken> = {}): StyleToken {
  return {
    id: "test",
    name: "Test",
    colors: {
      palette: ["#FF0000", "#00FF00", "#0000FF"],
      ratios: [0.5, 0.3, 0.2],
    },
    typography: { mood: "sans_modern", weight: "bold", style: "sans" },
    layout: { density: "balanced", alignment: "center", whitespace: "moderate" },
    effects: ["gradient"],
    moodKeywords: ["vibrant"],
    ...overrides,
  };
}

console.log(`\nStyle Transfer Unit Tests\n`);

// Test 1
assert("styleTokenToColorOverrides — basic", () => {
  const token = makeToken();
  const overrides = styleTokenToColorOverrides(token);
  check(overrides.primary === "#FF0000", `primary: ${overrides.primary}`);
  check(overrides.accent === "#00FF00", `accent: ${overrides.accent}`);
  check(overrides.gradients.length === 1, "should generate gradient");
  check(overrides.gradients[0]!.includes("#FF0000"), "gradient has primary");
});

// Test 2
assert("styleTokenToColorOverrides — with explicit gradient", () => {
  const token = makeToken({
    colors: {
      palette: ["#AA00BB", "#CC00DD"],
      ratios: [0.6, 0.4],
      gradient: "linear-gradient(90deg, #AA00BB, #CC00DD)",
    },
  });
  const overrides = styleTokenToColorOverrides(token);
  check(overrides.gradients[0] === "linear-gradient(90deg, #AA00BB, #CC00DD)", "should use explicit gradient");
});

// Test 3
assert("mergeStyleTokens — single token returns itself", () => {
  const token = makeToken({ name: "Solo" });
  const merged = mergeStyleTokens([token]);
  check(merged !== null, "should not be null");
  check(merged!.name === "Solo", "should return same token");
});

// Test 4
assert("mergeStyleTokens — empty returns null", () => {
  const merged = mergeStyleTokens([]);
  check(merged === null, "should be null");
});

// Test 5
assert("mergeStyleTokens — merges 3 tokens", () => {
  const t1 = makeToken({
    name: "Style A",
    colors: { palette: ["#FF0000", "#00FF00"], ratios: [0.6, 0.4] },
    typography: { mood: "sans_modern", weight: "bold", style: "sans" },
    moodKeywords: ["vibrant", "modern"],
    effects: ["gradient"],
  });
  const t2 = makeToken({
    name: "Style B",
    colors: { palette: ["#FF0000", "#0000FF"], ratios: [0.5, 0.5] },
    typography: { mood: "sans_modern", weight: "regular", style: "sans" },
    moodKeywords: ["clean", "minimal"],
    effects: ["shadow"],
  });
  const t3 = makeToken({
    name: "Style C",
    colors: { palette: ["#FF0000", "#FFFF00"], ratios: [0.7, 0.3] },
    typography: { mood: "display_impact", weight: "bold", style: "display" },
    moodKeywords: ["energetic"],
    effects: ["neon_glow"],
  });

  const merged = mergeStyleTokens([t1, t2, t3]);
  check(merged !== null, "should merge");
  // #FF0000 appears in all 3 with high ratios — should be first
  check(merged!.colors.palette[0] === "#ff0000", `top color: ${merged!.colors.palette[0]}`);
  // Typography mood: sans_modern (2 out of 3)
  check(merged!.typography.mood === "sans_modern", `mood: ${merged!.typography.mood}`);
  // Weight: bold (2 out of 3)
  check(merged!.typography.weight === "bold", `weight: ${merged!.typography.weight}`);
  // All keywords merged
  check(merged!.moodKeywords.length >= 3, `keywords: ${merged!.moodKeywords.length}`);
  // All effects merged
  check(merged!.effects.length === 3, `effects: ${merged!.effects.length}`);
});

console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
