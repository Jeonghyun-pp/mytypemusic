import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db";

// ── Visual analysis prompt ───────────────────────────────

const VISUAL_ANALYSIS_PROMPT = `당신은 인스타그램 매거진 콘텐츠를 전문적으로 분석하는 편집 전략 컨설턴트입니다.
주어진 스크린샷들은 경쟁 매거진의 피드 캡처입니다.

## 분석 목적
경쟁 매거진의 콘텐츠 전략을 구체적 패턴과 수치로 추출하여,
우리 매거진에 실질적으로 적용할 수 있는 인사이트를 도출합니다.

## 분석 항목 (모두 필수)

### 1. slideComposition (슬라이드 구성)
- estimatedAvgSlides: 추정 평균 슬라이드 수 (숫자)
- slideProgression: 슬라이드 진행 패턴 (예: "hook → context → fact × 2 → summary → CTA")
- coverSlide: { layout: string, hasLogo: boolean, hasCategoryLabel: boolean, headlineStyle: string, exampleHeadlines: string[] }
- bodySlides: { dominantLayouts: string[], textDensity: string, bulletVsList: string }
- closingSlide: { type: string, ctaText: string, hasFollowPrompt: boolean }
- imageToTextRatio: "NN:NN" 형식

### 2. writingStyle (글쓰기 스타일)
- overallTone: 영어 단어 조합 (예: "conversational-authoritative")
- toneDescription: 한국어 한 문장으로 톤 설명
- formality: 존댓말/반말/혼합 여부
- personPOV: 사용되는 인칭
- hookStrategy: { type: string, examples: string[] } — 첫 문장 패턴
- sentencePatterns: { avgLength: string, structure: string }
- emojiUsage: { density: string, purpose: string, favorites: string[] }
- hashtagStrategy: { count: string, mix: string, placement: string }
- captionStyle: { length: string, structure: string }

### 3. visualDesign (시각 디자인)
- dominantColors: 주요 색상 3-6개 #RRGGBB
- colorStrategy: 색상 전략 한국어 설명
- typographyStyle: { headlineFont: string, bodyFont: string, sizeContrast: string }
- photoTreatment: { style: string, filters: string[], cropStyle: string }
- brandElements: { logo: string, colorCoding: string, consistentElements: string[] }

### 4. insights (인사이트)
- strengths: 강점 3가지 (한국어, 각 30자 이내로 구체적)
- weaknesses: 약점 2가지 (한국어, 각 30자 이내)
- applicableIdeas: 우리 매거진에 적용 가능한 아이디어 3가지 (한국어, 각 50자 이내, 구체적 실행 방법 포함)

## 규칙
- 모호한 표현 금지. "잘 만들었다", "깔끔하다" 대신 구체적 패턴과 수치를 제시.
- exampleHeadlines, hookStrategy.examples 등은 스크린샷에서 실제 관찰된 텍스트 기반.
- 관찰할 수 없는 항목은 "unknown" 또는 null로 명시. 추측하지 마세요.
- 여러 스크린샷에서 반복되는 패턴에 집중하세요.

JSON만 응답하세요.`;

// ── Text analysis prompt ─────────────────────────────────

const TEXT_ANALYSIS_PROMPT = `당신은 인스타그램 매거진의 글쓰기 스타일을 분석하는 전문가입니다.
주어진 텍스트 콘텐츠(캡션, 본문 등)를 분석하여 글쓰기 패턴을 추출하세요.

## 분석 항목

### linguisticAnalysis
- vocabularyLevel: 어휘 수준 설명 (한국어)
- speechLevel: 존댓말/반말/혼합 패턴 (한국어, 예시 포함)
- rhetoricalDevices: 사용된 수사법 배열 (한국어)
- transitionPatterns: 문장 연결 패턴 (한국어)
- brandVoiceProfile: 브랜드 보이스 한 문장 요약 (한국어)

### contentStructure
- informationDensity: 정보 밀도 설명 (한국어)
- factToOpinionRatio: "NN:NN" 형식
- sourceAttribution: 출처 표기 패턴 (한국어)

### replicablePatterns
- hookTemplate: 훅 템플릿 (한국어, 예: "[질문형 도발] + [왜 지금인지 설명]")
- bodyTemplate: 본문 템플릿 (한국어)
- closingTemplate: 마무리 템플릿 (한국어)

JSON만 응답하세요.`;

