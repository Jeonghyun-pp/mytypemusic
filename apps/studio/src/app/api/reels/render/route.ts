import { NextResponse } from "next/server";
import { renderComposition } from "@/lib/remotion/renderClient";

/**
 * POST /api/reels/render — Render a video via Remotion Lambda.
 *
 * Body: { compositionId: "Reels" | "Carousel", ...inputProps }
 * Returns: { renderId, downloadUrl }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { compositionId = "Reels", ...inputProps } = body;

    const result = await renderComposition({
      compositionId,
      inputProps,
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
