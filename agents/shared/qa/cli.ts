#!/usr/bin/env node
/**
 * QA CLI — run pre-publish QA checks on a completed run.
 *
 * Usage:
 *   npx tsx agents/shared/qa/cli.ts --runDir <outputsDir> [--topicId <id>]
 *
 * Reads:
 *   - <runDir>/agent2/layout-manifest.json  (slide data)
 *   - <runDir>/agent2/caption.txt           (caption)
 *   - <runDir>/agent2/slide-*.png           (PNG paths)
 *   - <runDir>/image/validated-post.json    (image licenses)
 *   - topic-intelligence/outputs/<topicId>/topic-intel.json (copyright check)
 *
 * Writes:
 *   - <runDir>/qa-report.json
 *
 * Exit code:
 *   0 = passed (or warnings only)
 *   1 = blocked (legal block) or errors
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { runFullQa, type FullQaInput } from "./aggregate";

// ── Parse CLI args ──────────────────────────────────────────

const { values } = parseArgs({
  options: {
    runDir: { type: "string" },
    topicId: { type: "string" },
  },
  strict: false,
});

const runDirRaw = values.runDir;
if (!runDirRaw || typeof runDirRaw !== "string") {
  console.error("Usage: npx tsx agents/shared/qa/cli.ts --runDir <outputsDir> [--topicId <id>]");
  process.exit(2);
}
const runDir: string = runDirRaw;

// ── Resolve paths ───────────────────────────────────────────

const agent2Dir = path.join(runDir, "agent2");
const manifestPath = path.join(agent2Dir, "layout-manifest.json");
const captionPath = path.join(agent2Dir, "caption.txt");
const imageDir = path.join(runDir, "image");
const validatedPostPath = path.join(imageDir, "validated-post.json");

// Resolve topic-intel path from topicId
let topicIntelPath: string | undefined;
const topicIdStr = typeof values.topicId === "string" ? values.topicId : undefined;
if (topicIdStr) {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const candidate = path.join(
    repoRoot, "agents", "topic-intelligence", "outputs",
    topicIdStr, "topic-intel.json",
  );
  if (existsSync(candidate)) {
    topicIntelPath = candidate;
  }
}

// ── Load data ───────────────────────────────────────────────

interface ManifestSlide {
  slideIndex: number;
  title?: string;
  bodyText?: string;
  kind?: string;
}

async function loadSlides(): Promise<FullQaInput["slides"]> {
  try {
    const raw = await readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);
    const slides: ManifestSlide[] = manifest.slides ?? manifest;
    return slides.map((s, i) => ({
      slideIndex: s.slideIndex ?? i,
      title: s.title ?? "",
      bodyText: s.bodyText ?? "",
      kind: s.kind ?? "fact",
    }));
  } catch {
    console.warn(`[qa] Could not read layout manifest at ${manifestPath}, using empty slides`);
    return [];
  }
}

async function loadCaption(): Promise<{ text: string; hashtags: string[] }> {
  try {
    const raw = await readFile(captionPath, "utf-8");
    const hashtags = (raw.match(/#[\w가-힣]+/g) ?? []);
    return { text: raw, hashtags };
  } catch {
    console.warn(`[qa] Could not read caption at ${captionPath}`);
    return { text: "", hashtags: [] };
  }
}

async function collectPngPaths(): Promise<string[]> {
  try {
    const files = await readdir(agent2Dir);
    return files
      .filter((f) => f.endsWith(".png"))
      .sort()
      .map((f) => path.join(agent2Dir, f));
  } catch {
    return [];
  }
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log("[qa] Starting pre-publish QA...");
  console.log(`[qa] runDir: ${runDir}`);

  const [slides, caption, pngPaths] = await Promise.all([
    loadSlides(),
    loadCaption(),
    collectPngPaths(),
  ]);

  console.log(`[qa] slides: ${slides.length}, pngs: ${pngPaths.length}, caption: ${caption.text.length} chars`);

  const input: FullQaInput = {
    slides,
    caption: caption.text,
    hashtags: caption.hashtags,
    pngPaths,
    validatedPostPath: existsSync(validatedPostPath) ? validatedPostPath : undefined,
    topicIntelPath,
  };

  const report = await runFullQa(input);

  // Save report
  const reportPath = path.join(runDir, "qa-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`[qa] Report saved: ${reportPath}`);

  // Print summary
  const { overall } = report;
  console.log(`[qa] ── Summary ──`);
  console.log(`[qa] Passed:   ${overall.passed}`);
  console.log(`[qa] Blocked:  ${overall.blocked}`);
  console.log(`[qa] Errors:   ${overall.errorCount}`);
  console.log(`[qa] Warnings: ${overall.warningCount}`);

  if (!overall.passed) {
    console.log(`[qa] ── Issues ──`);
    for (const issue of report.technical.issues) {
      if (issue.severity === "error") {
        console.log(`[qa]  [TECH ERROR] ${issue.code}: ${issue.message}`);
      }
    }
    for (const issue of report.copy.issues) {
      if (issue.severity === "error") {
        console.log(`[qa]  [COPY ERROR] ${issue.code}: ${issue.message}`);
      }
    }
    for (const issue of report.legal.issues) {
      if (issue.severity === "block") {
        console.log(`[qa]  [LEGAL BLOCK] ${issue.code}: ${issue.message}`);
      }
    }
  }

  process.exit(overall.passed ? 0 : 1);
}

main().catch((err) => {
  console.error("[qa] Fatal error:", err);
  process.exit(2);
});
