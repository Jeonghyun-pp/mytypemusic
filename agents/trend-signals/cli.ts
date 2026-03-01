import { parseSignalRequest } from "./schema.js";
import type { SignalSourceId, SignalResult } from "./contracts.js";
import { collectYouTubeSignals, getQuotaUsed } from "./youtube/index.js";
import { collectInstagramSignals } from "./instagram/index.js";
import { getSignalResultPath, saveJson } from "./io.js";

// ============================================================================
// Argv parsing
// ============================================================================

function parseArgs(argv: string[]): {
  command: string;
  flags: Map<string, string>;
} {
  const args = argv.slice(2);
  const command = args[0] ?? "";

  const flags = new Map<string, string>();
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg !== undefined && arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(key, next);
        i++;
      }
    }
  }

  return { command, flags };
}

// ============================================================================
// Commands
// ============================================================================

async function runYouTube(flags: Map<string, string>): Promise<void> {
  const seed = flags.get("seed");
  if (!seed) {
    console.error("Error: --seed is required");
    process.exit(1);
  }

  const request = parseSignalRequest({
    seedKeyword: seed,
    sources: ["youtube" as SignalSourceId],
    region: flags.get("region") ?? "KR",
    maxResults: flags.has("max") ? Number(flags.get("max")) : undefined,
  });

  console.log("SignalRequest:", JSON.stringify(request, null, 2));

  const regionCode = request.region === "GLOBAL" ? "US" : (request.region ?? "KR");
  const result = await collectYouTubeSignals(request.seedKeyword, {
    maxResults: request.maxResults,
    regionCode,
  });

  console.log(`\n[youtube] Collected ${String(result.articles.length)} articles`);
  console.log(`  Quota consumed: ${String(result.quotaConsumed)} units (total session: ${String(getQuotaUsed())})`);
  if (result.errors.length > 0) {
    console.log("  Errors:", result.errors);
  }

  for (const a of result.articles) {
    const views = a.metrics?.views != null ? ` (${String(a.metrics.views)} views)` : "";
    console.log(`  - ${a.title.slice(0, 60)}${views}`);
  }

  // Save SignalResult to file
  const signalResult: SignalResult = {
    seedKeyword: request.seedKeyword,
    articles: result.articles,
    sourceSummaries: [
      {
        sourceId: "youtube",
        count: result.articles.length,
        errors: result.errors,
      },
    ],
    collectedAt: new Date().toISOString(),
  };

  const outPath = flags.get("out") ?? getSignalResultPath(request.seedKeyword);
  await saveJson(outPath, signalResult);
  console.log(`\nSaved: ${outPath}`);
}

async function runInstagram(flags: Map<string, string>): Promise<void> {
  const seed = flags.get("seed");
  if (!seed) {
    console.error("Error: --seed is required");
    process.exit(1);
  }

  const request = parseSignalRequest({
    seedKeyword: seed,
    sources: ["instagram" as SignalSourceId],
    region: flags.get("region") ?? "KR",
    maxResults: flags.has("max") ? Number(flags.get("max")) : undefined,
  });

  console.log("SignalRequest:", JSON.stringify(request, null, 2));

  const edgeArg = flags.get("edge");
  const edges = edgeArg === "recent" ? (["recent_media"] as const)
    : edgeArg === "both" ? (["top_media", "recent_media"] as const)
    : (["top_media"] as const);

  const result = await collectInstagramSignals(request.seedKeyword, { edges: [...edges] });

  console.log(`\n[instagram] Collected ${String(result.articles.length)} articles (hashtag ID: ${result.hashtagId})`);
  console.log(`  Hashtag searches used: ${String(result.hashtagSearchesUsed)} (limit: 30/week)`);
  if (result.errors.length > 0) {
    console.log("  Errors:", result.errors);
  }

  for (const a of result.articles) {
    const likes = a.metrics?.likes != null ? ` (${String(a.metrics.likes)} likes)` : "";
    console.log(`  - ${a.title.slice(0, 60)}${likes}`);
  }

  // Save SignalResult to file
  const signalResult: SignalResult = {
    seedKeyword: request.seedKeyword,
    articles: result.articles,
    sourceSummaries: [
      {
        sourceId: "instagram",
        count: result.articles.length,
        errors: result.errors,
      },
    ],
    collectedAt: new Date().toISOString(),
  };

  const outPath = flags.get("out") ?? getSignalResultPath(request.seedKeyword);
  await saveJson(outPath, signalResult);
  console.log(`\nSaved: ${outPath}`);
}

function printUsage(): void {
  console.log(`
trend-signals CLI — collect engagement signals from social platforms

Commands:
  youtube    Collect YouTube video signals for a keyword
  instagram  Collect Instagram hashtag signals for a keyword

Options:
  --seed <keyword>   Seed keyword to search (required)
  --region <KR|US>   Region (default: KR)
  --max <number>     Max results per source (default: 10)
  --out <path>       Output file path (default: outputs/signal-{seed}-{ts}.json)
  --edge <top|recent|both>  Instagram edge (default: top)

Examples:
  npx tsx agents/trend-signals/cli.ts youtube --seed "인디음악" --max 5
  npx tsx agents/trend-signals/cli.ts instagram --seed "인디밴드"
  npx tsx agents/trend-signals/cli.ts instagram --seed "인디밴드" --edge both
  `.trim());
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv);

  switch (command) {
    case "youtube":
      await runYouTube(flags);
      break;
    case "instagram":
      await runInstagram(flags);
      break;
    default:
      printUsage();
      break;
  }
}

main().catch((err: unknown) => {
  console.error("Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
