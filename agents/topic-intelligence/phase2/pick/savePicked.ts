import { getPickedSeedsPath } from "../../io/paths.js";
import { saveJson } from "../../io/save.js";
import type { PickMode, PickOptions } from "./select.js";

// ============================================================================
// Types
// ============================================================================

export type PickedSeedsFile = {
  pickedAt: string;
  dateYyyymmdd: string;
  geo: "KR";
  sourceSnapshotPath: string;
  pickMode: PickMode;
  options: PickOptions;
  count: number;
  seeds: Array<{
    keyword: string;
    category: "music" | "lifestyle" | "unknown";
    score: number;
    source: string;
    traffic?: number;
  }>;
};

// ============================================================================
// Main
// ============================================================================

/**
 * Save picked seeds to disk.
 *
 * Returns the saved file path.
 */
export async function savePickedSeedsFile(
  file: PickedSeedsFile,
): Promise<string> {
  const filePath = getPickedSeedsPath(file.dateYyyymmdd, file.geo);
  await saveJson(filePath, file);
  return filePath;
}
