import fs from "node:fs/promises";

/**
 * Load and parse a JSON file. Throws a clear error if the file doesn't exist.
 */
export async function loadJson<T>(filePath: string): Promise<T> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    throw err;
  }
  return JSON.parse(raw) as T;
}
