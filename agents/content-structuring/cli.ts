import { runContent } from "./run/content.js";
import { runBridge } from "./run/bridge.js";
import { runE2E } from "./run/e2e.js";
import { findLatestTopicId } from "./io/discover.js";
import type { RewriteConfig, RewriteMode, RewriteProvider } from "./rewrite/contracts.js";

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
// Rewrite flags → Partial<RewriteConfig>
// ============================================================================

function parseRewriteFlags(flags: Map<string, string>): Partial<RewriteConfig> {
  const partial: Partial<RewriteConfig> = {};

  const mode = flags.get("rewriteMode");
  if (mode) {
    partial.mode = mode as RewriteMode;
  }

  const provider = flags.get("rewriteProvider");
  if (provider) {
    partial.provider = provider as RewriteProvider;
  }

  const model = flags.get("rewriteModel");
  if (model) {
    partial.model = model;
  }

  const temp = flags.get("rewriteTemperature");
  if (temp) {
    partial.temperature = Number(temp);
  }

  return partial;
}

// ============================================================================
// content command
// ============================================================================

async function handleContent(flags: Map<string, string>): Promise<void> {
  const topicId = flags.get("topicId");

  if (!topicId) {
    throw new Error(
      "Missing --topicId.\n" +
        'Usage: cli.js content --topicId "<id>"',
    );
  }

  const rewrite = parseRewriteFlags(flags);

  console.log("--- Agent3: Content Structuring ---");
  console.log(`Topic ID : ${topicId}`);

  const result = await runContent({ topicId, rewrite });

  console.log(`Slides   : ${String(result.slides)}`);
  console.log(`Hashtags : ${String(result.hashtags)}`);

  // Rewrite summary
  const rs = result.rewriteSummary;
  if (rs) {
    console.log(`\n[rewrite summary]`);
    console.log(`  mode     : ${rs.mode}`);
    console.log(`  provider : ${rs.provider}`);
    console.log(`  model    : ${rs.model}`);
    console.log(`  warnings : ${String(rs.warnings.length)}`);
    for (const w of rs.warnings) {
      console.log(`    - ${w}`);
    }
    const gr = rs.guardrailReport;
    if (gr) {
      console.log(`  guardrails: slides_rolled_back=${String(gr.slidesRolledBack)} caption_rolled_back=${String(gr.captionRolledBack)}`);
    }
  }

  console.log(`\nSaved:`);
  console.log(`  plan    : ${result.contentPlanPath}`);
  console.log(`  caption : ${result.captionDraftPath}`);

  console.log("\n--- Agent3 Complete ---");
}

// ============================================================================
// bridge command
// ============================================================================

async function handleBridge(flags: Map<string, string>): Promise<void> {
  const topicId = flags.get("topicId");

  if (!topicId) {
    throw new Error(
      "Missing --topicId.\n" +
        'Usage: cli.js bridge --topicId "<id>"',
    );
  }

  console.log("--- Agent3: Bridge → Agent2 Topic Input ---");
  console.log(`Topic ID : ${topicId}\n`);

  const result = await runBridge({ topicId });

  console.log(`KeyFacts : ${result.keyFactsSource}`);
  console.log(`Saved    : ${result.agent2TopicPath}`);

  console.log("\n--- Bridge Complete ---");
}

// ============================================================================
// e2e command
// ============================================================================

async function handleE2E(flags: Map<string, string>): Promise<void> {
  const latest = flags.get("latest") === "true";
  let topicId = flags.get("topicId");
  const requireFile =
    (flags.get("requireFile") as "topic-intel.json" | "content-plan.json") ??
    undefined;

  if (!topicId && !latest) {
    throw new Error(
      "Missing --topicId or --latest true.\n" +
        'Usage: cli.js e2e --topicId "<id>"\n' +
        "       cli.js e2e --latest true",
    );
  }

  if (!topicId) {
    try {
      topicId = await findLatestTopicId({ requireFile });
    } catch {
      throw new Error("No topic found. Run Agent5 first.");
    }
  }

  const rewrite = parseRewriteFlags(flags);

  console.log("--- Agent3: E2E (content → bridge) ---");
  console.log(`Topic ID : ${topicId}${latest ? " (latest)" : ""}\n`);

  const result = await runE2E({ topicId, rewrite });

  // content summary
  console.log("[content]");
  console.log(`  Slides   : ${String(result.content.slides)}`);
  console.log(`  Hashtags : ${String(result.content.hashtags)}`);
  console.log(`  plan     : ${result.content.contentPlanPath}`);
  console.log(`  caption  : ${result.content.captionDraftPath}`);

  // rewrite summary
  const rs = result.content.rewriteSummary;
  if (rs) {
    console.log(`\n[rewrite]`);
    console.log(`  mode     : ${rs.mode}`);
    console.log(`  provider : ${rs.provider}`);
    console.log(`  model    : ${rs.model}`);
    console.log(`  warnings : ${String(rs.warnings.length)}`);
    for (const w of rs.warnings) {
      console.log(`    - ${w}`);
    }
    const gr = rs.guardrailReport;
    if (gr) {
      console.log(`  guardrails: slides_rolled_back=${String(gr.slidesRolledBack)} caption_rolled_back=${String(gr.captionRolledBack)}`);
    }
  }

  // bridge summary
  console.log("\n[bridge]");
  console.log(`  keyFacts : ${result.bridge.keyFactsSource}`);
  console.log(`  agent2   : ${result.bridge.agent2TopicPath}`);

  console.log(`\n--- E2E done: ${topicId} ---`);
}

// ============================================================================
// main
// ============================================================================

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv);

  if (command === "content") {
    await handleContent(flags);
    return;
  }

  if (command === "bridge") {
    await handleBridge(flags);
    return;
  }

  if (command === "e2e") {
    await handleE2E(flags);
    return;
  }

  console.error(
    `Unknown command "${command}".\n` +
      "Available commands: content, bridge, e2e",
  );
  process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error("--- Error ---");
  if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
