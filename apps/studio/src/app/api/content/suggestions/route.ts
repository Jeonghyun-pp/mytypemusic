import { prisma } from "@/lib/db";
import { callGptJson } from "@/lib/llm";
import { fetchTrends, formatEnrichedTrendsForPrompt, enrichTrends } from "@/lib/trends";
import { json, serverError } from "@/lib/studio";
import { z } from "zod";

const SourceSchema = z.object({
  label: z.string(),
  url: z.string().optional(),
});

// LLM sometimes returns an object instead of a string for format fields — coerce to string
const coerceString = z.preprocess(
  (v) => (typeof v === "object" && v !== null ? JSON.stringify(v) : v),
  z.string(),
);

const SuggestionItemSchema = z.object({
  topic: z.string(),
  reasoning: z.string(),
  sources: z.array(SourceSchema).optional().default([]),
  formats: z.object({
    sns: coerceString,
    blog: coerceString,
    carousel: coerceString,
  }),
});

const SuggestionSchema = z.object({
  suggestions: z.array(SuggestionItemSchema),
});

interface SuggestionSource {
  label: string;
  url?: string;
}

interface SuggestionItem {
  topic: string;
  reasoning: string;
  sources?: SuggestionSource[];
  formats: {
    sns: string;
    blog: string;
    carousel: string;
  };
}

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
  const row = await prisma.setting.findUnique({ where: { key: "niche-keywords" } });
  if (!row) return [];
  const data = row.value as { keywords?: string[] };
  return data.keywords ?? [];
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

    // Enrich trends with real-time context
    const allRaw = [...globalTrends, ...nicheTrends];
    const enriched = await enrichTrends(allRaw);
    const enrichedGlobal = enriched.filter((t) => !nicheTrends.some((n) => n.title === t.title));
    const enrichedNiche = enriched.filter((t) => nicheTrends.some((n) => n.title === t.title));

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
    const generalTrendContext = formatEnrichedTrendsForPrompt(enrichedGlobal, []);
    const generalPrompt = `You are a content strategist for a Korean social media brand.

${generalTrendContext}

${topTopicsSection}

위 실시간 트렌드를 분석하여, 지금 가장 시의적절한 콘텐츠 주제 3개를 제안하세요.
다양한 분야(문화, 사회, 라이프스타일 등)에서 골고루 선정하세요.
각 제안의 근거가 된 트렌드 데이터의 출처(sources)를 반드시 포함하세요. 트렌드 항목에 URL이 있으면 그대로 포함하세요.

Return JSON:
{
  "suggestions": [
    {
      "topic": "주제 제목 (Korean, concise)",
      "reasoning": "왜 지금 이 주제인지 1문장 (Korean)",
      "sources": [{"label": "출처 설명 (예: Google 트렌드 — 검색어)", "url": "원문 URL (있으면)"}],
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
      const nicheTrendContext = formatEnrichedTrendsForPrompt(enrichedGlobal, enrichedNiche);
      const nichePrompt = `You are a content strategist for a Korean indie/band music web magazine.
전문 분야: ${allNicheKws.join(", ")}

일반 트렌드에서도 음악/밴드/공연과 연결할 수 있는 각도를 적극적으로 찾으세요.

${nicheTrendContext}

${topTopicsSection}

위 트렌드와 전문 분야 키워드를 교차 분석하여, 지금 가장 시의적절한 음악/밴드 관련 콘텐츠 주제 3개를 제안하세요.
반드시 전문 분야(${allNicheKws.join(", ")})와 관련된 주제만 제안하세요.
각 제안의 근거가 된 트렌드 데이터의 출처(sources)를 반드시 포함하세요. 트렌드 항목에 URL이 있으면 그대로 포함하세요.

Return JSON:
{
  "suggestions": [
    {
      "topic": "주제 제목 (Korean, concise)",
      "reasoning": "왜 지금 이 주제인지 1문장 (Korean)",
      "sources": [{"label": "출처 설명 (예: Spotify 신보 — 앨범명)", "url": "원문 URL (있으면)"}],
      "formats": {
        "sns": "SNS 포스트 미리보기 (1-2줄, Korean, 해시태그 포함)",
        "blog": "블로그 아웃라인 미리보기 (제목 + 핵심 포인트, Korean)",
        "carousel": "카드뉴스 컨셉 (몇 장, 핵심 메시지, Korean)"
      }
    }
  ]
}`;

      const [generalRes, nicheRes] = await Promise.allSettled([
        callGptJson(generalPrompt, { caller: "suggestions", schema: SuggestionSchema, maxTokens: 1500, timeoutMs: 25_000 }),
        callGptJson(nichePrompt, { caller: "suggestions", schema: SuggestionSchema, maxTokens: 1500, timeoutMs: 25_000 }),
      ]);

      if (generalRes.status === "rejected") console.error("[suggestions] general LLM failed:", generalRes.reason);
      if (nicheRes.status === "rejected") console.error("[suggestions] niche LLM failed:", nicheRes.reason);

      cache = {
        general: generalRes.status === "fulfilled" ? generalRes.value.suggestions : [],
        niche: nicheRes.status === "fulfilled" ? nicheRes.value.suggestions : [],
        nicheKeywords: allNicheKws,
        at: Date.now(),
      };
    } else {
      const generalResult = await callGptJson(generalPrompt, {
        caller: "suggestions",
        schema: SuggestionSchema,
        maxTokens: 1500,
        timeoutMs: 25_000,
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
    console.error("[suggestions] Error:", e);
    return serverError(String(e));
  }
}
