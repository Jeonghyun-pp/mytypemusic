import fs from "node:fs/promises";
import path from "node:path";
import { ValidatedPostSubsetSchema } from "../validated-post.schema.js";
import type { ValidatedPostSubset } from "../validated-post.schema.js";

/** Result of loading and validating a validated-post.json file */
export interface LoadedPost {
  /** Zod-parsed compliance subset (only the fields Agent2 needs) */
  compliance: ValidatedPostSubset;
  /** Directory containing the validated-post.json (for resolving relative paths) */
  inputDir: string;
}

/**
 * Load, parse, and validate an Agent1 validated-post.json file.
 *
 * - Reads the JSON from disk
 * - Validates with ValidatedPostSubsetSchema (Agent2's minimal subset)
 * - Throws ZodError on schema mismatch
 */
export async function loadValidatedPost(
  inputPath: string
): Promise<LoadedPost> {
  const absPath = path.resolve(inputPath);
  const raw = await fs.readFile(absPath, "utf-8");
  const parsed: unknown = JSON.parse(raw);

  const compliance = ValidatedPostSubsetSchema.parse(parsed);

  return {
    compliance,
    inputDir: path.dirname(absPath),
  };
}
