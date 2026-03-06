import { json, serverError } from "@/lib/studio";
import { collectDueMetrics } from "@/lib/pipeline/feedback-collector";
import { runFeedbackAnalysis, checkGuardrails } from "@/lib/pipeline/feedback-analyzer";

/**
 * GET /api/pipeline/feedback — Get guardrail status and analysis overview.
 */
export async function GET() {
  try {
    const guardrails = await checkGuardrails();
    return json({ guardrails });
  } catch (e) {
    return serverError(String(e));
  }
}

/**
 * POST /api/pipeline/feedback — Trigger feedback collection + analysis.
 *
 * Body:
 *   { "action": "collect" }  — collect due metrics only
 *   { "action": "analyze" }  — run full feedback analysis
 *   { "action": "all" }      — both (default)
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = (body.action as string) ?? "all";

    const result: Record<string, unknown> = {};

    if (action === "collect" || action === "all") {
      result.collection = await collectDueMetrics();
    }

    if (action === "analyze" || action === "all") {
      result.analysis = await runFeedbackAnalysis();
    }

    return json(result);
  } catch (e) {
    return serverError(String(e));
  }
}
