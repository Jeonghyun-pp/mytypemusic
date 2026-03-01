import fs from "node:fs/promises";
import path from "node:path";
import type { PublishBundle } from "../contracts.js";
import { getPublishBundlePath } from "./paths.js";

/**
 * Save a PublishBundle as pretty-printed JSON.
 * Creates parent directories if they don't exist.
 */
export async function savePublishBundle(
  topicId: string,
  bundle: PublishBundle,
): Promise<string> {
  const filePath = getPublishBundlePath(topicId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify(bundle, null, 2) + "\n",
    "utf-8",
  );
  return filePath;
}
