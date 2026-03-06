import { prisma } from "@/lib/db";
import { callGptJson } from "@/lib/llm";
import { fetchTrends, formatTrendsForPrompt } from "@/lib/trends";
import { json, serverError } from "@/lib/studio";
import { z } from "zod";
import { readFile } from "fs/promises";
import path from "path";

const SuggestionItemSchema = z.object({
  topic: z.string(),
  reasoning: z.string(),
  formats: z.object({
    sns: z.string(),
    blog: z.string(),
    carousel: z.string(),
  }),
});

const SuggestionSchema = z.object({
  suggestions: z.array(SuggestionItemSchema),
});

type SuggestionItem = z.infer<typeof SuggestionItemSchema>;

// In-memory cache (30 min) — separate for general and niche
interface CacheEntry {
  general: SuggestionItem[];
  niche: SuggestionItem[];
  nicheKeywords: string[];
  at: number;
}
let cache: CacheEntry | null = null;
const CACHE_TTL = 30 * 60 * 1000;

async function loadNicheKeywords(): Promise<string[]> {
  try {
    const raw = await readFile(
      path.join(process.cwd(), ".data", "niche-keywords.json"),
      "utf-8",
    );
    return (JSON.parse(raw) as { keywords: string[] }).keywords;
  } catch {
    return [];
  }
}

/**
 * GET /api/content/suggestions
 * Returns { general: [...], niche: [...], nicheKeywords: [...] }
 * - general: trend-based suggestions (anyone, any topic)
 * - niche: keyword-focused suggestions (music/band specific)
 */
export async function GET() {
  try {
    const nicheKeywords = await loadNicheKeywords();
    const nicheHash = nicheKeywords.sort().join("|");

    // Return cache if still fresh and keywords unchanged
    if (
      cache &&
      Date.now() - cache.at < CACHE_TTL &&
      cache.nicheKeywords.sort().join("|") === nicheHash
    ) {
      return json({
        general: cache.general,
        niche: cache.niche,
        nicheKeywords: cache.nicheKeywords,
      });
    }

    // Also gather autopilot keywords (merge with niche keywords for trend fetching)
    const configs = await prisma.autopilotConfig.findMany({
      where: { isActive: true },
      select: { topicKeywords: true },
    });
    const autopilotKws = [...new Set(configs.flatMap((c) => c.topicKeywords))];
    const allNicheKws = [...new Set([...nicheKeywords, ...autopilotKws])];

    // Fetch trends — global always, niche only if keywords exist
    const { global: globalTrends, niche: nicheTrends } = await fetchTrends(
      allNicheKws.length > 0 ? allNicheKws : undefined,
    );

    // Recent publications for personalization
    const recentPubs = await prisma.publication.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 10,
      select: { content: true },
    });
    const topTopics = recentPubs
      .map((p) => {
        const content = p.content as Record<string, unknown> | null;
        return (content?.text as string)?.slice(0, 80) ?? "";
      })
      .filter(Boolean)
      .slice(0, 5);

    const topTopicsSection =
      topTopics.length > 0
        ? `최근 인기 콘텐츠:\n${topTopics.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
        : "";

    // ── General line ──────────────────────────────────
    const generalTrendContext = formatTrendsForPrompt(globalTrends, []);
    const generalPrompt = `You are a content strategist for a Korean social media brand.

${generalTrendContext}

${topTopicsSection}

위 실시간 트렌드를 분석하여, 지금 가장 시의적절한 콘텐츠 주제 3개를 제안하세요.
다양한 분야(문화, 사회, 라이프스타일 등)에서 골고루 선정하세요.

Return JSON:
{
  "suggestions": [
    {
      "topic": "주제 제목 (Korean, concise)",
      "reasoning": "왜 지금 이 주제인지 1문장 (Korean)",
      "formats": {
        "sns": "SNS 포스트 미리보기 (1-2줄, Korean, 해시태그 포함)",
        "blog": "블로그 아웃라인 미리보기 (제목 + 핵심 포인트, Korean)",
        "carousel": "카드뉴스 컨셉 (몇 장, 핵심 메시지, Korean)"
      }
    }
  ]
}`;

    // ── Niche line ─────────────────────────────────────
    let nicheResults: SuggestionItem[] = [];

    if (allNicheKws.length > 0) {
      const nicheTrendContext = formatTrendsForPrompt(globalTrends, nicheTrends);
      const nichePrompt = `You are a content strategist for a Korean indie/band music web magazine.
전문 분야: ${allNicheKws.join(", ")}

일반 트렌드에서도 음악/밴드/공연과 연결할 수 있는 각도를 적극적으로 찾으세요.

${nicheTrendContext}

${topTopicsSection}

위 트렌드와 전문 분야 키워드를 교차 분석하여, 지금 가장 시의적절한 음악/밴드 관련 콘텐츠 주제 3개를 제안하세요.
반드시 전문 분야(${allNicheKws.join(", ")})와 관련된 주제만 제안하세요.

Return JSON:
{
  "suggestions": [
    {
      "topic": "주제 제목 (Korean, concise)",
      "reasoning": "왜 지금 이 주제인지 1문장 (Korean)",
      "formats": {
        "sns": "SNS 포스트 미리보기 (1-2줄, Korean, 해시태그 포함)",
        "blog": "블로그 아웃라인 미리보기 (제목 + 핵심 포인트, Korean)",
        "carousel": "카드뉴스 컨셉 (몇 장, 핵심 메시지, Korean)"
      }
    }
  ]
}`;

      const [generalResult, nicheResult] = await Promise.all([
        callGptJson(generalPrompt, { schema: SuggestionSchema, maxTokens: 1500 }),
        callGptJson(nichePrompt, { schema: SuggestionSchema, maxTokens: 1500 }),
      ]);

      cache = {
        general: generalResult.suggestions,
        niche: nicheResult.suggestions,
        nicheKeywords: allNicheKws,
        at: Date.now(),
      };
    } else {
      const generalResult = await callGptJson(generalPrompt, {
        schema: SuggestionSchema,
        maxTokens: 1500,
      });

      cache = {
        general: generalResult.suggestions,
        niche: [],
        nicheKeywords: [],
        at: Date.now(),
      };
    }

    return json({
      general: cache.general,
      niche: cache.niche,
      nicheKeywords: cache.nicheKeywords,
    });
  } catch (e) {
    return serverError(String(e));
  }
}
