import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { SlideStyleOverrides } from "@/lib/studio/designEditor/types";

// ── Vision prompt ────────────────────────────────────────

const SYSTEM_PROMPT = `당신은 인스타그램 카드뉴스 디자인 분석 전문가입니다.
주어진 레퍼런스 이미지를 분석하여, 디자인 스타일 오버라이드를 JSON으로 추출합니다.

## 분석 항목

1. **bgGradient**: CSS linear-gradient 문자열 (배경 그라디언트). 이미지에서 지배적인 색상들로 구성.
2. **textColor**: 주요 텍스트 색상 (hex)
3. **accentColor**: 강조/악센트 색상 (hex)
4. **footerColor**: 푸터 텍스트 색상 (rgba, 투명도 포함)
5. **titleSizePx**: 제목 크기 추정 (20-120)
6. **bodySizePx**: 본문 크기 추정 (16-80)
7. **titleWeight**: 제목 굵기 (400-900)
8. **bodyWeight**: 본문 굵기 (400-900)
9. **letterSpacing**: "tight" | "normal" | "wide"
10. **cardRadius**: 카드 모서리 반경 추정 (0-48)

## 규칙
- 여러 이미지가 주어지면 공통 스타일을 추출하세요.
- 색상은 반드시 #RRGGBB hex 형식으로 출력하세요 (footerColor만 rgba 허용).
- 불확실한 항목은 생략하세요 (optional 필드).
- 반드시 JSON만 응답하세요, 다른 텍스트 없이.

## 출력 형식
{
  "bgGradient": "linear-gradient(160deg, #... 0%, #... 50%, #... 100%)",
  "textColor": "#ffffff",
  "accentColor": "#...",
  "footerColor": "rgba(255,255,255,0.7)",
  "titleWeight": 800,
  "bodyWeight": 400,
  "letterSpacing": "normal",
  "cardRadius": 24
}`;

// ── StyleOverrides parser ────────────────────────────────

function parseStyleOverrides(raw: Record<string, unknown>): SlideStyleOverrides {
  const result: SlideStyleOverrides = {};

  if (typeof raw.bgGradient === "string") result.bgGradient = raw.bgGradient;
  if (typeof raw.textColor === "string") result.textColor = raw.textColor;
  if (typeof raw.accentColor === "string") result.accentColor = raw.accentColor;
  if (typeof raw.footerColor === "string") result.footerColor = raw.footerColor;

  if (typeof raw.titleSizePx === "number" && raw.titleSizePx >= 20 && raw.titleSizePx <= 120)
    result.titleSizePx = raw.titleSizePx;
  if (typeof raw.bodySizePx === "number" && raw.bodySizePx >= 16 && raw.bodySizePx <= 80)
    result.bodySizePx = raw.bodySizePx;
  if (typeof raw.titleWeight === "number" && raw.titleWeight >= 400 && raw.titleWeight <= 900)
    result.titleWeight = raw.titleWeight;
  if (typeof raw.bodyWeight === "number" && raw.bodyWeight >= 400 && raw.bodyWeight <= 900)
    result.bodyWeight = raw.bodyWeight;

  if (raw.letterSpacing === "tight" || raw.letterSpacing === "normal" || raw.letterSpacing === "wide")
    result.letterSpacing = raw.letterSpacing;

  if (typeof raw.cardRadius === "number" && raw.cardRadius >= 0 && raw.cardRadius <= 48)
    result.cardRadius = raw.cardRadius;

  return result;
}

// ── Route handler ────────────────────────────────────────

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  // Collect image files
  const imageDataUris: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("image") || !(value instanceof File)) continue;
    if (imageDataUris.length >= 3) break;

    const buffer = Buffer.from(await value.arrayBuffer());
    const mime = value.type || "image/png";
    imageDataUris.push(`data:${mime};base64,${buffer.toString("base64")}`);
  }

  if (imageDataUris.length === 0) {
    return NextResponse.json({ error: "At least one image is required" }, { status: 400 });
  }

  const client = new OpenAI({ apiKey });

  // Build vision messages with image_url content parts
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `${String(imageDataUris.length)}장의 레퍼런스 이미지를 분석해주세요. 공통된 디자인 스타일을 추출하여 JSON으로 응답해주세요.`,
    },
    ...imageDataUris.map((uri) => ({
      type: "image_url" as const,
      image_url: { url: uri, detail: "low" as const },
    })),
  ];

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON from model", raw: text }, { status: 502 });
    }

    const styleOverrides = parseStyleOverrides(parsed);

    return NextResponse.json({ styleOverrides, raw: parsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
