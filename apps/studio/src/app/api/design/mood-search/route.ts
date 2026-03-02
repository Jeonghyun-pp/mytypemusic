import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db";

// ── Types ────────────────────────────────────────────────

interface MoodAnalysis {
  scene: {
    subject: string;
    environment: string;
    objects: string[];
  };
  mood: {
    primary: string;
    secondary: string;
    emotionalTone: string;
  };
  visualTreatment: {
    lighting: string;
    colorTemperature: string;
    technique: string[];
    saturation: string;
  };
  colorAnalysis: {
    dominantColors: string[];
    colorFamily: string;
    unsplashColor: string;
    pexelsColor: string;
  };
  composition: {
    framing: string;
    perspective: string;
    focusArea: string;
  };
  fontMoodMatch: string;
  searchStrategies: {
    sceneMatch: string[];
    moodMatch: string[];
    aestheticMatch: string[];
  };
}

interface StockResult {
  provider: "unsplash" | "pexels";
  id: string;
  previewUrl: string;
  fullUrl: string;
  sourceUrl: string;
  author: string;
  width: number;
  height: number;
  matchStrategy: "scene" | "mood" | "aesthetic";
}

// ── Vision prompt ────────────────────────────────────────

const MOOD_ANALYSIS_PROMPT = `당신은 이미지의 시각적 분위기와 미학적 특성을 분석하여, 유사한 분위기의 스톡 사진을 찾기 위한 검색 전략을 수립하는 전문가입니다.

주어진 이미지를 아래 6가지 차원으로 분석하세요.

## 분석 차원

1. **scene** (장면 분석)
   - subject: 주요 피사체를 영어 구문으로 (3-8단어)
   - environment: 환경/배경 설명 영어 구문 (3-6단어)
   - objects: 화면에 보이는 주요 오브젝트 영어 키워드 배열 (3-6개)

2. **mood** (분위기 분석)
   - primary: 지배적 감정/분위기 영어 형용사 1개
   - secondary: 부차적 분위기 영어 형용사 1개
   - emotionalTone: 감정적 톤 영어 구문 (5-10단어)

3. **visualTreatment** (시각 처리)
   - lighting: 조명 특성 영어 구문 (3-6단어)
   - colorTemperature: "warm" | "cool" | "neutral" | "mixed"
   - technique: 촬영/후보정 기법 영어 키워드 배열 (2-4개, 예: "bokeh", "high contrast", "film grain", "long exposure")
   - saturation: "low" | "medium" | "high" | "desaturated"

4. **colorAnalysis** (색상 분석)
   - dominantColors: 지배적 색상 3-5개 #RRGGBB hex
   - colorFamily: 전체적 색감 영어 설명 (2-4단어, 예: "warm earth tones", "cool blue-gray")
   - unsplashColor: Unsplash API color 파라미터 값 (black_and_white | black | white | yellow | orange | red | purple | magenta | green | teal | blue 중 가장 가까운 것)
   - pexelsColor: Pexels API color 파라미터 값 (red | orange | yellow | green | turquoise | blue | violet | pink | brown | black | gray | white 중 가장 가까운 것)

5. **composition** (구도)
   - framing: "close-up" | "medium shot" | "wide shot" | "extreme wide"
   - perspective: 촬영 앵글 영어 구문 (2-4단어)
   - focusArea: "center" | "rule-of-thirds" | "edges" | "distributed"

6. **fontMoodMatch**: 이 이미지 분위기와 가장 어울리는 타이포그래피 무드
   ("bold-display" | "clean-sans" | "editorial" | "playful" | "minimal" | "impact")

## 검색 전략 수립

분석 결과를 바탕으로 3가지 검색 전략별 검색 쿼리를 생성하세요:

- **sceneMatch**: scene.subject + scene.environment 기반, 2개 쿼리 (각 3-5 영어 단어)
- **moodMatch**: mood + visualTreatment 기반, 2개 쿼리 (각 3-5 영어 단어)
- **aestheticMatch**: visualTreatment.technique + colorAnalysis 기반, 2개 쿼리 (각 3-5 영어 단어)

각 쿼리는 Unsplash/Pexels 검색에 최적화된 영어 구문이어야 합니다.
너무 구체적이면 결과가 없고, 너무 추상적이면 무관한 결과가 나옵니다.
적절한 구체성 수준을 유지하세요.

## 출력
JSON만 응답하세요 (추가 텍스트 없이):
{
  "scene": { "subject": "...", "environment": "...", "objects": [...] },
  "mood": { "primary": "...", "secondary": "...", "emotionalTone": "..." },
  "visualTreatment": { "lighting": "...", "colorTemperature": "...", "technique": [...], "saturation": "..." },
  "colorAnalysis": { "dominantColors": [...], "colorFamily": "...", "unsplashColor": "...", "pexelsColor": "..." },
  "composition": { "framing": "...", "perspective": "...", "focusArea": "..." },
  "fontMoodMatch": "...",
  "searchStrategies": {
    "sceneMatch": ["query1", "query2"],
    "moodMatch": ["query1", "query2"],
    "aestheticMatch": ["query1", "query2"]
  }
}`;

