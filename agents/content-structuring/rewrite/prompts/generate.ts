import type { SlideProfile } from "./slides.js";

// ============================================================================
// Default profiles (same as slides.ts)
// ============================================================================

const DEFAULT_PROFILES: Record<string, SlideProfile> = {
  cover: { maxHeadlineChars: 22, maxBullets: 0, maxBulletChars: 0, maxNoteChars: 40 },
  fact: { maxHeadlineChars: 40, maxBullets: 3, maxBulletChars: 50, maxNoteChars: 60 },
  summary: { maxHeadlineChars: 20, maxBullets: 3, maxBulletChars: 50, maxNoteChars: 0 },
  cta: { maxHeadlineChars: 20, maxBullets: 0, maxBulletChars: 0, maxNoteChars: 40 },
  credits: { maxHeadlineChars: 10, maxBullets: 6, maxBulletChars: 40, maxNoteChars: 0 },
};

// ============================================================================
// System prompt for generate mode
// ============================================================================

export function buildGenerateSystemPrompt(params: {
  forbidNewFacts: boolean;
  forbidEntityChanges: boolean;
  enforceProfiles: boolean;
  locale?: "ko-KR";
}): string {
  const {
    forbidNewFacts,
    forbidEntityChanges,
    enforceProfiles,
    locale = "ko-KR",
  } = params;

  const rules: string[] = [
    "You are a professional card news content creator for Instagram magazines.",
    "Your job is to write engaging, informative slide content based on provided facts and angles.",
    "",
    "=== ABSOLUTE RULES ===",
  ];

  if (forbidNewFacts) {
    rules.push(
      "- Do NOT add, invent, or infer any facts that are not present in KEY_FACTS.",
      "- Every claim in your output MUST be traceable to a provided fact.",
    );
  }

  if (forbidEntityChanges) {
    rules.push(
      "- Do NOT change numbers, dates, percentages, proper nouns (people, organizations, locations, product names) from the source facts.",
    );
  }

  rules.push(
    "- Do NOT invent or output any URLs or evidence links.",
    "- Do NOT change the number of slides or their order.",
    "- Avoid sensationalism and exaggeration.",
    "- Avoid definitive claims when evidence is limited. Use hedging (예: ~로 알려졌다, ~한 것으로 보인다).",
  );

  if (enforceProfiles) {
    rules.push(
      "- Respect the LENGTH_PROFILES constraints provided. Do not exceed max character counts or max bullet counts.",
    );
  }

  rules.push(
    "",
    "=== CREATIVE GUIDELINES ===",
    "- Headlines should be punchy, attention-grabbing, and information-dense.",
    "- Use varied sentence structures to maintain reader interest.",
    "- Each fact slide should tell a self-contained micro-story.",
    "- Bullets should be concise supporting details, not keyword lists.",
    "- Cover slide: a catchy title that captures the topic's essence.",
    "- Summary slide: highlight the 2-3 most impactful takeaways.",
    "",
    "=== OUTPUT FORMAT ===",
    "- Output MUST be valid JSON only.",
    "- No markdown fences, no commentary, no explanation — just raw JSON.",
    "",
    `=== LOCALE: ${locale} ===`,
    "- Write in natural, fluent Korean.",
    "- Keep tone informative but approachable.",
    "",
    "=== FAILURE PROTOCOL ===",
    'If you cannot comply with these rules, output exactly: {"error":"cannot_comply"}',
  );

  return rules.join("\n");
}

// ============================================================================
// User prompt for generate mode
// ============================================================================

export function buildGenerateUserPrompt(params: {
  keyFacts: Array<{ text: string; evidenceUrls: string[] }>;
  angleCandidates: string[];
  category: "music" | "lifestyle";
  depth: "news" | "explainer" | "analysis";
  slideCount: number;
  slideKinds: string[];
  profiles?: Record<string, SlideProfile>;
}): string {
  const {
    keyFacts,
    angleCandidates,
    category,
    depth,
    slideCount,
    slideKinds,
    profiles,
  } = params;
  const activeProfiles = profiles ?? DEFAULT_PROFILES;

  const factsForPrompt = keyFacts.map((f, i) => ({
    index: i,
    text: f.text,
  }));

  const structure = slideKinds.map((kind, i) => ({ index: i, kind }));

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
    `TASK: Create ${String(slideCount)} slides for a ${category}/${depth} Instagram magazine post.`,
    "",
    "GOAL:",
    "- Write engaging headline + bullets for each slide based on the KEY_FACTS below.",
    "- Cover slide: short catchy title (≤22 chars) + optional subtitle note.",
    "- Fact slides: informative headline + 2-3 supporting bullets drawn from the facts.",
    "- Summary slide: recap headline + 2-3 key takeaway bullets.",
    "- CTA slide: engagement prompt (e.g., 유익했다면 저장 & 공유).",
    '- Credits slide: just output "출처" as headline (no creative changes needed).',
    "",
    "=== KEY_FACTS (your source material — all content must come from these) ===",
    JSON.stringify(factsForPrompt, null, 2),
    "",
  ];

  if (angleCandidates.length > 0) {
    sections.push(
      "=== ANGLE_CANDIDATES (suggested editorial angles — use 1-2 as inspiration) ===",
      JSON.stringify(angleCandidates, null, 2),
      "",
    );
  }

  sections.push(
    "=== SLIDE_STRUCTURE (you must output exactly this many slides with these kinds) ===",
    JSON.stringify(structure, null, 2),
    "",
    "=== LENGTH_PROFILES ===",
    JSON.stringify(profileEntries, null, 2),
    "",
    "=== CONSTRAINTS ===",
    `- Return exactly ${String(slideCount)} slides in the "slides" array.`,
    "- slides[i] must match SLIDE_STRUCTURE[i].kind.",
    "- Do NOT include 'kind' in your output — it is already fixed.",
    "- Do NOT include any URLs in your output.",
    "- bullets and note are optional (omit if not needed for that slide kind).",
    '- For credits slide: just use headline "출처" with no bullets.',
    "",
    "=== OUTPUT FORMAT ===",
    '{ "slides": [ { "headline": "...", "bullets": ["..."], "note": "..." } ] }',
  );

  return sections.join("\n");
}
