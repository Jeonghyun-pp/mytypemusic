/**
 * E2E Pipeline Test
 *
 * Runs the full general_cardnews pipeline end-to-end and reports
 * per-step timing + artifact verification.
 *
 * Usage:
 *   npx tsx scripts/e2e-test.ts
 *   npx tsx scripts/e2e-test.ts --prompt "아이브 컴백"
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createRun, readRun, readArtifacts } from "../apps/studio/src/lib/studio/runStore";
import { startPipeline } from "../apps/studio/src/lib/studio/orchestrator/pipeline";
import { getRepoRoot } from "../apps/studio/src/lib/studio/paths";
import type { RunInput, RunRecord, StepRecord } from "../apps/studio/src/lib/studio/runTypes";

// ── CLI args ────────────────────────────────────────────────

function parseCliArgs(): { prompt: string; category: "music" | "lifestyle" } {
  const args = process.argv.slice(2);
  let prompt = "데이식스 신보";
  let category: "music" | "lifestyle" = "music";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--prompt" && args[i + 1]) {
      prompt = args[i + 1]!;
      i++;
    }
    if (args[i] === "--category" && args[i + 1]) {
      category = args[i + 1] as "music" | "lifestyle";
      i++;
    }
  }

  return { prompt, category };
}

// ── Formatting helpers ──────────────────────────────────────

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const STATUS_ICON: Record<string, string> = {
  success: "OK",
  failed: "FAIL",
  skipped: "SKIP",
  pending: "----",
  running: ">>",
};

// ── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { prompt, category } = parseCliArgs();
  const pipelineStart = Date.now();

  console.log("========================================");
  console.log("  E2E Pipeline Test");
  console.log("========================================");
  console.log(`  Prompt   : ${prompt}`);
  console.log(`  Category : ${category}`);
  console.log(`  PostType : general_cardnews`);
  console.log(`  Time     : ${new Date().toISOString()}`);
  console.log("========================================\n");

  // 1) Create run
  const input: RunInput = {
    prompt,
    postType: "general_cardnews",
    category,
  };

  const run = await createRun(input);
  console.log(`Run created: ${run.runId}`);
  console.log(`Outputs dir: ${run.outputsDir}\n`);

  // 2) Start pipeline (non-blocking promise)
  const pipelinePromise = startPipeline(run.runId);

  // 3) Progress polling
  let lastStep = "";
  const pollId = setInterval(async () => {
    try {
      const current = await readRun(run.runId);
      const active = current.steps.find((s) => s.status === "running");
      const elapsed = ((Date.now() - pipelineStart) / 1000).toFixed(0);
      if (active && active.step !== lastStep) {
        lastStep = active.step;
        console.log(`  [${elapsed}s] Running: ${active.step}`);
      }
    } catch {
      // run.json might be mid-write
    }
  }, 3000);

  // 4) Await pipeline completion
  await pipelinePromise;
  clearInterval(pollId);

  const totalMs = Date.now() - pipelineStart;

  // 5) Read final state
  const finalRun = await readRun(run.runId);

  console.log("\n========================================");
  console.log("  Step-by-Step Results");
  console.log("========================================\n");

  console.log(`  ${pad("Step", 22)} ${pad("Status", 8)} Duration`);
  console.log(`  ${"-".repeat(22)} ${"-".repeat(8)} ${"--------"}`);

  for (const step of finalRun.steps) {
    const icon = STATUS_ICON[step.status] ?? step.status;
    let duration = "";

    if (step.startedAt && step.finishedAt) {
      const ms = new Date(step.finishedAt).getTime() - new Date(step.startedAt).getTime();
      duration = fmtMs(ms);
    }

    console.log(`  ${pad(step.step, 22)} ${pad(icon, 8)} ${duration}`);
  }

  console.log(`\n  Total pipeline time: ${fmtMs(totalMs)}`);
  console.log(`  Final status: ${finalRun.status}`);
  if (finalRun.topicId) {
    console.log(`  Topic ID: ${finalRun.topicId}`);
  }

  // 6) Artifact verification
  console.log("\n========================================");
  console.log("  Artifact Verification");
  console.log("========================================\n");

  const checks: Array<{ label: string; ok: boolean; detail: string }> = [];

  // Check topicId
  checks.push({
    label: "topicId extracted",
    ok: !!finalRun.topicId,
    detail: finalRun.topicId ?? "MISSING",
  });

  // Check topic-intel.json
  if (finalRun.topicId) {
    const intelPath = path.join(
      getRepoRoot(), "agents", "topic-intelligence", "outputs",
      finalRun.topicId, "topic-intel.json",
    );
    const intelExists = existsSync(intelPath);
    checks.push({
      label: "topic-intel.json",
      ok: intelExists,
      detail: intelExists ? intelPath : "NOT FOUND",
    });
  }

  // Check validated-post.json
  const vpPath = path.join(finalRun.outputsDir, "image", "validated-post.json");
  checks.push({
    label: "validated-post.json",
    ok: existsSync(vpPath),
    detail: existsSync(vpPath) ? "exists" : "NOT FOUND",
  });

  // Check artifacts
  const artifacts = await readArtifacts(run.runId);
  checks.push({
    label: "PNG outputs",
    ok: artifacts.pngPaths.length > 0,
    detail: `${artifacts.pngPaths.length} file(s)`,
  });
  checks.push({
    label: "caption",
    ok: !!artifacts.captionPath,
    detail: artifacts.captionPath ?? "MISSING",
  });
  checks.push({
    label: "bundle",
    ok: !!artifacts.bundlePath,
    detail: artifacts.bundlePath ?? "MISSING",
  });

  let allPassed = finalRun.status === "success";
  for (const c of checks) {
    const mark = c.ok ? "PASS" : "FAIL";
    console.log(`  [${mark}] ${pad(c.label, 24)} ${c.detail}`);
    if (!c.ok) allPassed = false;
  }

  // 7) Failed steps detail
  const failedSteps = finalRun.steps.filter((s) => s.status === "failed");
  if (failedSteps.length > 0) {
    console.log("\n========================================");
    console.log("  Failed Steps Detail");
    console.log("========================================\n");
    for (const s of failedSteps) {
      console.log(`  ${s.step}: ${s.error ?? "no error message"}`);
    }
  }

  // 8) Summary
  console.log("\n========================================");
  if (allPassed) {
    console.log("  RESULT: PASS");
  } else {
    console.log("  RESULT: FAIL");
  }
  console.log(`  Total time: ${fmtMs(totalMs)}`);
  console.log("========================================\n");

  process.exitCode = allPassed ? 0 : 1;
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exitCode = 1;
});
