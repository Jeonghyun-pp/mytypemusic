"use client";

import { useEffect, useState } from "react";
import { LineChart, BarChart } from "../_components/MiniChart";

interface QualityStats {
  totalDesigns: number;
  averageScore: number;
  passRate: number;
  averageIterations: number;
  averageTimeMs: number;
  byVerdict: Record<string, number>;
  byDesignPath: Record<string, { count: number; avgScore: number }>;
  byContentType: Record<string, { count: number; avgScore: number }>;
}

interface QualityTrend {
  period: string;
  count: number;
  avgScore: number;
  passRate: number;
}

interface StyleInsight {
  attribute: string;
  value: string;
  avgEngagementRate: number;
  sampleSize: number;
  comparedToAvg: number;
}

interface TopTemplate {
  templateId: string;
  avgEngagementRate: number;
  sampleSize: number;
}

interface HeatmapCell {
  dayOfWeek: number;
  hourOfDay: number;
  avgEngagement: number;
  count: number;
}

interface ContentTypePerf {
  contentType: string;
  avgEngagement: number;
  count: number;
}

interface DesignAnalytics {
  days: number;
  qualityStats: QualityStats;
  qualityTrends: QualityTrend[];
  styleInsights: StyleInsight[];
  performanceSummary: {
    totalRecords: number;
    withEngagement: number;
    avgEngagementRate: number;
    topContentType: string | null;
    topPlatform: string | null;
  };
  topTemplates: TopTemplate[];
  heatmap: HeatmapCell[];
  contentTypePerf: ContentTypePerf[];
}

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const CONTENT_TYPE_LABELS: Record<string, string> = {
  album_review: "앨범 리뷰",
  artist_spotlight: "아티스트 스포트라이트",
  trending: "트렌딩",
  data_insight: "데이터 인사이트",
  list_ranking: "리스트/랭킹",
  general: "일반",
};
const VERDICT_LABELS: Record<string, string> = {
  pass: "합격",
  refine: "개선",
  regenerate: "재생성",
};
const PATH_LABELS: Record<string, string> = {
  template: "템플릿",
  generated: "AI 생성",
  motion: "모션",
  data_viz: "데이터 시각화",
};

const s = {
  page: {
    padding: "24px 32px",
    maxWidth: "1200px",
    margin: "0 auto",
    fontFamily: "var(--font-sans)",
  } as const,
  h1: {
    fontSize: "22px",
    fontWeight: 700,
    marginBottom: "24px",
    color: "var(--text)",
  } as const,
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "12px",
    marginBottom: "28px",
  } as const,
  statCard: {
    padding: "16px",
    borderRadius: "12px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
  } as const,
  statLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } as const,
  statValue: {
    fontSize: "28px",
    fontWeight: 700,
    color: "var(--text)",
    marginTop: "4px",
  } as const,
  statSub: {
    fontSize: "12px",
    color: "var(--text-muted)",
    marginTop: "2px",
  } as const,
  section: {
    marginBottom: "28px",
  } as const,
  h2: {
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: "12px",
  } as const,
  chartCard: {
    padding: "16px",
    borderRadius: "12px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
  } as const,
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "28px",
  } as const,
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "13px",
  } as const,
  th: {
    textAlign: "left" as const,
    padding: "8px 10px",
    borderBottom: "1px solid var(--border-light)",
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
  } as const,
  td: {
    padding: "8px 10px",
    borderBottom: "1px solid var(--border-light)",
    color: "var(--text)",
  } as const,
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={s.statCard}>
      <div style={s.statLabel}>{label}</div>
      <div style={s.statValue}>{value}</div>
      {sub && <div style={s.statSub}>{sub}</div>}
    </div>
  );
}

