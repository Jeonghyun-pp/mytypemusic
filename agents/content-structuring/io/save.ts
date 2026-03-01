import fs from "node:fs/promises";
import path from "node:path";

/**
 * Save an object as pretty-printed JSON.
 * Creates parent directories if they don't exist.
 */
export async function saveJson(
  filePath: string,
  data: unknown,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify(data, null, 2) + "\n",
    "utf-8",
  );
}

/**
 * Save a plain text file.
 * Creates parent directories if they don't exist.
 */
export async function saveText(
  filePath: string,
  text: string,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text, "utf-8");
}
