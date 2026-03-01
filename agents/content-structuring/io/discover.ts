import fs from "node:fs/promises";
import path from "node:path";
import { getOutputsRoot } from "./paths.js";

/**
 * Find the latest topicId by scanning the outputs directory.
 *
 * Picks the topic folder whose `requireFile` has the most recent mtime.
 * Skips folders that don't contain the required file.
 */
export async function findLatestTopicId(params?: {
  outputsDir?: string;
  requireFile?: "topic-intel.json" | "content-plan.json";
}): Promise<string> {
  const outputsDir = params?.outputsDir ?? getOutputsRoot();
  const requireFile = params?.requireFile ?? "topic-intel.json";

  let entries: string[];
  try {
    entries = await fs.readdir(outputsDir);
  } catch {
    throw new Error(`No topic found. Outputs directory does not exist: ${outputsDir}`);
  }

  let latest: { topicId: string; mtime: number } | undefined;

  for (const entry of entries) {
    const dirPath = path.join(outputsDir, entry);

    // Skip non-directories
    let stat;
    try {
      stat = await fs.stat(dirPath);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    // Check if requireFile exists
    const filePath = path.join(dirPath, requireFile);
    let fileStat;
    try {
      fileStat = await fs.stat(filePath);
    } catch {
      continue;
    }

    const mtime = fileStat.mtimeMs;
    if (latest === undefined || mtime > latest.mtime) {
      latest = { topicId: entry, mtime };
    }
  }

  if (latest === undefined) {
    throw new Error(
      `No topic found. No folder in ${outputsDir} contains ${requireFile}.`,
    );
  }

  return latest.topicId;
}
