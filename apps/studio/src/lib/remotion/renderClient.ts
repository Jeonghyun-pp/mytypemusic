/**
 * Remotion render client — renders video via AWS Lambda.
 *
 * Requires:
 * - @remotion/lambda deployed (function + site)
 * - Environment variables:
 *   REMOTION_AWS_REGION, REMOTION_FUNCTION_NAME, REMOTION_SERVE_URL
 */

// Dynamic require to fully bypass Turbopack static analysis
// eslint-disable-next-line @typescript-eslint/no-require-imports
function getLambdaClient(): {
  renderMediaOnLambda: (...args: unknown[]) => Promise<{ renderId: string; bucketName: string }>;
  getRenderProgress: (...args: unknown[]) => Promise<{
    overallProgress: number;
    done: boolean;
    outputFile?: string;
    fatalErrorEncountered: boolean;
    errors?: { message: string }[];
  }>;
} {
  const pkg = "@remotion/lambda/client";
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(pkg);
}

interface RenderOptions {
  compositionId: string; // "Reels" or "Carousel"
  inputProps: Record<string, unknown>;
  codec?: "h264" | "h265";
}

interface RenderResult {
  renderId: string;
  bucketName: string;
  downloadUrl: string;
}

function getConfig() {
  const region = process.env.REMOTION_AWS_REGION;
  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const serveUrl = process.env.REMOTION_SERVE_URL;

  if (!region || !functionName || !serveUrl) {
    throw new Error(
      "Missing Remotion Lambda config. Set REMOTION_AWS_REGION, REMOTION_FUNCTION_NAME, REMOTION_SERVE_URL.",
    );
  }

  return { region: region as "ap-northeast-2", functionName, serveUrl };
}

/** Start a Lambda render and poll until complete. */
export async function renderComposition(
  opts: RenderOptions,
): Promise<RenderResult> {
  const { region, functionName, serveUrl } = getConfig();

  const { renderMediaOnLambda, getRenderProgress } = getLambdaClient();

  const { renderId, bucketName } = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: opts.compositionId,
    inputProps: opts.inputProps,
    codec: opts.codec ?? "h264",
    imageFormat: "jpeg",
    maxRetries: 1,
    framesPerLambda: 20,
    privacy: "public",
  });

  // Poll for completion
  let progress = 0;
  while (progress < 1) {
    await new Promise((r) => setTimeout(r, 2000));
    const status = await getRenderProgress({
      renderId,
      bucketName,
      functionName,
      region,
    });

    if (status.fatalErrorEncountered) {
      throw new Error(
        `Render failed: ${status.errors?.[0]?.message ?? "Unknown error"}`,
      );
    }

    progress = status.overallProgress;

    if (status.done && status.outputFile) {
      return {
        renderId,
        bucketName,
        downloadUrl: status.outputFile,
      };
    }
  }

  throw new Error("Render completed but no output file found");
}
