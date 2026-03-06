import { prisma } from "@/lib/db";
import { callGptJson } from "@/lib/llm";
import { fetchTrends, formatTrendsForPrompt } from "@/lib/trends";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonInput = any;

interface ProposalDraft {
  topic: string;
  reasoning: string;
  text: string;
  hashtags: string[];
  platform: string;
}

/**
 * Scan trends and generate content proposals for an autopilot config.
 * Called by the autopilot_scan job.
 */
export async function generateProposals(configId: string): Promise<number> {
  const config = await prisma.autopilotConfig.findUnique({
    where: { id: configId },
  });
  if (!config || !config.isActive) return 0;

  // Get persona if set
  let personaContext = "";
  if (config.personaId) {
    const persona = await prisma.writingPersona.findUnique({
      where: { id: config.personaId },
    });
    if (persona) {
      personaContext = `\n\nWriting Persona:\n- Name: ${persona.name}\n- Tone: ${JSON.stringify(persona.tone)}\n- Style: ${persona.styleFingerprint}\n- Vocabulary: ${JSON.stringify(persona.vocabulary)}`;
    }
  }

  // Count today's pending/approved/published proposals
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = await prisma.autopilotProposal.count({
    where: {
      autopilotConfigId: configId,
      createdAt: { gte: todayStart },
      status: { in: ["pending", "approved", "published"] },
    },
  });
  const remaining = config.postsPerDay - todayCount;
  if (remaining <= 0) return 0;

  // Fetch real trend data
  const { global: globalTrends, niche: nicheTrends } = await fetchTrends(
    config.topicKeywords.length > 0 ? config.topicKeywords : undefined,
  );
  const trendContext = formatTrendsForPrompt(globalTrends, nicheTrends);

  // Generate proposals for each platform
  const proposals: ProposalDraft[] = [];
  for (const platform of config.platforms) {
    if (proposals.length >= remaining) break;

    const prompt = `You are a social media content strategist. Generate a content proposal for ${platform}.

Topic keywords: ${config.topicKeywords.join(", ") || "general trends"}

${trendContext}
${personaContext}

위 실시간 트렌드 데이터와 주제 키워드를 교차 분석하여, 지금 가장 시의적절한 콘텐츠를 제안하세요.
트렌드와 키워드가 겹치는 주제를 우선 선택하세요.

Return a JSON object with:
- topic: brief topic title (Korean)
- reasoning: why this topic will perform well NOW, referencing specific trend data (Korean, 1-2 sentences)
- text: the actual post content ready to publish (Korean, appropriate length for ${platform})
- hashtags: array of 3-5 relevant hashtags (without # prefix)

Respond ONLY with the JSON object.`;

    try {
      const parsed = await callGptJson(prompt, {
        schema: z.object({
          topic: z.string().default("Untitled"),
          reasoning: z.string().default(""),
          text: z.string().default(""),
          hashtags: z.array(z.string()).default([]),
        }),
      });
      proposals.push({ ...parsed, platform });
    } catch {
      // Skip if parsing/API fails
    }
  }

  // Save proposals
  for (const p of proposals) {
    await prisma.autopilotProposal.create({
      data: {
        autopilotConfigId: configId,
        topic: p.topic,
        reasoning: p.reasoning,
        content: { text: p.text, hashtags: p.hashtags } as JsonInput,
        platform: p.platform,
        personaId: config.personaId ?? null,
        status: config.approvalMode === "auto" ? "approved" : "pending",
      },
    });
  }

  return proposals.length;
}

/**
 * Publish approved proposals that are due.
 */
export async function publishApprovedProposals(): Promise<number> {
  const approved = await prisma.autopilotProposal.findMany({
    where: {
      status: "approved",
      OR: [
        { scheduledAt: null },
        { scheduledAt: { lte: new Date() } },
      ],
    },
    take: 5,
  });

  let published = 0;
  for (const proposal of approved) {
    const config = await prisma.autopilotConfig.findUnique({
      where: { id: proposal.autopilotConfigId },
    });
    if (!config) continue;

    try {
      // Create a publication and publish
      const content = proposal.content as Record<string, unknown>;
      const pub = await prisma.publication.create({
        data: {
          snsAccountId: config.snsAccountId,
          platform: proposal.platform,
          content: content as JsonInput,
          personaId: config.personaId ?? null,
          status: "draft",
        },
      });

      // Import publishNow dynamically to avoid circular deps
      const { publishNow } = await import("@/lib/sns/publish");
      await publishNow(pub.id);

      await prisma.autopilotProposal.update({
        where: { id: proposal.id },
        data: {
          status: "published",
          publishedAt: new Date(),
          publicationId: pub.id,
        },
      });
      published++;
    } catch {
      // Don't fail the whole batch
    }
  }

  return published;
}
