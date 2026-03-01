/**
 * LLM Copy QA Module — OpenAI API-based content quality checks.
 *
 * Validates: Korean spelling/grammar, tone consistency,
 * fact accuracy (against topic-intel sources), narrative flow.
 *
 * Uses fetch-based OpenAI Chat Completions API (no SDK dependency).
 */
import { readFile } from "node:fs/promises";

// ============================================================================
// Types
// ============================================================================

export interface CopyIssue {
  severity: "error" | "warning";
  code: string;
  slideIndex?: number;
  message: string;
}

export interface CopyQaResult {
  passed: boolean;
  issues: CopyIssue[];
  suggestions: string[];
}

export interface CopyQaInput {
  slides: Array<{
    slideIndex: number;
    title: string;
    bodyText: string;
    kind: string;
  }>;
  caption: string;
  /** Path to topic-intel.json for fact verification (optional) */
  topicIntelPath?: string;
}

// ============================================================================
// OpenAI fetch client (no SDK)
// ============================================================================

const OPENAI_MODEL = "gpt-4o-mini";

type OpenAIResponse = {
  choices: Array<{ message: { content: string | null } }>;
};

async function callOpenAIMessages(params: {
  apiKey: string;
  system: string;
  userContent: string;
  maxTokens: number;
}): Promise<string> {
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: params.maxTokens,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.userContent },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as OpenAIResponse;
  return data.choices[0]?.message.content ?? "";
}

// ============================================================================
// LLM prompt
// ============================================================================

const SYSTEM_PROMPT = `당신은 인스타그램 카드뉴스 카피 QA 전문가입니다.
주어진 슬라이드 텍스트와 캡션을 검토하여 품질 이슈를 찾아주세요.

검사 항목:
1. SPELLING_ERROR: 한국어 맞춤법/오타 (예: "되"와 "돼" 혼용, 띄어쓰기 오류 등)
2. GRAMMAR_ERROR: 문법 오류 (예: 조사 오류, 어미 불일치)
3. TONE_INCONSISTENT: 슬라이드 간 톤/어체 불일치 (예: 한 슬라이드는 존댓말, 다른 슬라이드는 반말)
4. FACT_UNVERIFIED: 소스 데이터와 불일치하는 팩트 (소스가 제공된 경우에만)
5. NARRATIVE_BREAK: 슬라이드 간 논리 흐름 단절

반드시 아래 JSON 형식으로만 응답하세요:
{
  "issues": [
    {
      "severity": "error" | "warning",
      "code": "SPELLING_ERROR" | "GRAMMAR_ERROR" | "TONE_INCONSISTENT" | "FACT_UNVERIFIED" | "NARRATIVE_BREAK",
      "slideIndex": number | null,
      "message": "구체적인 설명"
    }
  ],
  "suggestions": ["개선 제안 1", "개선 제안 2"]
}

이슈가 없으면 빈 배열을 반환하세요. 심각한 맞춤법/문법 오류만 error로, 경미한 것은 warning으로 분류하세요.`;

function buildUserPrompt(input: CopyQaInput, keyFacts?: string[]): string {
  let prompt = "## 슬라이드 텍스트\n\n";

  for (const slide of input.slides) {
    prompt += `### 슬라이드 ${slide.slideIndex + 1} (${slide.kind})\n`;
    prompt += `제목: ${slide.title}\n`;
    prompt += `본문: ${slide.bodyText}\n\n`;
  }

  prompt += `## 캡션\n${input.caption}\n`;

  if (keyFacts && keyFacts.length > 0) {
    prompt += `\n## 소스 데이터 (팩트 검증용)\n`;
    for (const fact of keyFacts) {
      prompt += `- ${fact}\n`;
    }
  }

  return prompt;
}

// ============================================================================
// Main QA function
// ============================================================================

export async function runCopyQa(input: CopyQaInput): Promise<CopyQaResult> {
  // Load key facts from topic-intel if available
  let keyFacts: string[] | undefined;
  if (input.topicIntelPath) {
    try {
      const raw = await readFile(input.topicIntelPath, "utf-8");
      const intel = JSON.parse(raw);
      keyFacts = intel.keyFacts ?? intel.facts ?? [];
    } catch {
      // topic-intel not available — skip fact verification
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      passed: true,
      issues: [{
        severity: "warning",
        code: "COPY_QA_SKIPPED",
        message: "OPENAI_API_KEY가 설정되지 않아 카피 QA를 건너뜁니다.",
      }],
      suggestions: [],
    };
  }

  try {
    const text = await callOpenAIMessages({
      apiKey,
      system: SYSTEM_PROMPT,
      userContent: buildUserPrompt(input, keyFacts),
      maxTokens: 2048,
    });

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { passed: true, issues: [], suggestions: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      issues?: Array<{
        severity?: string;
        code?: string;
        slideIndex?: number | null;
        message?: string;
      }>;
      suggestions?: string[];
    };

    const issues: CopyIssue[] = (parsed.issues ?? [])
      .filter((i) => i.code && i.message)
      .map((i) => ({
        severity: (i.severity === "error" ? "error" : "warning") as "error" | "warning",
        code: i.code!,
        slideIndex: i.slideIndex ?? undefined,
        message: i.message!,
      }));

    return {
      passed: issues.every((i) => i.severity !== "error"),
      issues,
      suggestions: parsed.suggestions ?? [],
    };
  } catch (err) {
    return {
      passed: true,
      issues: [{
        severity: "warning",
        code: "COPY_QA_ERROR",
        message: `카피 QA 실행 중 오류: ${err instanceof Error ? err.message : String(err)}`,
      }],
      suggestions: [],
    };
  }
}
