import OpenAI from "openai";
import { prisma } from "@/lib/db";

const openai = new OpenAI();

interface ChatRequest {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  accountId?: string;
}

// Cache analytics context for 1 hour per accountId
const analyticsContextCache = new Map<string, { text: string; ts: number }>();
const CONTEXT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getAnalyticsContext(accountId?: string): Promise<string> {
  const cacheKey = accountId ?? "__all__";
  const cached = analyticsContextCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CONTEXT_CACHE_TTL) {
    return cached.text;
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const accountFilter = accountId ? { snsAccountId: accountId } : {};

  const [snapshots, recentPubs, performances] = await Promise.all([
    prisma.analyticsSnapshot.findMany({
      where: { date: { gte: since }, ...accountFilter },
      orderBy: { date: "desc" },
      take: 30,
    }),
    prisma.publication.findMany({
      where: { publishedAt: { gte: since }, ...accountFilter },
      orderBy: { publishedAt: "desc" },
      take: 10,
    }),
    prisma.postPerformance.findMany({
      where: { publishedAt: { gte: since }, ...accountFilter },
      orderBy: { engagementRate: "desc" },
      take: 10,
    }),
  ]);

  const text = `
## Analytics Data (Last 30 Days)

### Snapshots (${snapshots.length} days):
${snapshots.slice(0, 10).map((s) =>
  `- ${s.date.toISOString().split("T")[0]}: followers=${s.followers}, reach=${s.reach}, engagement=${s.engagement}, rate=${(s.engagementRate * 100).toFixed(1)}%`
).join("\n")}

### Recent Publications (${recentPubs.length}):
${recentPubs.map((p) =>
  `- ${p.platform} [${p.status}]: "${((p.content as Record<string, unknown>)?.text as string ?? "").slice(0, 60)}..."`
).join("\n")}

### Top Performing Posts:
${performances.map((p) =>
  `- ${p.platform} ${p.publishedAt.toISOString().split("T")[0]}: views=${p.views}, likes=${p.likes}, comments=${p.comments}, rate=${(p.engagementRate * 100).toFixed(1)}%`
).join("\n")}
`;

  analyticsContextCache.set(cacheKey, { text, ts: Date.now() });

  // Evict old entries
  for (const [k, v] of analyticsContextCache) {
    if (Date.now() - v.ts > CONTEXT_CACHE_TTL) analyticsContextCache.delete(k);
  }

  return text;
}

/**
 * POST /api/analytics/chat — AI analytics chatbot.
 * Streams GPT responses with context from analytics data (cached 1h).
 */
export async function POST(req: Request) {
  const body = (await req.json()) as ChatRequest;
  const { messages } = body;

  const analyticsContext = await getAnalyticsContext(body.accountId);

  const systemPrompt = `You are an AI social media analytics assistant for a Korean content creator.
You have access to their SNS performance data. Answer questions about their performance,
trends, and provide actionable recommendations.

${analyticsContext}

Guidelines:
- Respond in Korean
- Be data-driven — reference specific numbers and dates
- Suggest actionable improvements
- Compare performance across platforms when relevant
- If data is insufficient, acknowledge it and suggest what data would help`;

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
