import { json, serverError } from "@/lib/studio";
import { discoverTopics, getTrendGrowth } from "@/lib/pipeline/topic-intelligence";
import type { ContentType } from "@/lib/pipeline";

/**
 * GET /api/content/topics — Discover ranked topic briefs from trend analysis.
 *
 * Query params:
 *   keywords     — comma-separated seed keywords (optional)
 *   contentTypes — comma-separated: blog,sns,carousel,review (optional)
 *   count        — number of topics to return (default 10)
 *   brand        — brand/domain context string (optional)
 *   audience     — target audience description (optional)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const keywords = searchParams.get("keywords")?.split(",").filter(Boolean);
    const contentTypes = searchParams.get("contentTypes")?.split(",").filter(Boolean) as ContentType[] | undefined;
    const count = Number(searchParams.get("count")) || 10;
    const brandContext = searchParams.get("brand") ?? undefined;
    const audienceContext = searchParams.get("audience") ?? undefined;

    const topics = await discoverTopics({
      keywords,
      contentTypes,
      count,
      brandContext,
      audienceContext,
    });

    return json({
      topics,
      meta: {
        count: topics.length,
        explorationCount: topics.filter((t) => t.isExploration).length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    return serverError(String(e));
  }
}

/**
 * POST /api/content/topics — Same as GET but with body for complex inputs.
 *
 * Body:
 *   { keywords, contentTypes, count, brandContext, audienceContext, explorationRatio }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const topics = await discoverTopics({
      keywords: body.keywords as string[] | undefined,
      contentTypes: body.contentTypes as ContentType[] | undefined,
      count: (body.count as number) ?? 10,
      explorationRatio: (body.explorationRatio as number) ?? 0.2,
      brandContext: body.brandContext as string | undefined,
      audienceContext: body.audienceContext as string | undefined,
    });

    return json({
      topics,
      meta: {
        count: topics.length,
        explorationCount: topics.filter((t) => t.isExploration).length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    return serverError(String(e));
  }
}
