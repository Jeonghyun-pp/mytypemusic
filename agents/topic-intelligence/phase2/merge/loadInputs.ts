import {
  getSeedsSnapshotPath,
  getPickedSeedsPath,
} from "../../io/paths.js";
import { loadJson } from "../../io/load.js";
import {
  loadCoverageGateReport,
  buildGateIndex,
  type GateItem,
} from "../gate/loadGateReport.js";
import type { Phase2AResult } from "../run.js";
import type { PickedSeedsFile } from "../pick/savePicked.js";

// ============================================================================
// Types
// ============================================================================

export type MergeInputs = {
  snapshot: Phase2AResult;
  picked: PickedSeedsFile;
  gateIndex: Map<string, GateItem> | undefined;
  paths: {
    snapshotPath: string;
    pickedPath: string;
    gateReportPath: string | undefined;
  };
};

// ============================================================================
// Main
// ============================================================================

/**
 * Load all three inputs needed for the merge/runlist step:
 * - seeds snapshot (Phase2A result)
 * - picked seeds file
 * - coverage gate report (optional — returns undefined if not found)
 */
export async function loadMergeInputs(params: {
  dateYyyymmdd: string;
  geo?: "KR";
}): Promise<MergeInputs> {
  const geo = params.geo ?? "KR";

  const snapshotPath = getSeedsSnapshotPath(params.dateYyyymmdd, geo);
  const pickedPath = getPickedSeedsPath(params.dateYyyymmdd, geo);

  // Load snapshot + picked (required — throws on missing)
  const snapshot = await loadJson<Phase2AResult>(snapshotPath);
  const picked = await loadJson<PickedSeedsFile>(pickedPath);

  // Load gate report (optional — swallow errors)
  let gateIndex: Map<string, GateItem> | undefined;
  let gateReportPath: string | undefined;
  try {
    const gateReport = await loadCoverageGateReport({
      dateYyyymmdd: params.dateYyyymmdd,
      geo,
    });
    gateIndex = buildGateIndex(gateReport);
    gateReportPath = snapshotPath.replace(
      `seeds.${geo}.json`,
      `coverage-gate.${geo}.json`,
    );
  } catch {
    // Gate report not available — proceed without it
  }

  return {
    snapshot,
    picked,
    gateIndex,
    paths: {
      snapshotPath,
      pickedPath,
      gateReportPath,
    },
  };
}
