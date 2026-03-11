import { prisma } from "@/lib/db";
import { callGptJson, callGptSafe } from "@/lib/llm";
import { enqueueJob } from "@/lib/jobs/queue";
import { z } from "zod";
import type { JobHandler } from "../types";

/**
 * Comment monitor job: checks for new comments/DMs on connected accounts,
 * classifies them, and applies auto-reply rules.
 * Runs every 5 minutes via Vercel Cron.
 */
export const commentMonitorHandler: JobHandler = {
  type: "comment_monitor",
  async handle() {
    // Process unclassified messages
    const unclassified = await prisma.incomingMessage.findMany({
      where: { classification: null },
      take: 20,
    });

    let classified = 0;
    let autoReplied = 0;

    for (const msg of unclassified) {
      // Classify with GPT
      const classification = await classifyMessage(msg.body);
      await prisma.incomingMessage.update({
        where: { id: msg.id },
        data: {
          classification: classification.type,
          sentiment: classification.sentiment,
          priority: classification.priority,
          processedAt: new Date(),
        },
      });
      classified++;

      // Check auto-reply rules
      const rules = await prisma.autoReplyRule.findMany({
        where: { snsAccountId: msg.snsAccountId, isActive: true },
      });

      for (const rule of rules) {
        if (!matchesRule(rule, classification, msg.body)) continue;

        let replyText: string;
        if (rule.useAi) {
          replyText = await generateAiReply(msg.body, msg.senderName, rule.aiInstructions ?? "");
        } else {
          replyText = rule.replyTemplate.replace(/\{\{senderName\}\}/g, msg.senderName);
        }

        await prisma.incomingMessage.update({
          where: { id: msg.id },
          data: { autoReplyText: replyText },
        });

        // Enqueue actual reply posting via platform API
        await enqueueJob({
          type: "reply_send",
          payload: { messageId: msg.id },
        });
        autoReplied++;
        break; // Only apply first matching rule
      }
    }

    return { classified, autoReplied, total: unclassified.length };
  },
};

interface Classification {
  type: string;
  sentiment: string;
  priority: string;
}

const classificationSchema = z.object({
  type: z.enum(["question", "praise", "complaint", "spam", "other"]).default("other"),
  sentiment: z.enum(["positive", "neutral", "negative"]).default("neutral"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

async function classifyMessage(body: string): Promise<Classification> {
  const prompt = `Classify this social media message. Return JSON only:
{ "type": "question|praise|complaint|spam|other", "sentiment": "positive|neutral|negative", "priority": "low|normal|high|urgent" }

Message: "${body.slice(0, 500)}"`;

  try {
    return await callGptJson(prompt, { caller: "comment-monitor", schema: classificationSchema, temperature: 0.3 }) as Classification;
  } catch {
    return { type: "other", sentiment: "neutral", priority: "normal" };
  }
}

function matchesRule(
  rule: { triggerType: string; triggerValue: string },
  classification: Classification,
  body: string,
): boolean {
  switch (rule.triggerType) {
    case "classification":
      return classification.type === rule.triggerValue;
    case "sentiment":
      return classification.sentiment === rule.triggerValue;
    case "keyword":
      return body.toLowerCase().includes(rule.triggerValue.toLowerCase());
    case "all":
      return true;
    default:
      return false;
  }
}

async function generateAiReply(
  originalMessage: string,
  senderName: string,
  instructions: string,
): Promise<string> {
  const prompt = `Generate a friendly, professional reply to this social media comment/message.

Original message from ${senderName}: "${originalMessage.slice(0, 500)}"

${instructions ? `Additional instructions: ${instructions}` : ""}

Reply in the same language as the original message. Keep it concise (1-3 sentences). Return ONLY the reply text.`;

  return callGptSafe(prompt, { caller: "comment-monitor", temperature: 0.7 });
}
