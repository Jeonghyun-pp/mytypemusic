import { NextResponse } from "next/server";

/**
 * GET /api/health/suggestions-debug
 * Step-by-step diagnostic for the suggestions API.
 * No auth required (excluded via /api/health prefix).
 */
export async function GET() {
  const steps: Record<string, unknown> = {};

  // Step 1: DB connection
  try {
    const { prisma } = await import("@/lib/db");
    await prisma.setting.findFirst();
    steps.db = "ok";
  } catch (e) {
    steps.db = String(e);
    return NextResponse.json({ steps, failed: "db" });
  }

  // Step 2: Redis / cache
  try {
    const { cacheGet } = await import("@/lib/redis");
    await cacheGet("test");
    steps.redis = "ok (or fallback)";
  } catch (e) {
    steps.redis = String(e);
    return NextResponse.json({ steps, failed: "redis" });
  }

  // Step 3: Trend providers import
  try {
    const trends = await import("@/lib/trends");
    steps.trendsImport = "ok";
    steps.hasFetchTrends = typeof trends.fetchTrends === "function";
    steps.hasEnrichTrends = typeof trends.enrichTrends === "function";
  } catch (e) {
    steps.trendsImport = String(e);
    return NextResponse.json({ steps, failed: "trendsImport" });
  }

  // Step 4: Fetch trends (quick test)
  try {
    const { fetchTrends } = await import("@/lib/trends");
    const result = await fetchTrends();
    steps.fetchTrends = { global: result.global.length, niche: result.niche.length };
  } catch (e) {
    steps.fetchTrends = String(e);
    return NextResponse.json({ steps, failed: "fetchTrends" });
  }

  // Step 5: LLM call
  try {
    const { callGptJson } = await import("@/lib/llm");
    const result = await callGptJson('Return JSON: {"test": true}', {
      caller: "health-check",
      maxTokens: 50,
      timeoutMs: 15_000,
    });
    steps.llm = { ok: true, result };
  } catch (e) {
    steps.llm = String(e);
    return NextResponse.json({ steps, failed: "llm" });
  }

  return NextResponse.json({ steps, failed: null });
}
