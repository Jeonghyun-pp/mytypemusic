import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password } = (await req.json()) as { password?: string };
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) {
    // No password configured — allow access
    return NextResponse.json({ ok: true });
  }

  if (password !== sitePassword) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("site-auth", sitePassword, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