// ── Stock API search wrappers ────────────────────────────

async function searchUnsplash(
  query: string,
  color?: string,
): Promise<Omit<StockResult, "matchStrategy">[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];

  const params = new URLSearchParams({ query, per_page: "8" });
  if (color) params.set("color", color);

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?${params.toString()}`,
      { headers: { Authorization: `Client-ID ${key}` } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results: Array<{
        id: string;
        width: number;
        height: number;
        urls: { small: string; regular: string };
        links: { html: string };
        user: { name: string };
      }>;
    };
    return data.results.map((item) => ({
      provider: "unsplash" as const,
      id: item.id,
      previewUrl: item.urls.small,
      fullUrl: item.urls.regular,
      sourceUrl: item.links.html,
      author: item.user.name,
      width: item.width,
      height: item.height,
    }));
  } catch {
    return [];
  }
}

async function searchPexels(
  query: string,
  color?: string,
): Promise<Omit<StockResult, "matchStrategy">[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];

  const params = new URLSearchParams({ query, per_page: "8" });
  if (color) params.set("color", color);

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?${params.toString()}`,
      { headers: { Authorization: key } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      photos: Array<{
        id: number;
        width: number;
        height: number;
        url: string;
        photographer: string;
        src: { medium: string; large: string };
      }>;
    };
    return data.photos.map((p) => ({
      provider: "pexels" as const,
      id: String(p.id),
      previewUrl: p.src.medium,
      fullUrl: p.src.large,
      sourceUrl: p.url,
      author: p.photographer,
      width: p.width,
      height: p.height,
    }));
  } catch {
    return [];
  }
}

// ── Route handler ────────────────────────────────────────

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 },
    );
  }

  let body: { imageDataUri?: string };
  try {
    body = (await req.json()) as { imageDataUri?: string };
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with imageDataUri" },
      { status: 400 },
    );
  }

  const { imageDataUri } = body;
  if (!imageDataUri || typeof imageDataUri !== "string") {
    return NextResponse.json(
      { error: "imageDataUri is required" },
      { status: 400 },
    );
  }

  const client = new OpenAI({ apiKey });

  // ── Step 1: Vision analysis ───────────────────────────

  let analysis: MoodAnalysis;
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1500,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: MOOD_ANALYSIS_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageDataUri, detail: "low" },
            },
            {
              type: "text",
              text: "이 이미지의 분위기를 분석하고 검색 전략을 수립해주세요.",
            },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    analysis = JSON.parse(text) as MoodAnalysis;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Vision analysis failed: ${msg}` },
      { status: 502 },
    );
  }

  // ── Step 2: Build search queries per strategy ─────────

  const strategies = analysis.searchStrategies ?? {
    sceneMatch: [],
    moodMatch: [],
    aestheticMatch: [],
  };

  const queryItems: Array<{
    query: string;
    strategy: "scene" | "mood" | "aesthetic";
  }> = [
    ...((strategies.sceneMatch ?? []) as string[]).map((q) => ({
      query: q,
      strategy: "scene" as const,
    })),
    ...((strategies.moodMatch ?? []) as string[]).map((q) => ({
      query: q,
      strategy: "mood" as const,
    })),
    ...((strategies.aestheticMatch ?? []) as string[]).map((q) => ({
      query: q,
      strategy: "aesthetic" as const,
    })),
  ];

  // ── Step 3: Parallel stock searches ───────────────────

  const unsplashColor = analysis.colorAnalysis?.unsplashColor;
  const pexelsColor = analysis.colorAnalysis?.pexelsColor;

  const searchPromises = queryItems.map((item, i) => {
    const useUnsplash = i % 2 === 0;
    const search = useUnsplash
      ? searchUnsplash(item.query, unsplashColor)
      : searchPexels(item.query, pexelsColor);

    return search.then((results) =>
      results.map(
        (r): StockResult => ({ ...r, matchStrategy: item.strategy }),
      ),
    );
  });

  const settled = await Promise.allSettled(searchPromises);
  const allResults = settled
    .filter(
      (r): r is PromiseFulfilledResult<StockResult[]> =>
        r.status === "fulfilled",
    )
    .flatMap((r) => r.value);

  // Deduplicate by provider+id
  const seen = new Set<string>();
  const stockResults = allResults.filter((r) => {
    const key = `${r.provider}:${r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // ── Step 4: Internal DB search ────────────────────────

  const fontMood = analysis.fontMoodMatch ?? "";
  let internalResults: Array<{
    id: string;
    title: string;
    imageDataUri: string;
    fontMood: string;
    category: string;
  }> = [];

  if (fontMood) {
    try {
      const entries = await prisma.designEntry.findMany({
        where: { fontMood },
        take: 8,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          imageDataUri: true,
          fontMood: true,
          category: true,
        },
      });
      internalResults = entries;
    } catch {
      // DB query failure is non-fatal
    }
  }

  return NextResponse.json({
    analysis,
    stockResults,
    internalResults,
  });
}
