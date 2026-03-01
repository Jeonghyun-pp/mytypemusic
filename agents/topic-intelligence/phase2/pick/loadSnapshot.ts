import { loadJson } from "../../io/load.js";
import { getSeedsSnapshotPath } from "../../io/paths.js";
import type { Phase2AResult } from "../run.js";

// ============================================================================
// Main
// ============================================================================

/**
 * Load a saved seeds snapshot from disk.
 *
 * Throws if the file does not exist or has invalid shape.
 */
export async function loadSeedsSnapshot(params: {
  dateYyyymmdd: string;
  geo: "KR";
}): Promise<Phase2AResult> {
  const filePath = getSeedsSnapshotPath(params.dateYyyymmdd, params.geo);
  const raw = await loadJson<unknown>(filePath);

  // Basic shape check
  if (
    typeof raw !== "object" ||
    raw === null ||
    !("generatedAt" in raw) ||
    !("timeframe" in raw) ||
    !("total" in raw) ||
    !("candidates" in raw) ||
    !Array.isArray((raw as Record<string, unknown>).candidates)
  ) {
    throw new Error(
      `Invalid seeds snapshot shape at ${filePath}. ` +
        "Expected { generatedAt, timeframe, total, candidates[] }.",
    );
  }

  return raw as Phase2AResult;
}
