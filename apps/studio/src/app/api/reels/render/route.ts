import { NextResponse } from "next/server";

// Server-side rendering with @remotion/renderer
// Requires pre-built bundle: npm run bundle:remotion
//
// This is a placeholder — full implementation requires:
// 1. Run `npx remotion bundle src/remotion/index.ts --out-dir=remotion-bundle`
// 2. Then this route can call selectComposition() + renderMedia()
//
// For now, return a descriptive error so the UI can be tested independently.

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // TODO: Implement when remotion-bundle is built
    // import { renderMedia, selectComposition, ensureBrowser } from "@remotion/renderer";
    // const BUNDLE = path.resolve(process.cwd(), "remotion-bundle");
    // await ensureBrowser();
    // const comp = await selectComposition({ serveUrl: BUNDLE, id: "Reels", inputProps: body });
    // const outputPath = path.resolve(OUTPUTS_DIR, `reel-${Date.now()}.mp4`);
    // await renderMedia({ composition: comp, serveUrl: BUNDLE, codec: "h264", outputLocation: outputPath, inputProps: body });
    // return NextResponse.json({ downloadUrl: `/api/reels/download?file=${encodeURIComponent(path.basename(outputPath))}` });

    return NextResponse.json(
      {
        error: "Render not yet configured. Run `npm run bundle:remotion` first.",
        receivedProps: body,
      },
      { status: 501 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
