import type { TopicRequest } from "../../contracts.js";

// ============================================================================
// Types
// ============================================================================

export type BatchRunResultItem = {
  idx: number;
  keyword: string;
  category: "music" | "lifestyle" | "unknown";
  ok: boolean;
  skipped: boolean;
  skipReason?: string;
  topicId?: string;
  paths?: {
    topicRequestPath: string;
    topicIntelPath?: string;
    agent2TopicPath?: string;
  };
  summary?: {
    sources: number;
    keyFacts: number;
    angles: number;
  };
  error?: string;
  durationMs?: number;
  gate?: {
    decision?: "pass" | "fail";
    score?: number;
    reason?: string;
  };
  finalScore?: number;
  gateDecision?: "pass" | "fail" | "missing";
};

export type BatchRunReportGate = {
  enabled: boolean;
  requireReport: boolean;
  minCoverageScore: number;
  reportPath?: string;
  passed: number;
  failed: number;
  missing: number;
};

export type BatchRunReport = {
  geo: "KR";
  dateYyyymmdd: string;
  dryRun: boolean;
  concurrency: number;
  pickedPath: string;
  overrides: Partial<TopicRequest>;
  timing: {
    startedAt: string;
    finishedAt: string;
    totalMs: number;
  };
  totals: {
    total: number;
    willRun: number;
    ok: number;
    failed: number;
    skipped: number;
  };
  items: BatchRunResultItem[];
  gate?: BatchRunReportGate;
  executionSource?: "runlist" | "picked";
  runListPath?: string;
};
