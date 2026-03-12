import { NextResponse } from "next/server";

/** GET /api/health — deployment check + optional diagnostics */
export async function GET(req: Request) {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown";
  const envCheck = {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    DATABASE_URL: !!process.env.DATABASE_URL,
    REDIS_URL: !!process.env.REDIS_URL,
    SPOTIFY_CLIENT_ID: !!process.env.SPOTIFY_CLIENT_ID,
    INSTAGRAM_USER_ID: !!process.env.INSTAGRAM_USER_ID,
  };

  const url = new URL(req.url);
  if (url.searchParams.get("diag") !== "1") {
    return NextResponse.json({ ok: true, commit: commit.slice(0, 7), env: envCheck });
  }

  // ── Diagnostic mode ──
  const steps: Record<string, unknown> = { commit: commit.slice(0, 7), env: envCheck };

  // Step 1: DB
  try {
    const { prisma } = await import("@/lib/db");
    const count = await prisma.setting.count();
    steps.db = `ok (${count} settings)`;
  } catch (e) {
    steps.db = String(e).slice(0, 300);
    return NextResponse.json({ steps, failed: "db" });
  }

  // Step 2: Trends import + fetch
  try {
    const { fetchTrends } = await import("@/lib/trends");
    const result = await fetchTrends();
    steps.trends = { global: result.global.length, niche: result.niche.length };
  } catch (e) {
    steps.trends = String(e).slice(0, 300);
    return NextResponse.json({ steps, failed: "trends" });
  }

  // Step 3: LLM call (minimal)
  try {
    const { callGptJson } = await import("@/lib/llm");
    const result = await callGptJson('Return JSON: {"ok": true}', {
      caller: "health-diag",
      maxTokens: 20,
      timeoutMs: 15_000,
    });
    steps.llm = result;
  } catch (e) {
    steps.llm = String(e).slice(0, 500);
    return NextResponse.json({ steps, failed: "llm" });
  }

  return NextResponse.json({ steps, failed: null });
}
