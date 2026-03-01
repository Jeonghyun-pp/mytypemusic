// ============================================================================
// Types
// ============================================================================

export interface GenerateAnglesLLMParams {
  normalizedTopic: string;
  category: "music" | "lifestyle" | undefined;
  depth: "news" | "explainer" | "analysis";
  keyFacts: string[];
  coverageHint?: string;
  templateExamples: string[];
  recentAngles: string[];
  maxAngles?: number;
}

export interface GenerateEvergreenAnglesLLMParams {
  normalizedTopic: string;
  category: "music" | "lifestyle" | undefined;
  keyFacts: string[];
  templateExamples: string[];
  recentAngles: string[];
  maxAngles?: number;
}

// ── OpenAI fetch client (lightweight, no SDK) ──────────────────

const OPENAI_MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 15_000;

type OpenAIResponse = {
  choices: Array<{ message: { content: string | null } }>;
};

async function callOpenAI(params: {
  apiKey: string;
  system: string;
  user: string;
}): Promise<string> {
  const baseUrl = process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 1024,
        temperature: 1.0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as OpenAIResponse;
    return data.choices[0]?.message.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

// ── Prompt ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `당신은 인스타그램 카드뉴스 앵글 전문가입니다.
주어진 토픽과 핵심 사실을 분석하여, 독자의 관심을 끌 수 있는 차별화된 앵글(콘텐츠 절입 각도)을 생성합니다.

## 규칙
1. 앵글은 짧고 구체적이어야 합니다 (15-40자)
2. 각 앵글은 서로 다른 관점/절입 방식이어야 합니다
3. 카테고리(음악/라이프스타일 등)에 맞는 톤을 사용하세요
4. "참고 예시"의 형식과 톤을 참고하되, 내용은 토픽에 맞게 새로 만드세요
5. "최근 사용된 앵글"과 유사한 앵글은 피하세요 — 표현, 구조, 관점 모두 다르게

## 출력 형식
JSON만 반환:
{ "angles": ["앵글1", "앵글2", ...] }`;

function buildUserPrompt(params: {
  normalizedTopic: string;
  category: string | undefined;
  depth: string;
  keyFacts: string[];
  coverageHint?: string;
  templateExamples: string[];
  recentAngles: string[];
  maxAngles: number;
}): string {
  const lines: string[] = [
    `## 토픽: ${params.normalizedTopic}`,
    `- 카테고리: ${params.category ?? "일반"}`,
    `- 깊이: ${params.depth}`,
  ];

  if (params.coverageHint) {
    lines.push(`- 커버리지: ${params.coverageHint}`);
  }

  if (params.keyFacts.length > 0) {
    lines.push("", "## 핵심 사실");
    for (const fact of params.keyFacts.slice(0, 8)) {
      lines.push(`- ${fact}`);
    }
  }

  lines.push("", "## 참고 예시 (형식/톤 참고, 그대로 복사 금지)");
  for (const example of params.templateExamples.slice(0, 6)) {
    lines.push(`- ${example}`);
  }

  if (params.recentAngles.length > 0) {
    lines.push("", "## 최근 1주일 사용된 앵글 (이와 유사한 앵글 피하기)");
    for (const angle of params.recentAngles.slice(0, 15)) {
      lines.push(`- ${angle}`);
    }
  }

  lines.push("", `${params.maxAngles}개의 차별화된 앵글을 생성하세요.`);

  return lines.join("\n");
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Generate diverse angle candidates using LLM.
 * Falls back to template-based generation if OpenAI API is unavailable.
 */
export async function generateAnglesWithLLM(
  params: GenerateAnglesLLMParams,
): Promise<string[]> {
  const maxAngles = params.maxAngles ?? 8;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[angles-llm] OPENAI_API_KEY not set — falling back to templates");
    return params.templateExamples.slice(0, maxAngles);
  }

  try {
    const userPrompt = buildUserPrompt({
      normalizedTopic: params.normalizedTopic,
      category: params.category,
      depth: params.depth,
      keyFacts: params.keyFacts,
      coverageHint: params.coverageHint,
      templateExamples: params.templateExamples,
      recentAngles: params.recentAngles,
      maxAngles,
    });

    const rawText = await callOpenAI({
      apiKey,
      system: SYSTEM_PROMPT,
      user: userPrompt,
    });

    const parsed = JSON.parse(rawText) as { angles?: string[] };
    const angles = parsed.angles;

    if (!Array.isArray(angles) || angles.length === 0) {
      throw new Error("LLM returned empty angles array");
    }

    // Filter out empty strings, trim, and limit
    return angles
      .map((a) => String(a).trim())
      .filter((a) => a.length > 0)
      .slice(0, maxAngles);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[angles-llm] LLM angle generation failed, falling back to templates: ${msg}`);
    return params.templateExamples.slice(0, maxAngles);
  }
}

/**
 * Generate diverse evergreen angle candidates using LLM.
 * Falls back to template-based generation if OpenAI API is unavailable.
 */
export async function generateEvergreenAnglesWithLLM(
  params: GenerateEvergreenAnglesLLMParams,
): Promise<string[]> {
  const maxAngles = params.maxAngles ?? 8;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[angles-llm] OPENAI_API_KEY not set — falling back to templates");
    return params.templateExamples.slice(0, maxAngles);
  }

  try {
    const userPrompt = buildUserPrompt({
      normalizedTopic: params.normalizedTopic,
      category: params.category,
      depth: "explainer", // evergreen topics are always explainer-depth
      keyFacts: params.keyFacts,
      templateExamples: params.templateExamples,
      recentAngles: params.recentAngles,
      maxAngles,
    });

    const rawText = await callOpenAI({
      apiKey,
      system: SYSTEM_PROMPT,
      user: userPrompt,
    });

    const parsed = JSON.parse(rawText) as { angles?: string[] };
    const angles = parsed.angles;

    if (!Array.isArray(angles) || angles.length === 0) {
      throw new Error("LLM returned empty angles array");
    }

    return angles
      .map((a) => String(a).trim())
      .filter((a) => a.length > 0)
      .slice(0, maxAngles);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[angles-llm] LLM evergreen angle generation failed, falling back: ${msg}`);
    return params.templateExamples.slice(0, maxAngles);
  }
}
