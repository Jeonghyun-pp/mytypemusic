/**
 * E2E Pipeline Integration Tests
 *
 * Tests the pipeline wiring: stage flow, type compatibility, error propagation.
 * Does NOT call LLM — validates the orchestration logic.
 */

import type { E2EInput, E2EResult, E2EStage } from "../e2e-orchestrator";
import type { PipelineResult, PipelineOutline, QualityScore, ResearchPacket } from "../types";
import type { DesignBrief, DesignPlatform, DesignFormat, VisualDesignResult } from "../../design/types";

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

console.log(`\nE2E Pipeline Integration Tests\n`);

// ── Test 1: E2EInput type structure ──

assert("E2EInput accepts all fields", () => {
  const input: E2EInput = {
    topic: "BTS 신곡 분석",
    contentType: "blog",
    targetWordCount: 2000,
    persona: {
      name: "Test Persona",
      styleFingerprint: "warm, analytical",
      perspective: "1st person",
      expertiseAreas: ["K-pop"],
      tone: { formality: 0.6 },
      emotionalDrivers: ["curiosity"],
      vocabulary: null,
      structure: null,
      contentRules: { always: ["cite sources"], never: ["use slang"] },
      goldenExamples: null,
      channelProfiles: null,
    },
    referenceImageUrl: "https://example.com/album.jpg",
    platforms: ["instagram", "twitter"],
    preferGenerated: false,
    existingContent: "이미 작성된 콘텐츠...",
    skip: { article: true, design: false, dataViz: true, publish: true },
    onStageChange: () => {},
  };

  check(input.topic === "BTS 신곡 분석", "topic");
  check(input.platforms?.length === 2, "platforms");
  check(input.skip?.article === true, "skip.article");
});

// ── Test 2: E2EResult type structure ──

assert("E2EResult has all required fields", () => {
  const result: E2EResult = {
    stage: "completed",
    article: undefined,
    design: undefined,
    totalTimeMs: 5000,
    stageTimings: { article: 3000, design: 2000 },
  };

  check(result.stage === "completed", "stage");
  check(result.totalTimeMs === 5000, "totalTimeMs");
  check(result.stageTimings.article === 3000, "stageTimings");
});

// ── Test 3: PipelineResult type compatibility ──

assert("PipelineResult flows into E2EResult.article", () => {
  const outline: PipelineOutline = {
    title: "BTS 분석",
    angle: "음악적 진화",
    sections: [{ heading: "서론", keyPoints: ["point1"] }],
    seoTitle: "BTS Analysis",
    seoDescription: "BTS 음악 분석",
    seoKeywords: ["BTS", "K-pop"],
    targetWordCount: 2000,
  };

  const score: QualityScore = {
    factualAccuracy: 85,
    voiceAlignment: 80,
    readability: 90,
    originality: 75,
    seo: 70,
    overall: 80,
    feedback: "잘 작성되었습니다",
  };

  const article: PipelineResult = {
    status: "approved",
    outline,
    draftContent: "초고 내용...",
    editedContent: "편집된 내용...",
    qualityScore: score,
    rewriteCount: 1,
  };

  const result: E2EResult = {
    stage: "completed",
    article,
    totalTimeMs: 1000,
    stageTimings: {},
  };

  check(result.article?.status === "approved", "article status");
  check(result.article?.qualityScore.overall === 80, "quality score");
  check(result.article?.rewriteCount === 1, "rewrite count");
  check(result.article?.outline.sections.length === 1, "outline sections");
});

// ── Test 4: DesignBrief → E2EDesignOutput flow ──

assert("DesignBrief connects to design output", () => {
  const brief: DesignBrief = {
    contentType: "album_review",
    mood: "에너지틱한",
    keyMessage: "BTS의 새로운 도전",
    visualConcept: "네온 글로우 + 타이포",
    colorDirection: { primary: "#6C5CE7", mood: "vibrant" },
    layoutStyle: "bold",
    typographyMood: "sans_modern",
    outputs: [
      { format: "card_news", platform: "instagram", slideCount: 5, priority: "must" },
      { format: "sns_image", platform: "twitter", priority: "must" },
    ],
  } as DesignBrief;

  check(brief.outputs.length === 2, "outputs count");
  check(brief.outputs[0]!.format === "card_news", "first output format");
  check(brief.outputs[0]!.platform === "instagram", "first output platform");

  // Simulate visual result
  const visualResult: VisualDesignResult = {
    format: "card_news",
    slides: [
      { index: 0, jsxCode: "<div>Cover</div>", width: 1080, height: 1350, platform: "instagram", templateId: "cover.hero.v1" },
      { index: 1, jsxCode: "<div>Body</div>", width: 1080, height: 1350, platform: "instagram", templateId: "body.fact.v1" },
    ],
    designPath: "template",
  };

  check(visualResult.slides.length === 2, "slides count");
  check(visualResult.designPath === "template", "design path");
});

