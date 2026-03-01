import fs from "node:fs/promises";
import path from "node:path";
import { safeAcquireImage } from "./acquire.js";
import type { AcquireOptions } from "./acquire.js";
import { aggregatePostCompliance } from "./post-compliance.js";
import { buildAttributionBundle } from "./attribution.js";
import type { IntendedUse, PostChannel } from "./types.js";

type Category = AcquireOptions["category"];

function parseArgs(argv: string[]): {
  topic: string;
  keywords: string[];
  use: string;
  channel: string;
  category: string;
  out: string;
  requiresDerivative: boolean;
  allowPeople: boolean;
  allowLogos: boolean;
  targetTerritory?: string;
} {
  const args = argv.slice(2);
  const map = new Map<string, string>();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg !== undefined && arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        map.set(key, next);
        i++;
      } else {
        map.set(key, "true");
      }
    }
  }

  const topic = map.get("topic");
  const keywords = map.get("keywords");
  const use = map.get("use");
  const channel = map.get("channel");
  const category = map.get("category");
  const out = map.get("out");

  if (!topic || !keywords || !use || !channel || !category || !out) {
    const missing = [
      !topic && "--topic",
      !keywords && "--keywords",
      !use && "--use",
      !channel && "--channel",
      !category && "--category",
      !out && "--out",
    ].filter(Boolean);
    throw new Error(`Missing required arguments: ${missing.join(", ")}`);
  }

  return {
    topic,
    keywords: keywords.split(",").map((k) => k.trim()),
    use,
    channel,
    category,
    out,
    requiresDerivative: map.get("requiresDerivative") !== "false",
    allowPeople: map.get("allowPeople") === "true",
    allowLogos: map.get("allowLogos") === "true",
    targetTerritory: map.get("targetTerritory"),
  };
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);

  const briefInput = {
    topic: parsed.topic,
    keywords: parsed.keywords,
    intendedUse: parsed.use,
    channel: parsed.channel,
    requiresDerivative: parsed.requiresDerivative,
    allowPeople: parsed.allowPeople,
    allowLogos: parsed.allowLogos,
    targetTerritory: parsed.targetTerritory,
  };

  const options: AcquireOptions = {
    category: parsed.category as Category,
    outputDir: parsed.out,
  };

  const asset = await safeAcquireImage(briefInput, options);

  // save validated-asset.json
  const jsonPath = path.join(parsed.out, "validated-asset.json");
  await fs.writeFile(jsonPath, JSON.stringify(asset, null, 2), "utf-8");

  console.log("--- Safe Image Acquisition Complete ---");
  console.log(`Image saved : ${asset.localPath}`);
  console.log(`Asset JSON  : ${jsonPath}`);
  console.log(`Risk Score  : ${asset.risk.riskScore}`);
  console.log(`Source URL  : ${asset.sourceUrl}`);
  console.log(`License URL : ${asset.license.licenseUrl ?? "N/A"}`);
  if (asset.recommendedAttribution) {
    console.log(`Attribution : ${asset.recommendedAttribution}`);
  }

  // Post-level compliance aggregation (v0: single-image array)
  const postChannel = (
    parsed.channel === "print" ? "web" : parsed.channel
  ) as PostChannel;

  const postResult = aggregatePostCompliance([asset], {
    postUseIntent: parsed.use as IntendedUse,
    channel: postChannel,
  });

  // Attribution engine
  const bundle = buildAttributionBundle({
    images: [asset],
    channel: postChannel,
  });
  postResult.attribution = bundle;

  const postJsonPath = path.join(parsed.out, "validated-post.json");
  await fs.writeFile(postJsonPath, JSON.stringify(postResult, null, 2), "utf-8");

  console.log("\n--- Post Compliance ---");
  console.log(`Post JSON       : ${postJsonPath}`);
  console.log(`Overall Risk    : ${postResult.overallRiskScore}`);
  console.log(`Allowed         : ${postResult.allowed}`);
  console.log(`Attribution Req : ${postResult.attributionRequired}`);
  if (postResult.requiredActions.length > 0) {
    console.log(`Actions         : ${postResult.requiredActions.join("; ")}`);
  }
  if (postResult.notes.length > 0) {
    console.log(`Notes           : ${postResult.notes.join("; ")}`);
  }
  console.log(`\n--- Attribution ---`);
  console.log(bundle.captionAppendix);
}

main().catch((error: unknown) => {
  console.error("--- Acquisition Failed ---");
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
    const meta = (error as Error & { metadata?: Record<string, unknown> })
      .metadata;
    if (meta) {
      console.error("Metadata:", JSON.stringify(meta, null, 2));
    }
  } else {
    console.error("Unknown error:", error);
  }
  process.exitCode = 1;
});
