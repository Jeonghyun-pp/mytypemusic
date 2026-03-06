import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/studio";
import { callGptJson } from "@/lib/llm";
import { z } from "zod";

const topicsSchema = z.object({
  topics: z.array(
    z.object({
      topic: z.string(),
      reason: z.string(),
    }),
  ),
});

/**
 * GET /api/analytics/top-topics — Extract top-performing topics from recent posts.
 * Returns topics with highest engagement for content planning.
 */
export async function GET() {
  try {
    // Get top-performing posts from last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const topPerformances = await prisma.postPerformance.findMany({
      where: { publishedAt: { gte: since } },
      orderBy: { engagementRate: "desc" },
      take: 10,
    });

    if (!topPerformances.length) {
      return json({ topics: [] });
    }

    // Get the publication content for these posts
    const pubIds = topPerformances
      .map((p) => p.publicationId)
      .filter(Boolean) as string[];

    const publications = await prisma.publication.findMany({
      where: { id: { in: pubIds } },
    });

    const textsWithRate = publications
      .map((pub) => {
        const perf = topPerformances.find((p) => p.publicationId === pub.id);
        const text = ((pub.content as Record<string, unknown>)?.text as string) ?? "";
        return { text: text.slice(0, 300), rate: perf?.engagementRate ?? 0 };
      })
      .filter((t) => t.text.length > 10);

    if (textsWithRate.length < 2) {
      return json({ topics: [] });
    }

    // Use GPT to extract topic keywords from top posts
    const prompt = `다음은 참여율이 높은 상위 SNS 게시물들입니다. 이 게시물들에서 공통 주제 3개를 추출하세요.

${textsWithRate.map((t, i) => `${i + 1}. (참여율 ${(t.rate * 100).toFixed(1)}%) ${t.text}`).join("\n\n")}

JSON으로 반환:
{ "topics": [{ "topic": "주제 키워드 (5단어 이내)", "reason": "왜 반응이 좋았는지 한 줄 설명" }] }
최대 3개. JSON만 반환하세요.`;

    const result = await callGptJson(prompt, {
      schema: topicsSchema,
      temperature: 0.3,
    });

    // Add engagement data
    const avgRate = textsWithRate.reduce((s, t) => s + t.rate, 0) / textsWithRate.length;

    return json({
      topics: result.topics.slice(0, 3).map((t) => ({
        ...t,
        avgEngagementRate: avgRate,
        postCount: textsWithRate.length,
      })),
      period: { days: 30, postsAnalyzed: textsWithRate.length },
    });
  } catch (e) {
    return serverError(String(e));
  }
}