// ── Route handler ────────────────────────────────────────

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  // Collect screenshots (up to 10)
  const imageDataUris: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("image") || !(value instanceof File)) continue;
    if (imageDataUris.length >= 10) break;
    const buffer = Buffer.from(await value.arrayBuffer());
    const mime = value.type || "image/png";
    imageDataUris.push(`data:${mime};base64,${buffer.toString("base64")}`);
  }

  const textContent = (formData.get("textContent") as string | null) ?? "";
  const source = (formData.get("source") as string | null) ?? "";
  const title =
    (formData.get("title") as string | null) ||
    `리서치 ${new Date().toISOString().slice(0, 10)}`;

  if (imageDataUris.length === 0 && !textContent.trim()) {
    return NextResponse.json(
      { error: "At least one image or text content is required" },
      { status: 400 },
    );
  }

  const client = new OpenAI({ apiKey });

  // ── Stage 1 & 2: Run in parallel ──────────────────────

  const tasks: Array<Promise<Record<string, unknown> | null>> = [];

  // Stage 1: Visual analysis (if images provided)
  if (imageDataUris.length > 0) {
    const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      {
        type: "text",
        text: `${String(imageDataUris.length)}장의 경쟁 매거진 스크린샷을 분석해주세요.`,
      },
      ...imageDataUris.map(
        (uri) =>
          ({
            type: "image_url" as const,
            image_url: { url: uri, detail: "low" as const },
          }) satisfies OpenAI.Chat.Completions.ChatCompletionContentPart,
      ),
    ];

    tasks.push(
      client.chat.completions
        .create({
          model: "gpt-4o",
          max_tokens: 3000,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: VISUAL_ANALYSIS_PROMPT },
            { role: "user", content: contentParts },
          ],
        })
        .then((r) => {
          const raw = r.choices[0]?.message?.content ?? "{}";
          return JSON.parse(raw) as Record<string, unknown>;
        })
        .catch(() => null),
    );
  } else {
    tasks.push(Promise.resolve(null));
  }

  // Stage 2: Text analysis (if text provided)
  if (textContent.trim()) {
    tasks.push(
      client.chat.completions
        .create({
          model: "gpt-4o-mini",
          max_tokens: 2000,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: TEXT_ANALYSIS_PROMPT },
            { role: "user", content: textContent },
          ],
        })
        .then((r) => {
          const raw = r.choices[0]?.message?.content ?? "{}";
          return JSON.parse(raw) as Record<string, unknown>;
        })
        .catch(() => null),
    );
  } else {
    tasks.push(Promise.resolve(null));
  }

  let visualResult: Record<string, unknown> | null = null;
  let textResult: Record<string, unknown> | null = null;

  try {
    const results = await Promise.all(tasks);
    visualResult = results[0] ?? null;
    textResult = results[1] ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Analysis failed: ${msg}` },
      { status: 502 },
    );
  }

  // ── Save to DB ────────────────────────────────────────

  // Only store first 5 screenshots to keep DB size manageable
  const storedScreenshots = imageDataUris.slice(0, 5).map((uri, i) => ({
    dataUri: uri,
    label: `Screenshot ${String(i + 1)}`,
  }));

  // Cast to Prisma-compatible JSON (InputJsonValue)
  const toJson = (v: unknown) =>
    v != null ? (JSON.parse(JSON.stringify(v)) as object) : undefined;

  let report;
  try {
    report = await prisma.benchmarkReport.create({
      data: {
        title,
        source,
        imageCount: imageDataUris.length,
        slideComposition: toJson(visualResult?.slideComposition),
        writingStyle: toJson(visualResult?.writingStyle),
        visualDesign: toJson(visualResult?.visualDesign),
        insights: toJson(visualResult?.insights),
        rawAnalysis: toJson({ visual: visualResult, text: textResult }),
        screenshots: toJson(storedScreenshots),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to save report: ${msg}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    reportId: report.id,
    slideComposition: visualResult?.slideComposition ?? null,
    writingStyle: visualResult?.writingStyle ?? null,
    visualDesign: visualResult?.visualDesign ?? null,
    insights: visualResult?.insights ?? null,
    textAnalysis: textResult,
  });
}
