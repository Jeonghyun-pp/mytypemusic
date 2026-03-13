/**
 * Brand Kit CRUD API
 *
 * GET  /api/design/brand-kit?userId=xxx  → load user's default brand kit
 * POST /api/design/brand-kit             → save/update brand kit
 */

import { NextResponse } from "next/server";
import { loadBrandKit, saveBrandKit, DEFAULT_BRAND_KIT } from "@/lib/design/brand-kit";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(DEFAULT_BRAND_KIT);
  }

  const kit = await loadBrandKit(userId);
  return NextResponse.json(kit);
}

export async function POST(req: Request) {
  let body: { userId: string; kit: Record<string, unknown> };
  try {
    body = (await req.json()) as { userId: string; kit: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    await saveBrandKit(body.userId, body.kit as never);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
