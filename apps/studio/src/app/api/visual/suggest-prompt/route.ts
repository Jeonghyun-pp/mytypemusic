import { NextResponse } from "next/server";
import { callGptJson } from "@/lib/llm";

/**
 * POST /api/visual/suggest-prompt
 *
 * Generates 3 image prompt variations from topic/mood/style context.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      topic?: string;
      bodyText?: string;
      mood?: string;
      style?: string;
      paletteColors?: string[];
    };

    const { topic, bodyText, mood, style, paletteColors } = body;
    if (!topic && !bodyText) {
      return NextResponse.json(
        { error: "topic 또는 bodyText가 필요합니다" },
        { status: 400 },
      );
    }

    const colorHint = paletteColors?.length
      ? `Color palette to reference: ${paletteColors.join(", ")}`
      : "";

    const result = await callGptJson<{ prompts: { prompt: string; label: string }[] }>(
      `You are an expert image prompt engineer for AI image generators (DALL-E 3, Flux).
Generate 3 distinct image prompt variations for a magazine visual.

Context:
- Topic: ${topic ?? "(derived from body text)"}
${bodyText ? `- Body text excerpt: ${bodyText.slice(0, 300)}` : ""}
${mood ? `- Mood: ${mood}` : ""}
${style ? `- Style direction: ${style}` : ""}
${colorHint}

Rules:
- NO text, letters, words, typography, or logos in the image
- Each variation should have a distinctly different visual approach
- Focus on composition, lighting, colors, subjects, and atmosphere
- Keep each prompt under 150 words
- Images should work as backgrounds with text overlay
- Variation 1: photographic / realistic approach
- Variation 2: artistic / abstract / conceptual approach
- Variation 3: editorial / minimal / clean approach

Return JSON:
{
  "prompts": [
    { "label": "포토그래피", "prompt": "..." },
    { "label": "아트/추상", "prompt": "..." },
    { "label": "에디토리얼", "prompt": "..." }
  ]
}`,
      { model: "gpt-4o-mini", temperature: 0.9 },
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
