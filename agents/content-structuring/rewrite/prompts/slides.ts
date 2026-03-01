import type { ContentPlan } from "../../contracts.js";

// ============================================================================
// Length profiles per slide kind
// ============================================================================

export type SlideProfile = {
  maxHeadlineChars: number;
  maxBullets: number;
  maxBulletChars: number;
  maxNoteChars: number;
};

const DEFAULT_PROFILES: Record<string, SlideProfile> = {
  cover: { maxHeadlineChars: 22, maxBullets: 0, maxBulletChars: 0, maxNoteChars: 40 },
  fact: { maxHeadlineChars: 40, maxBullets: 3, maxBulletChars: 50, maxNoteChars: 60 },
  summary: { maxHeadlineChars: 20, maxBullets: 3, maxBulletChars: 50, maxNoteChars: 0 },
  cta: { maxHeadlineChars: 20, maxBullets: 0, maxBulletChars: 0, maxNoteChars: 40 },
  credits: { maxHeadlineChars: 10, maxBullets: 6, maxBulletChars: 40, maxNoteChars: 0 },
};

// ============================================================================
// Build slides user prompt
// ============================================================================

export function buildSlidesUserPrompt(params: {
  contentPlan: ContentPlan;
  keyFacts: Array<{ text: string; evidenceUrls: string[] }>;
  category: "music" | "lifestyle";
  depth: "news" | "explainer" | "analysis";
  profiles?: Record<string, SlideProfile>;
}): string {
  const { contentPlan, keyFacts, category, depth, profiles } = params;
  const activeProfiles = profiles ?? DEFAULT_PROFILES;

  // --- INPUT_SLIDES ---
  const inputSlides = contentPlan.slides.map((slide, i) => ({
    index: i,
    kind: slide.kind,
    headline: slide.headline,
    bullets: slide.bullets ?? [],
    note: slide.note ?? null,
  }));

  // --- KEY_FACTS (text only; URLs are reference-only) ---
  const factsForPrompt = keyFacts.map((f, i) => ({
    index: i,
    text: f.text,
    evidenceUrls_REFERENCE_ONLY: f.evidenceUrls,
  }));

  // --- LENGTH_PROFILES ---
  const profileEntries = Object.entries(activeProfiles).map(
    ([kind, p]) => ({
      kind,
      maxHeadlineChars: p.maxHeadlineChars,
      maxBullets: p.maxBullets,
      maxBulletChars: p.maxBulletChars,
      maxNoteChars: p.maxNoteChars,
    }),
  );

  const sections: string[] = [
    `TASK: Edit the following ${String(contentPlan.slides.length)} slides for a ${category}/${depth} Instagram magazine post.`,
    "",
    "GOAL:",
    "- Polish headlines to be short, punchy, and information-dense in Korean.",
    "- Refine bullets to 2-3 per slide, each concise.",
    "- Shorten notes where present.",
    "- For credits/cta slides: keep factual and non-sensational.",
    "",
    "=== INPUT_SLIDES ===",
    JSON.stringify(inputSlides, null, 2),
    "",
    "=== KEY_FACTS (reference only — do NOT output URLs) ===",
    JSON.stringify(factsForPrompt, null, 2),
    "",
    "=== LENGTH_PROFILES ===",
    JSON.stringify(profileEntries, null, 2),
    "",
    "=== CONSTRAINTS ===",
    `- Return exactly ${String(contentPlan.slides.length)} slides in the "slides" array.`,
    "- slides[i] corresponds 1:1 to INPUT_SLIDES[i].",
    "- Do NOT include 'kind' in your output — it is already fixed.",
    "- Do NOT include any URLs in your output.",
    "- bullets and note are optional (omit if not needed).",
    "",
    "=== OUTPUT FORMAT ===",
    '{ "slides": [ { "headline": "...", "bullets": ["..."], "note": "..." } ] }',
  ];

  return sections.join("\n");
}
