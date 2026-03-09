import { NextResponse } from "next/server";

/**
 * GET /api/visual/proxy?url=...
 * Proxies an external image URL to avoid CORS issues when converting to data URI.
 * Only allows OpenAI CDN and fal.ai URLs for security.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Allowlist: only proxy known image generation CDN domains
  const allowed = [
    "oaidalleapiprodscus.blob.core.windows.net",
    "dalleprodsec.blob.core.windows.net",
    "fal.media",
    "v3.fal.media",
  ];

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!allowed.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
    return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "image/png";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 502 },
    );
  }
}
