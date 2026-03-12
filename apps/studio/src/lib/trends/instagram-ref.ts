/**
 * Instagram Reference Feed trend provider.
 *
 * Reads from the ReferenceFeed table (pre-synced by the reference_feed_sync job).
 * No external API call at trend-fetch time — pure DB read.
 */

import { prisma } from "@/lib/db";
import type { TrendItem, TrendProvider } from "./types";

const LOOKBACK_HOURS = 48;
const MAX_ITEMS = 30;

export const instagramRefProvider: TrendProvider = {
  name: "instagram-ref",

  async fetch(opts) {
    const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
    const keywords = opts?.keywords ?? [];

    const feeds = await prisma.referenceFeed.findMany({
      where: {
        timestamp: { gte: since },
        account: { isActive: true },
        ...(keywords.length > 0
          ? {
              OR: keywords.map((kw) => ({
                caption: { contains: kw, mode: "insensitive" as const },
              })),
            }
          : {}),
      },
      include: {
        account: { select: { username: true, category: true } },
      },
      orderBy: { timestamp: "desc" },
      take: MAX_ITEMS,
    });

    // Sort by engagement score (comments weighted 3x)
    const sorted = feeds.sort(
      (a, b) =>
        b.likeCount + b.commentsCount * 3 - (a.likeCount + a.commentsCount * 3),
    );

    return sorted.map((f, i): TrendItem => {
      // First line of caption as title (up to 80 chars)
      const firstLine = (f.caption || "").split("\n")[0]?.slice(0, 80) ?? "";
      const title = `@${f.account.username}: ${firstLine}`;

      // Full caption (truncated) + engagement as description
      const captionPreview = (f.caption || "").slice(0, 300);
      const engagement = `❤️ ${f.likeCount.toLocaleString()} 💬 ${f.commentsCount.toLocaleString()}`;
      const description = `${captionPreview}\n${engagement} | ${f.account.category}`;

      // Match which keyword triggered this result
      const matchedKeyword = keywords.find((kw) =>
        (f.caption || "").toLowerCase().includes(kw.toLowerCase()),
      );

      return {
        title,
        source: "instagram-ref",
        url: f.permalink,
        description,
        rank: i + 1,
        keyword: matchedKeyword,
        fetchedAt: f.timestamp,
      };
    });
  },
};