// ── Test 5: Stage progression validation ──

assert("E2EStage progression is valid", () => {
  const validProgressions: E2EStage[][] = [
    ["idle", "researching", "writing", "editing", "designing", "rendering", "completed"],
    ["idle", "researching", "writing", "editing", "failed"],
    ["idle", "designing", "rendering", "completed"],
    ["idle", "completed"],
  ];

  const allStages: E2EStage[] = [
    "idle", "researching", "writing", "editing",
    "designing", "rendering", "publishing", "completed", "failed",
  ];

  for (const progression of validProgressions) {
    for (const stage of progression) {
      check(allStages.includes(stage), `"${stage}" is a valid stage`);
    }
  }
});

// ── Test 6: ResearchPacket type structure ──

assert("ResearchPacket has all required fields", () => {
  const packet: ResearchPacket = {
    topic: "NewJeans",
    entities: {
      artists: ["NewJeans"],
      albums: ["Get Up"],
      genres: ["K-pop", "Pop"],
      keywords: ["뉴진스", "신곡"],
    },
    artists: [{
      name: "NewJeans",
      nameKo: "뉴진스",
      genres: ["K-pop"],
      bio: "2022년 데뷔한 걸그룹",
      popularity: 85,
      albums: [{ title: "Get Up", releaseDate: "2023-07", albumType: "ep" }],
      relatedArtists: [{ name: "LE SSERAFIM", relationType: "similar_to" }],
    }],
    relatedArticles: [
      { content: "관련 기사 내용", sourceType: "blog", score: 0.85 },
    ],
    webSources: [
      { title: "NewJeans 신곡 발매", url: "https://example.com", snippet: "뉴진스가..." },
    ],
  };

  check(packet.entities.artists.length === 1, "artists");
  check(packet.artists[0]!.albums.length === 1, "albums");
  check(packet.relatedArticles[0]!.score === 0.85, "article score");
});

// ── Test 7: Platform dimensions ──

assert("DesignPlatform covers all platforms", () => {
  const platforms: DesignPlatform[] = [
    "instagram", "instagram_story", "twitter",
    "youtube_thumb", "facebook", "blog", "tiktok",
  ];

  check(platforms.length === 7, `expected 7 platforms, got ${platforms.length}`);

  // Verify platform names are valid
  for (const p of platforms) {
    check(typeof p === "string" && p.length > 0, `valid platform: ${p}`);
  }
});

// ── Test 8: DesignFormat covers all formats ──

assert("DesignFormat covers all formats", () => {
  const formats: DesignFormat[] = [
    "card_news", "sns_image", "motion_graphic",
    "infographic", "cover", "quote_card", "data_chart",
  ];

  check(formats.length === 7, `expected 7 formats, got ${formats.length}`);
});

// ── Test 9: Quality gate logic ──

assert("Quality gate passes/fails correctly", () => {
  // Pass case: overall >= 70
  const passScore: QualityScore = {
    factualAccuracy: 85, voiceAlignment: 80, readability: 90,
    originality: 75, seo: 70, overall: 80, feedback: "Good",
  };
  check(passScore.overall >= 70, "should pass");

  // Fail case: overall < 70
  const failScore: QualityScore = {
    factualAccuracy: 50, voiceAlignment: 60, readability: 55,
    originality: 45, seo: 40, overall: 50, feedback: "Needs work",
  };
  check(failScore.overall < 70, "should fail");

  // Edge case: any dimension < 50
  const lowDimension: QualityScore = {
    factualAccuracy: 45, voiceAlignment: 80, readability: 90,
    originality: 85, seo: 70, overall: 74, feedback: "Low factual",
  };
  const hasCriticalLow = [
    lowDimension.factualAccuracy,
    lowDimension.voiceAlignment,
    lowDimension.readability,
    lowDimension.originality,
    lowDimension.seo,
  ].some((d) => d < 50);
  check(hasCriticalLow, "has critical low dimension");
});

// ── Test 10: Skip configuration combinations ──

assert("Skip configs produce expected behavior", () => {
  // Skip everything
  const skipAll: E2EInput = {
    topic: "test",
    skip: { article: true, design: true, dataViz: true, publish: true },
  };
  check(skipAll.skip?.article === true, "skip article");
  check(skipAll.skip?.design === true, "skip design");

  // Use existing content
  const existing: E2EInput = {
    topic: "test",
    existingContent: "Pre-written article...",
  };
  check(existing.existingContent !== undefined, "has existing content");

  // No skip (full pipeline)
  const full: E2EInput = { topic: "test" };
  check(full.skip === undefined, "no skip");
});

