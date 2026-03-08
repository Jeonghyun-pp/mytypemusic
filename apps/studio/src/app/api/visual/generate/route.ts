import { NextResponse } from "next/server";
import {
  generateImage,
  generateImageComparison,
  getAvailableProviders,
  type ImageGenOptions,
  type ImageProvider,
  type ImagePurpose,
  type AspectRatio,
} from "@/lib/image-gen";

const VALID_PROVIDERS = new Set<ImageProvider>(["dalle", "flux-pro", "flux-schnell"]);
const VALID_PURPOSES = new Set<ImagePurpose>(["text-overlay", "hero", "background", "thumbnail", "editorial", "general"]);
const VALID_ASPECTS = new Set<AspectRatio>(["landscape", "square", "portrait"]);

/**
 * POST /api/visual/generate — Generate image via DALL-E 3 or Flux.
 *
 * Body:
 *   { prompt, provider?, purpose?, aspectRatio?, compare? }
 *
 * If compare=true, generates with all available providers for side-by-side.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = body.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  // Validate optional fields
  const provider = body.provider as string | undefined;
  if (provider && !VALID_PROVIDERS.has(provider as ImageProvider)) {
    return NextResponse.json(
      { error: `Invalid provider. Valid: ${[...VALID_PROVIDERS].join(", ")}` },
      { status: 400 },
    );
  }

  const purpose = body.purpose as string | undefined;
  if (purpose && !VALID_PURPOSES.has(purpose as ImagePurpose)) {
    return NextResponse.json(
      { error: `Invalid purpose. Valid: ${[...VALID_PURPOSES].join(", ")}` },
      { status: 400 },
    );
  }

  const aspectRatio = body.aspectRatio as string | undefined;
  if (aspectRatio && !VALID_ASPECTS.has(aspectRatio as AspectRatio)) {
    return NextResponse.json(
      { error: `Invalid aspectRatio. Valid: ${[...VALID_ASPECTS].join(", ")}` },
      { status: 400 },
    );
  }

  const opts: ImageGenOptions = {
    prompt: prompt.trim(),
    provider: provider as ImageProvider | undefined,
    purpose: (purpose as ImagePurpose) ?? "general",
    aspectRatio: (aspectRatio as AspectRatio) ?? "landscape",
  };

  try {
    if (body.compare) {
      const results = await generateImageComparison(opts);
      return NextResponse.json({ results });
    }

    const result = await generateImage(opts);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Image generation failed", details: msg }, { status: 500 });
  }
}

/**
 * GET /api/visual/generate — Check available providers.
 */
export async function GET() {
  return NextResponse.json({ providers: getAvailableProviders() });
}
