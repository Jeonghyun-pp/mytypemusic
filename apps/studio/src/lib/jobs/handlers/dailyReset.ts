import { prisma } from "@/lib/db";
import type { JobHandler } from "../types";

/**
 * Resets todayCount for all keyword campaigns.
 * Triggered daily at midnight KST via Vercel Cron.
 */
export const dailyResetHandler: JobHandler = {
  type: "daily_reset",
  async handle() {
    const result = await prisma.keywordCampaign.updateMany({
      where: { todayCount: { gt: 0 } },
      data: { todayCount: 0 },
    });
    return { campaignsReset: result.count };
  },
};
