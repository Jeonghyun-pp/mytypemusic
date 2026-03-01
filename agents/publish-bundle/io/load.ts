import fs from "node:fs/promises";
import type { PublishBundle } from "../contracts.js";
import { parsePublishBundle } from "../schema.js";
import { getPublishBundlePath } from "./paths.js";

/**
 * Load and validate publish-bundle.json for a given topic.
 */
export async function loadPublishBundle(
  topicId: string,
): Promise<PublishBundle> {
  const filePath = getPublishBundlePath(topicId);
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
  return parsePublishBundle(JSON.parse(raw));
}
