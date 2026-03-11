import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { analyticsCollect } from "@/lib/inngest/functions/analytics";
import { commentFetch } from "@/lib/inngest/functions/comments";
import { autopilotScan } from "@/lib/inngest/functions/autopilot";
import { publishContent } from "@/lib/inngest/functions/publish";
import { keywordScan, dailyReset } from "@/lib/inngest/functions/keywords";
import { personaLearn } from "@/lib/inngest/functions/persona";
import { replySend } from "@/lib/inngest/functions/reply";
import { keywordCommentPost } from "@/lib/inngest/functions/keyword-comment";
import { onboardAnalyze } from "@/lib/inngest/functions/onboard";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    analyticsCollect,
    commentFetch,
    autopilotScan,
    publishContent,
    keywordScan,
    dailyReset,
    personaLearn,
    replySend,
    keywordCommentPost,
    onboardAnalyze,
  ],
});
