/**
 * Legal QA Module — pre-publish legal conflict detection.
 *
 * Rule engine + LLM for:
 *   - Image license re-verification
 *   - Trademark/brand name usage detection
 *   - Celebrity/public figure compliance
 *   - Copyright content overlap detection
 *   - Sensitive keyword scanning
 *
 * Uses fetch-based OpenAI Chat Completions API (no SDK dependency).
 */
import { readFile } from "node:fs/promises";

// ============================================================================
// Types
// ============================================================================

export interface LegalIssue {
  severity: "block" | "warn";
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface LegalQaResult {
  passed: boolean;
  blocked: boolean;
  issues: LegalIssue[];
  riskScore: number;
}

export interface LegalQaInput {
  slides: Array<{
    slideIndex: number;
    title: string;
    bodyText: string;
  }>;
  caption: string;
  /** Path to validated-post.json from Agent 1 */
  validatedPostPath?: string;
  /** Path to topic-intel.json for copyright overlap check */
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
// Sensitive keyword lists (from topic-intelligence/phase1/risk/notes.ts)
// ============================================================================

const SENSITIVE_KEYWORDS: Record<string, string[]> = {
  politics: ["대통령", "정치", "선거", "탄핵", "정당", "국회", "여당", "야당"],
  hate_crime: ["혐오", "폭행", "살인", "마약", "범죄", "테러", "자살", "학대"],
  rumor: ["루머", "폭로", "논란", "의혹", "스캔들"],
};

// ============================================================================
// Rule-based checks
// ============================================================================

function checkSensitiveKeywords(text: string): LegalIssue[] {
  const issues: LegalIssue[] = [];
  for (const [category, keywords] of Object.entries(SENSITIVE_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        issues.push({
          severity: "warn",
          code: "SENSITIVE_KEYWORD",
          message: `민감 키워드 감지: "${kw}" (카테고리: ${category})`,
          details: { keyword: kw, category },
        });
      }
    }
  }
  return issues;
}

async function checkImageLicenses(validatedPostPath: string): Promise<LegalIssue[]> {
  const issues: LegalIssue[] = [];

  try {
    const raw = await readFile(validatedPostPath, "utf-8");
    const post = JSON.parse(raw);

    if (post.allowed === false) {
      issues.push({
        severity: "block",
        code: "IMAGE_LICENSE_BLOCKED",
        message: "이미지 라이선스 검증 실패: validated-post에서 allowed=false",
        details: { overallRiskScore: post.overallRiskScore },
      });
    }

    if (post.overallRiskScore !== undefined && post.overallRiskScore >= 60) {
      issues.push({
        severity: "block",
        code: "IMAGE_HIGH_RISK",
        message: `이미지 리스크 스코어가 ${post.overallRiskScore}으로 임계값(60)을 초과합니다.`,
        details: { overallRiskScore: post.overallRiskScore },
      });
    }

    // Check attribution requirements
    if (post.attribution) {
      const attr = post.attribution;
      if (attr.required && (!attr.text || attr.text.trim() === "")) {
        issues.push({
          severity: "block",
          code: "IMAGE_NO_ATTRIBUTION",
          message: "이미지 라이선스에 필수 저작권 표기(attribution)가 누락되었습니다.",
        });
      }
    }

    // Check individual images
    if (Array.isArray(post.images)) {
      for (const img of post.images) {
        if (img.riskScore !== undefined && img.riskScore >= 60) {
          issues.push({
            severity: "warn",
            code: "IMAGE_INDIVIDUAL_RISK",
            message: `이미지 "${img.query ?? img.sourceUrl ?? "unknown"}"의 리스크 스코어: ${img.riskScore}`,
            details: { riskScore: img.riskScore },
          });
        }
      }
    }
  } catch {
    // File not found or parse error — non-blocking
    issues.push({
      severity: "warn",
      code: "IMAGE_LICENSE_UNAVAILABLE",
      message: "validated-post.json을 읽을 수 없어 이미지 라이선스 재검증을 건너뜁니다.",
    });
  }

  return issues;
}

/**
 * Simple n-gram overlap check between source text and slide text.
 * Returns overlap ratio (0-1).
 */
function computeNgramOverlap(sourceText: string, slideText: string, n: number = 3): number {
  if (!sourceText || !slideText) return 0;

  const normalize = (text: string) =>
    text.replace(/\s+/g, " ").trim().toLowerCase();

  const source = normalize(sourceText);
  const slide = normalize(slideText);

  if (slide.length < n * 2) return 0;

  const sourceNgrams = new Set<string>();
  for (let i = 0; i <= source.length - n; i++) {
    sourceNgrams.add(source.slice(i, i + n));
  }

  let matchCount = 0;
  let totalCount = 0;
  for (let i = 0; i <= slide.length - n; i++) {
    totalCount++;
    if (sourceNgrams.has(slide.slice(i, i + n))) {
      matchCount++;
    }
  }

  return totalCount > 0 ? matchCount / totalCount : 0;
}

async function checkCopyrightOverlap(
  slides: LegalQaInput["slides"],
  topicIntelPath: string,
): Promise<LegalIssue[]> {
  const issues: LegalIssue[] = [];

  try {
    const raw = await readFile(topicIntelPath, "utf-8");
    const intel = JSON.parse(raw);

    // Collect source article texts
    const sourceTexts: string[] = [];
    if (Array.isArray(intel.sources)) {
      for (const src of intel.sources) {
        if (src.body) sourceTexts.push(src.body);
        if (src.summary) sourceTexts.push(src.summary);
      }
    }

    if (sourceTexts.length === 0) return issues;

    const combinedSource = sourceTexts.join(" ");

    for (const slide of slides) {
      const slideText = `${slide.title} ${slide.bodyText}`;
      const overlap = computeNgramOverlap(combinedSource, slideText, 4);

      if (overlap > 0.5) {
        issues.push({
          severity: "block",
          code: "COPYRIGHT_OVERLAP",
          message: `슬라이드 ${slide.slideIndex + 1}의 텍스트가 소스 기사와 ${(overlap * 100).toFixed(0)}% 유사합니다. 과도한 인용으로 판단됩니다.`,
          details: { slideIndex: slide.slideIndex, overlapRatio: overlap },
        });
      } else if (overlap > 0.3) {
        issues.push({
          severity: "warn",
          code: "COPYRIGHT_OVERLAP",
          message: `슬라이드 ${slide.slideIndex + 1}의 텍스트가 소스 기사와 ${(overlap * 100).toFixed(0)}% 유사합니다. 표현을 더 변형하는 것을 권장합니다.`,
          details: { slideIndex: slide.slideIndex, overlapRatio: overlap },
        });
      }
    }
  } catch {
    // topic-intel not available — skip
  }

  return issues;
}

// ============================================================================
// LLM-based trademark/celebrity check
// ============================================================================

const LEGAL_SYSTEM_PROMPT = `당신은 콘텐츠 법적 리스크 검토 전문가입니다.
주어진 텍스트에서 다음을 찾아주세요:

1. TRADEMARK_MENTION: 등록 상표명의 무단 사용 (예: 특정 브랜드명을 일반 명사처럼 사용)
2. CELEBRITY_COMMERCIAL: 유명인(연예인, 운동선수 등)의 이름/초상을 상업적 맥락에서 사용

응답 형식 (JSON만):
{
  "issues": [
    {
      "severity": "warn",
      "code": "TRADEMARK_MENTION" | "CELEBRITY_COMMERCIAL",
      "message": "구체적인 설명"
    }
  ]
}

음악 관련 콘텐츠에서 아티스트/앨범명을 언급하는 것은 정보 제공 목적이므로 일반적으로 허용됩니다.
상업적 추천이나 보증(endorsement)으로 오해될 수 있는 표현만 지적하세요.
이슈가 없으면 빈 배열을 반환하세요.`;

async function checkTrademarkAndCelebrity(
  fullText: string,
): Promise<LegalIssue[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  try {
    const text = await callOpenAIMessages({
      apiKey,
      system: LEGAL_SYSTEM_PROMPT,
      userContent: fullText,
      maxTokens: 1024,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as {
      issues?: Array<{
        severity?: string;
        code?: string;
        message?: string;
      }>;
    };

    return (parsed.issues ?? [])
      .filter((i) => i.code && i.message)
      .map((i) => ({
        severity: "warn" as const,
        code: i.code!,
        message: i.message!,
      }));
  } catch {
    return [];
  }
}

// ============================================================================
// Main QA function
// ============================================================================

export async function runLegalQa(input: LegalQaInput): Promise<LegalQaResult> {
  const allIssues: LegalIssue[] = [];

  // 1. Sensitive keyword check (synchronous)
  const allText = [
    ...input.slides.map((s) => `${s.title} ${s.bodyText}`),
    input.caption,
  ].join(" ");
  allIssues.push(...checkSensitiveKeywords(allText));

  // 2. Image license re-verification
  if (input.validatedPostPath) {
    allIssues.push(...await checkImageLicenses(input.validatedPostPath));
  }

  // 3. Copyright overlap check
  if (input.topicIntelPath) {
    allIssues.push(...await checkCopyrightOverlap(input.slides, input.topicIntelPath));
  }

  // 4. Trademark/celebrity check (LLM)
  allIssues.push(...await checkTrademarkAndCelebrity(allText));

  // Calculate risk score
  let riskScore = 0;
  for (const issue of allIssues) {
    if (issue.severity === "block") riskScore += 30;
    else riskScore += 10;
  }
  riskScore = Math.min(riskScore, 100);

  const blocked = allIssues.some((i) => i.severity === "block");

  return {
    passed: !blocked,
    blocked,
    issues: allIssues,
    riskScore,
  };
}
