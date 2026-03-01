import { scaffoldBundle, runBuild } from "./index.js";
import { loadPublishBundle } from "./io/load.js";

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
// scaffold command
// ============================================================================

async function handleScaffold(flags: Map<string, string>): Promise<void> {
  const topicId = flags.get("topicId");

  if (!topicId) {
    throw new Error(
      "Missing --topicId.\n" +
        'Usage: cli.js scaffold --topicId "<id>"',
    );
  }

  console.log("--- PublishBundle: Scaffold ---");
  console.log(`Topic ID : ${topicId}\n`);

  const { savedPath } = await scaffoldBundle(topicId);

  // Round-trip verify
  const loaded = await loadPublishBundle(topicId);
  console.log(`Verified : topicId=${loaded.topicId}, version=${loaded.version}`);
  console.log(`Saved    : ${savedPath}`);

  console.log("\n--- Scaffold Complete ---");
}

// ============================================================================
// build command
// ============================================================================

async function handleBuild(flags: Map<string, string>): Promise<void> {
  const topicId = flags.get("topicId");

  if (!topicId) {
    throw new Error(
      "Missing --topicId.\n" +
        'Usage: cli.js build --topicId "<id>"',
    );
  }

  console.log("--- PublishBundle: Build ---");
  console.log(`Topic ID : ${topicId}\n`);

  const result = await runBuild(topicId);
  const b = result.bundle;

  // Round-trip verify
  const loaded = await loadPublishBundle(topicId);
  console.log(`Verified : topicId=${loaded.topicId}, version=${loaded.version}`);

  // Summary
  console.log(`\nTitle    : ${b.title}`);
  if (b.subtitle) console.log(`Subtitle : ${b.subtitle}`);
  console.log(`Category : ${b.category}`);
  console.log(`Region   : ${b.region}`);
  console.log(`Deck     : ${String(b.deck.slides.length)} slides`);
  console.log(`Caption  : ${b.caption.text.length > 0 ? `${String(b.caption.text.length)} chars` : "(empty)"}`);
  console.log(`Hashtags : ${String(b.caption.hashtags.length)}`);
  console.log(`Sources  : ${String(b.compliance.sources.length)}`);
  console.log(`RiskNotes: ${String(b.compliance.riskNotes.length)}`);

  console.log(`\nSaved    : ${result.savedPath}`);

  // Warnings
  if (result.warnings.length > 0) {
    console.log(`\nWarnings (${String(result.warnings.length)}):`);
    for (const w of result.warnings) {
      console.log(`  ⚠ ${w}`);
    }
  }

  console.log("\n--- Build Complete ---");
}

// ============================================================================
// main
// ============================================================================

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv);

  if (command === "scaffold") {
    await handleScaffold(flags);
    return;
  }

  if (command === "build") {
    await handleBuild(flags);
    return;
  }

  console.error(
    `Unknown command "${command}".\n` +
      "Available commands: scaffold, build",
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
