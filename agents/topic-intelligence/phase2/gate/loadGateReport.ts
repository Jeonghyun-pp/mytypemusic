import { getCoverageGateReportPath } from "../../io/paths.js";
import { loadJson } from "../../io/load.js";

// ============================================================================
// Types
// ============================================================================

export type GateDecision = "pass" | "fail";

export type GateItem = {
  keyword: string;
  decision: GateDecision;
  coverage: { score: number };
  reason?: string;
};

export type CoverageGateReportLite = {
  geo: "KR";
  dateYyyymmdd: string;
  items: GateItem[];
};

// ============================================================================
// Loader
// ============================================================================

/**
 * Load a coverage-gate report and extract the minimal fields needed
 * for batch plan filtering.
 *
 * Throws if the file does not exist (caller decides how to handle).
 */
export async function loadCoverageGateReport(params: {
  dateYyyymmdd: string;
  geo: "KR";
}): Promise<CoverageGateReportLite> {
  const filePath = getCoverageGateReportPath(params.dateYyyymmdd, params.geo);
  const raw = await loadJson<Record<string, unknown>>(filePath);

  const rawItems = Array.isArray(raw.items) ? raw.items : [];

  const items: GateItem[] = rawItems.map(
    (item: Record<string, unknown>) => {
      const cov = item.coverage as Record<string, unknown> | undefined;
      return {
        keyword: String(item.keyword ?? ""),
        decision:
          item.decision === "pass" ? ("pass" as const) : ("fail" as const),
        coverage: {
          score: typeof cov?.score === "number" ? cov.score : 0,
        },
        reason: typeof item.reason === "string" ? item.reason : undefined,
      };
    },
  );

  return {
    geo: params.geo,
    dateYyyymmdd: String(raw.dateYyyymmdd ?? params.dateYyyymmdd),
    items,
  };
}

// ============================================================================
// Index helper
// ============================================================================

/**
 * Build a keyword → GateItem lookup map.
 *
 * Uses exact keyword match (no normalization).
 */
export function buildGateIndex(
  report: CoverageGateReportLite,
): Map<string, GateItem> {
  const index = new Map<string, GateItem>();
  for (const item of report.items) {
    index.set(item.keyword, item);
  }
  return index;
}
