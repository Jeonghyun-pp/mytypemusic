import fs from "node:fs/promises";
import type { ContentPlan } from "../contracts.js";
import { parseContentPlan } from "../schema.js";
import { getContentPlanPath, getCaptionDraftPath } from "./paths.js";

/**
 * Load and parse a JSON file. Throws a clear error if the file doesn't exist.
 */
export async function loadJson<T>(filePath: string): Promise<T> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      throw new Error(`File not found: ${filePath}`);
    }
    throw err;
  }
  return JSON.parse(raw) as T;
}

/**
 * Load and validate content-plan.json for a given topic.
 */
export async function loadContentPlan(topicId: string): Promise<ContentPlan> {
  const filePath = getContentPlanPath(topicId);
  const raw = await loadJson<unknown>(filePath);
  return parseContentPlan(raw);
}

/**
 * Load caption.draft.txt for a given topic.
 * Returns undefined if the file does not exist.
 */
export async function loadCaptionDraft(
  topicId: string,
): Promise<string | undefined> {
  const filePath = getCaptionDraftPath(topicId);
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return undefined;
    }
    throw err;
  }
}
