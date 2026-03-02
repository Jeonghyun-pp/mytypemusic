"use client";

import { useState, useEffect, useCallback } from "react";

export interface BenchmarkReportSummary {
  id: string;
  title: string;
  source: string;
  imageCount: number;
  createdAt: string;
  updatedAt: string;
  screenshots: Array<{ dataUri: string; label: string }> | null;
}

export interface BenchmarkReportFull extends BenchmarkReportSummary {
  slideComposition: Record<string, unknown> | null;
  writingStyle: Record<string, unknown> | null;
  visualDesign: Record<string, unknown> | null;
  insights: Record<string, unknown> | null;
  rawAnalysis: Record<string, unknown> | null;
}

export function useResearchReports() {
  const [reports, setReports] = useState<BenchmarkReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/db/research")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) =>
        setReports(Array.isArray(data) ? (data as BenchmarkReportSummary[]) : []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addReport = useCallback((report: BenchmarkReportSummary) => {
    setReports((prev) => [report, ...prev]);
  }, []);

  const deleteReport = useCallback(async (id: string) => {
    const res = await fetch(`/api/db/research/${id}`, { method: "DELETE" });
    if (res.ok) setReports((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { reports, loading, addReport, deleteReport };
}

export async function fetchReportDetail(
  id: string,
): Promise<BenchmarkReportFull | null> {
  try {
    const res = await fetch(`/api/db/research/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as BenchmarkReportFull;
  } catch {
    return null;
  }
}
