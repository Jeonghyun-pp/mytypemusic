import { NextResponse } from "next/server";

/** GET /api/health — deployment sanity check (no auth required) */
export async function GET() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown";
  const envCheck = {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    DATABASE_URL: !!process.env.DATABASE_URL,
    REDIS_URL: !!process.env.REDIS_URL,
    SPOTIFY_CLIENT_ID: !!process.env.SPOTIFY_CLIENT_ID,
    INSTAGRAM_USER_ID: !!process.env.INSTAGRAM_USER_ID,
  };
  return NextResponse.json({ ok: true, commit: commit.slice(0, 7), env: envCheck });
}