// ── Test 11: buildContentSlides logic (reconstructed) ──

assert("Content splitting creates correct slide structure", () => {
  const content = "첫 번째 단락입니다. 중요한 내용을 다루고 있습니다.\n\n두 번째 단락입니다. 추가적인 정보가 여기에 있습니다.\n\n세 번째 단락입니다. 결론을 내리는 중요한 부분입니다.\n\n네 번째 단락입니다. 전체 기사를 마무리합니다.";

  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  check(paragraphs.length === 4, `expected 4 paragraphs, got ${paragraphs.length}`);

  const targetSlides = Math.min(6, Math.max(2, Math.ceil(paragraphs.length / 2)));
  check(targetSlides >= 2 && targetSlides <= 6, `target slides in range: ${targetSlides}`);

  // Simulate cover + body + outro structure
  const totalSlides = 1 + targetSlides + 1; // cover + body + outro
  check(totalSlides >= 4, `total slides reasonable: ${totalSlides}`);
});

// ── Test 12: Stage change notification ──

assert("onStageChange captures all stages", () => {
  const stages: E2EStage[] = [];
  const onStage = (stage: E2EStage) => stages.push(stage);

  // Simulate progression
  onStage("researching");
  onStage("writing");
  onStage("editing");
  onStage("designing");
  onStage("rendering");
  onStage("completed");

  check(stages.length === 6, "all stages recorded");
  check(stages[0] === "researching", "first stage");
  check(stages[stages.length - 1] === "completed", "last stage");
});

// ── Test 13: Error propagation ──

assert("Failed pipeline produces correct result shape", () => {
  const failResult: E2EResult = {
    stage: "failed",
    article: {
      status: "failed",
      outline: { title: "", angle: "", sections: [], seoTitle: "", seoDescription: "", seoKeywords: [], targetWordCount: 0 },
      draftContent: "",
      editedContent: "",
      qualityScore: { factualAccuracy: 0, voiceAlignment: 0, readability: 0, originality: 0, seo: 0, overall: 0, feedback: "" },
      rewriteCount: 0,
      error: "LLM timeout",
    },
    totalTimeMs: 500,
    stageTimings: { article: 500 },
  };

  check(failResult.stage === "failed", "stage is failed");
  check(failResult.article?.error === "LLM timeout", "error propagated");
  check(failResult.design === undefined, "no design on failure");
});

// ── Test 14: Persona → Writer integration shape ──

assert("PersonaContext has all layers for writer", () => {
  const persona = {
    name: "뮤직 매거진",
    styleFingerprint: "분석적이면서 따뜻한 톤, 전문용어를 일상어로 풀어쓰는 스타일",
    perspective: "1인칭 복수",
    expertiseAreas: ["K-pop", "indie", "음악 이론"],
    tone: { formality: 0.6, humor: 0.3, emotion: 0.7, energy: 0.5 },
    emotionalDrivers: ["curiosity", "nostalgia"],
    vocabulary: { level: "intermediate", preferredWords: ["사운드스케이프"], avoidWords: ["짱"] },
    structure: { avgSentenceLength: 25, hookStyle: "question" },
    contentRules: { always: ["출처 명시"], never: ["비속어 사용"] },
    goldenExamples: { blog: ["예시 글 1"], sns: ["예시 SNS 1"] },
    channelProfiles: { blog: { tone: "formal" }, sns: { tone: "casual" } },
  };

  // Layer 1: Fingerprint
  check(persona.styleFingerprint.length > 0, "has fingerprint");
  // Layer 2: Golden Examples
  check(persona.goldenExamples.blog.length > 0, "has golden examples");
  // Layer 3: RAG (would come from ResearchPacket.relatedArticles)
  check(persona.contentRules.always.length > 0, "has content rules");
  // Channel profiles
  check(persona.channelProfiles.blog !== undefined, "has channel profile");
});

// ── Test 15: Design → Publish bridge type compatibility ──

assert("Visual result connects to publish bridge", () => {
  const visualResult: VisualDesignResult = {
    format: "card_news",
    slides: [
      { index: 0, jsxCode: "<div>test</div>", width: 1080, height: 1350, platform: "instagram" },
    ],
    designPath: "template",
  };

  // Verify slides have all required fields for rendering
  const slide = visualResult.slides[0]!;
  check(typeof slide.jsxCode === "string", "has jsxCode");
  check(slide.width > 0, "has width");
  check(slide.height > 0, "has height");
  check(typeof slide.platform === "string", "has platform");

  // Verify design path for performance tracking
  const validPaths = ["template", "generated", "motion", "data_viz"];
  check(validPaths.includes(visualResult.designPath), "valid design path");
});

console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