function HeatmapChart({ data }: { data: HeatmapCell[] }) {
  if (data.length === 0) {
    return <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>발행 데이터가 아직 없습니다.</div>;
  }

  const maxEng = Math.max(...data.map((d) => d.avgEngagement), 0.001);
  const hours = [6, 8, 10, 12, 14, 16, 18, 20, 22];
  const cellSize = 28;
  const gap = 2;

  const getCell = (day: number, hour: number) => data.find((d) => d.dayOfWeek === day && d.hourOfDay === hour);

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap: `${gap}px`, fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px", paddingLeft: "24px" }}>
        {hours.map((h) => (
          <div key={h} style={{ width: `${cellSize}px`, textAlign: "center" }}>{h}시</div>
        ))}
      </div>
      {DAY_LABELS.map((day, dayIdx) => (
        <div key={dayIdx} style={{ display: "flex", gap: `${gap}px`, alignItems: "center", marginBottom: `${gap}px` }}>
          <span style={{ width: "20px", fontSize: "10px", color: "var(--text-muted)", textAlign: "right" }}>{day}</span>
          {hours.map((h) => {
            const cell = getCell(dayIdx, h);
            const intensity = cell ? cell.avgEngagement / maxEng : 0;
            return (
              <div
                key={h}
                title={cell ? `${day} ${h}시: ${(cell.avgEngagement * 100).toFixed(1)}% (${cell.count}건)` : `${day} ${h}시: 데이터 없음`}
                style={{
                  width: `${cellSize}px`,
                  height: `${cellSize}px`,
                  borderRadius: "4px",
                  background: intensity > 0
                    ? `rgba(91, 95, 199, ${0.15 + intensity * 0.85})`
                    : "var(--bg-input)",
                  cursor: "default",
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function InsightsTable({ insights }: { insights: StyleInsight[] }) {
  if (insights.length === 0) {
    return <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>스타일 인사이트 데이터가 아직 없습니다.</div>;
  }

  return (
    <table style={s.table}>
      <thead>
        <tr>
          <th style={s.th}>속성</th>
          <th style={s.th}>값</th>
          <th style={s.th}>참여율</th>
          <th style={s.th}>평균 대비</th>
          <th style={s.th}>샘플</th>
        </tr>
      </thead>
      <tbody>
        {insights.slice(0, 10).map((ins, i) => (
          <tr key={i}>
            <td style={s.td}>{ins.attribute}</td>
            <td style={s.td}>{ins.value}</td>
            <td style={s.td}>{(ins.avgEngagementRate * 100).toFixed(2)}%</td>
            <td style={{ ...s.td, color: ins.comparedToAvg >= 0 ? "var(--green, #22c55e)" : "var(--red, #ef4444)" }}>
              {ins.comparedToAvg >= 0 ? "+" : ""}{(ins.comparedToAvg * 100).toFixed(1)}%
            </td>
            <td style={s.td}>{ins.sampleSize}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DesignAnalyticsPage() {
  const [data, setData] = useState<DesignAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics/design?days=30")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DesignAnalytics>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ ...s.page, textAlign: "center", paddingTop: "100px", color: "var(--text-muted)" }}>로딩 중...</div>;
  }
  if (error || !data) {
    return <div style={{ ...s.page, textAlign: "center", paddingTop: "100px", color: "var(--red, #ef4444)" }}>오류: {error}</div>;
  }

  const { qualityStats: q, qualityTrends, styleInsights, performanceSummary: ps, topTemplates, heatmap, contentTypePerf } = data;

  return (
    <div style={s.page}>
      <h1 style={s.h1}>디자인 분석 대시보드</h1>

      {/* ── Summary Stats ──────────────────── */}
      <div style={s.grid}>
        <StatCard label="총 디자인" value={String(q.totalDesigns)} />
        <StatCard
          label="평균 품질 점수"
          value={q.averageScore.toFixed(1)}
          sub="10점 만점"
        />
        <StatCard
          label="합격률"
          value={`${(q.passRate * 100).toFixed(0)}%`}
          sub={`합격 ${q.byVerdict.pass ?? 0} / 개선 ${q.byVerdict.refine ?? 0} / 재생성 ${q.byVerdict.regenerate ?? 0}`}
        />
        <StatCard
          label="평균 반복"
          value={q.averageIterations.toFixed(1)}
          sub={`생성시간 ${(q.averageTimeMs / 1000).toFixed(1)}초`}
        />
        <StatCard
          label="평균 참여율"
          value={ps.avgEngagementRate > 0 ? `${(ps.avgEngagementRate * 100).toFixed(2)}%` : "-"}
          sub={`${ps.withEngagement}건 측정`}
        />
      </div>

      {/* ── Quality Trend Chart ──────────────── */}
      <div style={s.twoCol}>
        <div style={s.chartCard}>
          <h2 style={s.h2}>품질 점수 트렌드</h2>
          {qualityTrends.length >= 2 ? (
            <LineChart
              data={qualityTrends.map((t) => ({ label: t.period.slice(5), value: t.avgScore }))}
              color="#5B5FC7"
              label="일별 평균 점수"
            />
          ) : (
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>트렌드 데이터가 부족합니다.</div>
          )}
        </div>
        <div style={s.chartCard}>
          <h2 style={s.h2}>일별 합격률</h2>
          {qualityTrends.length >= 2 ? (
            <BarChart
              data={qualityTrends.map((t) => ({ label: t.period.slice(5), value: Math.round(t.passRate * 100) }))}
              color="#22c55e"
              label="합격률 (%)"
            />
          ) : (
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>트렌드 데이터가 부족합니다.</div>
          )}
        </div>
      </div>

      {/* ── Style Performance Insights ──────── */}
      <div style={s.section}>
        <h2 style={s.h2}>스타일 퍼포먼스 인사이트</h2>
        <div style={s.chartCard}>
          <InsightsTable insights={styleInsights} />
        </div>
      </div>

      {/* ── Content Type & Design Path ──────── */}
      <div style={s.twoCol}>
        <div style={s.chartCard}>
          <h2 style={s.h2}>콘텐츠 타입별 성과</h2>
          {contentTypePerf.length > 0 ? (
            <BarChart
              data={contentTypePerf.map((c) => ({
                label: CONTENT_TYPE_LABELS[c.contentType] ?? c.contentType,
                value: Math.round(c.avgEngagement * 10000) / 100,
              }))}
              color="#f59e0b"
              label="평균 참여율 (%)"
            />
          ) : (
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              콘텐츠 타입별 데이터가 아직 없습니다.
            </div>
          )}
        </div>
        <div style={s.chartCard}>
          <h2 style={s.h2}>디자인 경로별 품질</h2>
          {Object.keys(q.byDesignPath).length > 0 ? (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>경로</th>
                  <th style={s.th}>건수</th>
                  <th style={s.th}>평균 점수</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(q.byDesignPath).map(([path, d]) => (
                  <tr key={path}>
                    <td style={s.td}>{PATH_LABELS[path] ?? path}</td>
                    <td style={s.td}>{d.count}</td>
                    <td style={s.td}>{d.avgScore.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>경로별 데이터가 아직 없습니다.</div>
          )}
        </div>
      </div>

      {/* ── Optimal Posting Heatmap ─────────── */}
      <div style={s.section}>
        <h2 style={s.h2}>최적 발행 시간 히트맵</h2>
        <div style={s.chartCard}>
          <HeatmapChart data={heatmap} />
        </div>
      </div>

      {/* ── Top Templates ──────────────────── */}
      <div style={s.section}>
        <h2 style={s.h2}>상위 템플릿 (참여율 기준)</h2>
        <div style={s.chartCard}>
          {topTemplates.length > 0 ? (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>템플릿</th>
                  <th style={s.th}>참여율</th>
                  <th style={s.th}>샘플 수</th>
                </tr>
              </thead>
              <tbody>
                {topTemplates.map((t) => (
                  <tr key={t.templateId}>
                    <td style={s.td}>{t.templateId}</td>
                    <td style={s.td}>{(t.avgEngagementRate * 100).toFixed(2)}%</td>
                    <td style={s.td}>{t.sampleSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>템플릿 성과 데이터가 아직 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}
