import { saveJson } from "../../io/save.js";
import { getCoverageGateReportPath } from "../../io/paths.js";
import type { SeedCoverage, PreflightOptions } from "./preflight.js";

// ============================================================================
// Types
// ============================================================================

export type CoverageGateReport = {
  geo: "KR";
  dateYyyymmdd: string;
  generatedAt: string;
  sourcePickedPath: string;
  options: PreflightOptions;
  total: number;
  pass: number;
  fail: number;
  items: SeedCoverage[];
};

// ============================================================================
// Save
// ============================================================================

/**
 * Save a CoverageGateReport to the canonical path.
 *
 * Returns the saved file path.
 */
export async function saveCoverageGateReport(
  report: CoverageGateReport,
): Promise<string> {
  const savePath = getCoverageGateReportPath(report.dateYyyymmdd, report.geo);
  await saveJson(savePath, report);
  return savePath;
}
