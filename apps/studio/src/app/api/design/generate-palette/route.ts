import { NextResponse } from "next/server";
import OpenAI from "openai";

// ── Vision prompt ────────────────────────────────────────

const SYSTEM_PROMPT = `당신은 색채 분석 전문가입니다.
주어진 이미지에서 지배적인 색상을 분석하여, 카드뉴스 디자인에 적합한 5색 팔레트를 JSON으로 추출합니다.

## 추출할 5색

1. **background**: 메인 배경색 — 이미지에서 가장 넓은 면적의 색상을 기반으로 디자인 배경으로 적합한 색
2. **primary**: 주요 영역 색상 — background보다 약간 진하거나 연한 톤 변형
3. **secondary**: 보조 영역 색상 — 이미지의 두 번째 지배색
4. **accent**: 강조 포인트 색상 — 이미지에서 눈에 띄는 포인트 컬러
5. **textColor**: 텍스트 색상 — background 위에서 가독성이 좋은 색 (밝은 배경→어두운 텍스트, 어두운 배경→밝은 텍스트)

## 규칙
- 모든 색상은 #RRGGBB hex 형식으로 출력하세요.
- footerColor는 textColor의 50% 불투명도 rgba 버전으로 생성하세요.
- name은 팔레트의 느낌을 한두 단어 영어로 지어주세요 (e.g. "Sunset Coral", "Forest Calm").
- 반드시 JSON만 응답하세요, 다른 텍스트 없이.

## 출력 형식
{
  "name": "Palette Name",
  "background": "#...",
  "primary": "#...",
  "secondary": "#...",
  "accent": "#...",
  "textColor": "#...",
  "footerColor": "rgba(...,...,...,0.5)"
}`;

// ── Hex validation ───────────────────────────────────────

function isHex(val: unknown): val is string {
  return typeof val === "string" && /^#[0-9A-Fa-f]{6}$/.test(val);
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

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const imageDataUri = body.imageDataUri;
  if (typeof imageDataUri !== "string" || !imageDataUri.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "imageDataUri is required (data:image/... format)" },
      { status: 400 },
    );
  }

  // Reject oversized images (4MB base64 ≈ 3MB raw)
  const MAX_DATA_URI_LENGTH = 4 * 1024 * 1024;
  if (imageDataUri.length > MAX_DATA_URI_LENGTH) {
    return NextResponse.json(
      { error: "Image too large (max 4MB)" },
      { status: 413 },
    );
  }

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "이 이미지에서 카드뉴스 디자인용 5색 팔레트를 추출해주세요.",
            },
            {
              type: "image_url",
              image_url: { url: imageDataUri, detail: "low" },
            },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from model", raw: text },
        { status: 502 },
      );
    }

    // Validate required hex fields
    const { background, primary, secondary, accent, textColor } = parsed;
    if (!isHex(background) || !isHex(primary) || !isHex(secondary) || !isHex(accent) || !isHex(textColor)) {
      return NextResponse.json(
        { error: "Model returned invalid color values", raw: parsed },
        { status: 502 },
      );
    }

    const palette = {
      id: "ai-generated",
      name: typeof parsed.name === "string" ? parsed.name : "AI Palette",
      background,
      primary,
      secondary,
      accent,
      textColor,
      footerColor:
        typeof parsed.footerColor === "string"
          ? parsed.footerColor
          : `rgba(${String(parseInt(textColor.slice(1, 3), 16))},${String(parseInt(textColor.slice(3, 5), 16))},${String(parseInt(textColor.slice(5, 7), 16))},0.5)`,
    };

    return NextResponse.json({ palette });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
