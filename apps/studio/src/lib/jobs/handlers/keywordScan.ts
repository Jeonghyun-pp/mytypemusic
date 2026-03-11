import { prisma } from "@/lib/db";
import { callGpt } from "@/lib/llm";
import { getValidToken } from "@/lib/sns/tokenManager";
import { getSearchAdapter } from "@/lib/sns/search";
import { enqueueJob } from "../queue";
import type { JobHandler } from "../types";

/**
 * Keyword scan job: searches for posts matching campaign keywords,
 * generates contextual AI comments, and enqueues posting jobs.
 * Runs every 15-30 minutes via Vercel Cron during operating hours.
 */
export const keywordScanHandler: JobHandler = {
  type: "keyword_scan",
  async handle() {
    const now = new Date();
    const currentHour = now.getHours();

    const campaigns = await prisma.keywordCampaign.findMany({
      where: { isActive: true, tosWarningAcked: true },
    });

    let totalGenerated = 0;

    for (const campaign of campaigns) {
      if (currentHour < campaign.operatingStart || currentHour >= campaign.operatingEnd) continue;
      if (campaign.todayCount >= campaign.dailyLimit) continue;

      for (const platform of campaign.platforms) {
        if (campaign.todayCount >= campaign.dailyLimit) break;

        const searchAdapter = getSearchAdapter(platform);
        if (!searchAdapter) continue;

        // Get the account token for searching
        const account = await prisma.snsAccount.findFirst({
          where: { id: campaign.snsAccountId, platform, isActive: true },
        });
        if (!account) {
          // Try any active account for this platform
          const anyAccount = await prisma.snsAccount.findFirst({
            where: { platform, isActive: true },
          });
          if (!anyAccount) continue;
        }

        const accountId = account?.id ?? campaign.snsAccountId;
        let accessToken: string;
        try {
          accessToken = await getValidToken(accountId);
        } catch {
          continue;
        }

        // Search for matching posts
        let posts;
        try {
          posts = await searchAdapter.searchPosts(accessToken, campaign.keywords, 5);
        } catch {
          continue;
        }

        if (!posts.length) continue;

        // Filter out posts we've already commented on
        const existingLogs = await prisma.keywordCommentLog.findMany({
          where: {
            campaignId: campaign.id,
            targetPostUrl: { in: posts.map((p) => p.postUrl) },
          },
          select: { targetPostUrl: true },
        });
        const existingUrls = new Set(existingLogs.map((l) => l.targetPostUrl));
        const newPosts = posts.filter((p) => !existingUrls.has(p.postUrl));

        for (const post of newPosts) {
          if (campaign.todayCount >= campaign.dailyLimit) break;

          const commentText =
            campaign.commentMode === "template"
              ? (campaign.commentTemplate ?? "")
              : await generateKeywordComment(
                  campaign.keywords,
                  campaign.aiInstructions ?? "",
                  post.text,
                );

          if (!commentText) continue;

          // Create log with real post data
          const log = await prisma.keywordCommentLog.create({
            data: {
              campaignId: campaign.id,
              platform,
              targetPostId: post.postId,
              targetPostUrl: post.postUrl,
              targetPostText: post.text,
              commentText,
              status: "pending",
            },
          });

          // Schedule posting with random delay
          const delay =
            campaign.minDelaySec +
            Math.random() * (campaign.maxDelaySec - campaign.minDelaySec);

          await enqueueJob({
            type: "keyword_comment_post",
            payload: {
              logId: log.id,
              snsAccountId: accountId,
            },
            scheduledAt: new Date(Date.now() + delay * 1000),
          });

          await prisma.keywordCampaign.update({
            where: { id: campaign.id },
            data: { todayCount: campaign.todayCount + 1 },
          });
          campaign.todayCount++;
          totalGenerated++;
        }
      }
    }

    return { campaignsProcessed: campaigns.length, commentsGenerated: totalGenerated };
  },
};

async function generateKeywordComment(
  keywords: string[],
  instructions: string,
  postText: string,
): Promise<string> {
  const prompt = `Generate a natural, engaging comment for this social media post:

"${postText.slice(0, 500)}"

Keywords of interest: ${keywords.join(", ")}

${instructions ? `Style instructions: ${instructions}` : "Be helpful and relevant."}

The comment should:
- Be 1-2 sentences
- Sound natural and human
- Be in Korean
- Add value to the conversation
- Be relevant to the specific post content
- NOT be spammy or promotional

Return ONLY the comment text.`;

  return callGpt(prompt, { caller: "keyword-scan", temperature: 0.8 });
}
