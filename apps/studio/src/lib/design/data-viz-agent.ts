/**
 * Data Visualization Agent — generates chart data and renders as infographic slides.
 *
 * Pipeline:
 *   1. LLM extracts structured data from content
 *   2. Selects appropriate chart type
 *   3. Generates Satori-compatible HTML with inline SVG charts
 *   4. Returns DataVizResult for the design pipeline
 */

import { z } from "zod";
import { callGptJson } from "../llm";
import type { DesignBrief, DataVizResult, ChartType } from "./types";
import type { BrandKit } from "./brand-kit";
import { DEFAULT_BRAND_KIT } from "./brand-kit";

// ── Types ───────────────────────────────────────────

export interface DataVizOptions {
  model?: string;
  chartType?: ChartType;    // override auto-detection
  brandKit?: BrandKit;
  width?: number;
  height?: number;
}

interface ExtractedDataPoint {
  label: string;
  value: number;
  category?: string;
}

interface ExtractedChartData {
  chartType: ChartType;
  title: string;
  subtitle: string;
  dataPoints: ExtractedDataPoint[];
  unit: string;
  insight: string;
  sourceNote: string;
}

// ── Zod schema for LLM response ─────────────────────

const chartDataSchema = z.object({
  chartType: z.enum(["bar", "line", "area", "donut", "radar", "scatter", "treemap"]),
  title: z.string(),
  subtitle: z.string().default(""),
  dataPoints: z.array(z.object({
    label: z.string(),
    value: z.number(),
    category: z.string().optional(),
  })).min(2),
  unit: z.string().default(""),
  insight: z.string(),
  sourceNote: z.string().default(""),
});

// ── Default chart colors ────────────────────────────

const CHART_COLORS = [
  "#6C5CE7", "#00CEC9", "#FD79A8", "#FDCB6E", "#E17055",
  "#74B9FF", "#A29BFE", "#55EFC4", "#FF7675", "#DFE6E9",
];

// ── Main function ───────────────────────────────────

/**
 * Extract data from content and generate a visualization.
 */
export async function generateDataViz(
  brief: DesignBrief,
  content: string,
  opts?: DataVizOptions,
): Promise<DataVizResult> {
  const kit = opts?.brandKit ?? DEFAULT_BRAND_KIT;
  const width = opts?.width ?? 1080;
  const height = opts?.height ?? 1080;

  // 1. Extract structured data via LLM
  const chartData = await extractChartData(brief, content, opts?.chartType, opts?.model);

  // 2. Generate chart config
  const chartConfig = buildChartConfig(chartData, kit);

  return {
    chartType: chartData.chartType,
    chartConfig,
    narrativeOverlay: chartData.insight,
    width,
    height,
  };
}

// ── Data extraction ─────────────────────────────────

async function extractChartData(
  brief: DesignBrief,
  content: string,
  preferredType?: ChartType,
  model?: string,
): Promise<ExtractedChartData> {
  const typeHint = preferredType
    ? `\nPreferred chart type: ${preferredType}`
    : "";

  const prompt = `You are a Data Visualization Analyst for a Korean music/culture web magazine.

Analyze the content below and extract structured data suitable for chart visualization.

## Content Brief
- Content Type: ${brief.contentType}
- Key Message: ${brief.keyMessage}
- Mood: ${brief.mood}

## Content
${content.slice(0, 3000)}
${typeHint}

## Chart Type Guide
- "bar": Rankings, comparisons, categorical data (streaming numbers, album sales, votes)
- "line": Time series, trends over periods (chart positions, listener growth)
- "area": Cumulative trends, filled time series
- "donut": Proportions, market share, genre distribution
- "radar": Multi-dimensional profiles (audio features like energy, danceability, valence)
- "scatter": Correlations (tempo vs. energy, followers vs. engagement)
- "treemap": Hierarchical data, nested categories

## Rules
1. Extract REAL data from the content when possible
2. If no specific numbers exist, create illustrative but realistic data
3. Title and insight MUST be in Korean
4. Keep data points between 3-10 for readability
5. Choose the chart type that best tells the story

Respond in JSON:
{
  "chartType": "<type>",
  "title": "<Korean title>",
  "subtitle": "<Korean subtitle>",
  "dataPoints": [{ "label": "<label>", "value": <number>, "category": "<optional>" }],
  "unit": "<unit like '만 회', '%', '점'>",
  "insight": "<key insight in Korean, 1-2 sentences>",
  "sourceNote": "<data source note>"
}`;

  return callGptJson<ExtractedChartData>(prompt, {
    model: model ?? "gpt-4o-mini",
    schema: chartDataSchema,
  });
}

// ── Chart config builder ────────────────────────────

function buildChartConfig(
  data: ExtractedChartData,
  kit: BrandKit,
): Record<string, unknown> {
  const colors = [kit.colors.primary, kit.colors.accent, ...CHART_COLORS];

  return {
    type: data.chartType,
    title: data.title,
    subtitle: data.subtitle,
    data: data.dataPoints.map((dp, i) => ({
      ...dp,
      color: colors[i % colors.length],
    })),
    unit: data.unit,
    insight: data.insight,
    sourceNote: data.sourceNote,
    colors: colors.slice(0, data.dataPoints.length),
    style: {
      backgroundColor: kit.colors.background.dark,
      textColor: kit.colors.text.primary,
      mutedColor: kit.colors.text.secondary,
      gridColor: "rgba(255,255,255,0.1)",
      fontFamily: `${kit.typography.heading.fontFamily}, sans-serif`,
    },
  };
}

/**
 * Generate inline SVG chart HTML for Satori rendering.
 * Returns Satori-compatible HTML string with the chart.
 */
export function renderChartToHtml(
  config: Record<string, unknown>,
  width: number = 1080,
  height: number = 1080,
): string {
  const type = config.type as ChartType;
  const title = config.title as string;
  const subtitle = config.subtitle as string;
  const data = config.data as Array<{ label: string; value: number; color: string }>;
  const unit = (config.unit as string) ?? "";
  const insight = config.insight as string;
  const style = config.style as {
    backgroundColor: string;
    textColor: string;
    mutedColor: string;
    gridColor: string;
    fontFamily: string;
  };

  const chartAreaH = Math.round(height * 0.45);
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  let chartSvg = "";
  switch (type) {
    case "bar":
      chartSvg = renderBarChart(data, width - 120, chartAreaH, maxVal);
      break;
    case "donut":
      chartSvg = renderDonutChart(data, Math.min(width - 120, chartAreaH));
      break;
    case "line":
    case "area":
      chartSvg = renderLineChart(data, width - 120, chartAreaH, maxVal, type === "area");
      break;
    case "radar":
      chartSvg = renderRadarChart(data, Math.min(width - 120, chartAreaH), maxVal);
      break;
    default:
      chartSvg = renderBarChart(data, width - 120, chartAreaH, maxVal);
  }

  // Legend
  const legendItems = data.map((d) =>
    `<div style="display:flex;align-items:center;gap:8px">` +
    `<div style="width:12px;height:12px;border-radius:3px;background:${d.color};flex-shrink:0"></div>` +
    `<div style="font-size:14px;color:${style.mutedColor}">${d.label}</div>` +
    `</div>`
  ).join("");

  return `<div style="display:flex;flex-direction:column;width:${width}px;height:${height}px;background:${style.backgroundColor};padding:60px;font-family:${style.fontFamily};gap:24px">
  <div style="display:flex;flex-direction:column;gap:8px">
    <div style="font-size:36px;font-weight:700;color:${style.textColor}">${escapeHtml(title)}</div>
    ${subtitle ? `<div style="font-size:20px;font-weight:400;color:${style.mutedColor}">${escapeHtml(subtitle)}</div>` : ""}
  </div>
  <div style="display:flex;justify-content:center;align-items:center;flex:1">
    ${chartSvg}
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:16px;justify-content:center">
    ${legendItems}
  </div>
  <div style="display:flex;flex-direction:column;gap:8px;padding:20px;background:rgba(255,255,255,0.05);border-radius:12px">
    <div style="font-size:18px;font-weight:600;color:${style.textColor}">${escapeHtml(insight)}</div>
  </div>
</div>`;
}

// ── SVG chart renderers ─────────────────────────────

function renderBarChart(
  data: Array<{ label: string; value: number; color: string }>,
  w: number, h: number, maxVal: number,
): string {
  if (data.length === 0) return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"></svg>`;
  const barW = Math.min(60, Math.floor((w - data.length * 8) / data.length));
  const gap = 8;
  const totalW = data.length * (barW + gap) - gap;
  const startX = (w - totalW) / 2;

  const bars = data.map((d, i) => {
    const barH = (d.value / maxVal) * (h - 40);
    const x = startX + i * (barW + gap);
    const y = h - barH - 20;
    return `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="${d.color}" />` +
      `<text x="${x + barW / 2}" y="${h - 4}" text-anchor="middle" fill="#999" font-size="11">${d.label.slice(0, 6)}</text>` +
      `<text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" fill="#fff" font-size="12" font-weight="600">${formatVal(d.value)}</text>`;
  }).join("");

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bars}</svg>`;
}

function renderDonutChart(
  data: Array<{ label: string; value: number; color: string }>,
  size: number,
): string {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.35;
  const innerR = r * 0.6;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  let cumAngle = -Math.PI / 2;
  const arcs = data.map((d) => {
    const angle = (d.value / total) * Math.PI * 2;

    // Full circle (single segment) — SVG arc can't draw start==end
    if (data.length === 1 || angle >= Math.PI * 2 - 0.001) {
      const midA = cumAngle + Math.PI;
      const ox1 = cx + r * Math.cos(cumAngle);
      const oy1 = cy + r * Math.sin(cumAngle);
      const ox2 = cx + r * Math.cos(midA);
      const oy2 = cy + r * Math.sin(midA);
      cumAngle += angle;
      return `<path d="M${ox1},${oy1} A${r},${r} 0 0 1 ${ox2},${oy2} A${r},${r} 0 0 1 ${ox1},${oy1} Z" fill="${d.color}" />` +
        `<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="${"#1A1A2E"}" />`;
    }

    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    const x2 = cx + r * Math.cos(cumAngle + angle);
    const y2 = cy + r * Math.sin(cumAngle + angle);
    const ix1 = cx + innerR * Math.cos(cumAngle + angle);
    const iy1 = cy + innerR * Math.sin(cumAngle + angle);
    const ix2 = cx + innerR * Math.cos(cumAngle);
    const iy2 = cy + innerR * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    cumAngle += angle;
    return `<path d="M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix1},${iy1} A${innerR},${innerR} 0 ${large} 0 ${ix2},${iy2} Z" fill="${d.color}" />`;
  }).join("");

  // Center text
  const centerText = `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="24" font-weight="700">${formatVal(total)}</text>`;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${arcs}${centerText}</svg>`;
}

function renderLineChart(
  data: Array<{ label: string; value: number; color: string }>,
  w: number, h: number, maxVal: number, filled: boolean,
): string {
  const padX = 40;
  const padY = 30;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;
  const color = data[0]?.color ?? "#6C5CE7";

  const points = data.map((d, i) => ({
    x: padX + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padY + chartH - (d.value / maxVal) * chartH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  let fill = "";
  if (filled && points.length > 0) {
    const areaPath = linePath +
      ` L${points[points.length - 1]!.x},${padY + chartH} L${points[0]!.x},${padY + chartH} Z`;
    fill = `<path d="${areaPath}" fill="${color}" opacity="0.2" />`;
  }

  const dots = points.map((p) =>
    `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}" />`
  ).join("");

  const labels = data.map((d, i) =>
    `<text x="${points[i]!.x}" y="${padY + chartH + 18}" text-anchor="middle" fill="#999" font-size="11">${d.label.slice(0, 6)}</text>`
  ).join("");

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${fill}
    <path d="${linePath}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    ${dots}${labels}
  </svg>`;
}

function renderRadarChart(
  data: Array<{ label: string; value: number; color: string }>,
  size: number, maxVal: number,
): string {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.35;
  const n = data.length;
  const color = data[0]?.color ?? "#6C5CE7";

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1].map((frac) => {
    const pts = Array.from({ length: n }, (_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return `${cx + r * frac * Math.cos(angle)},${cy + r * frac * Math.sin(angle)}`;
    });
    return `<polygon points="${pts.join(" ")}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1" />`;
  }).join("");

  // Data shape
  const dataPts = data.map((d, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const val = (d.value / maxVal) * r;
    return `${cx + val * Math.cos(angle)},${cy + val * Math.sin(angle)}`;
  });

  const shape = `<polygon points="${dataPts.join(" ")}" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="2" />`;

  // Labels
  const labels = data.map((d, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const lx = cx + (r + 20) * Math.cos(angle);
    const ly = cy + (r + 20) * Math.sin(angle);
    return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" fill="#ccc" font-size="12">${d.label.slice(0, 8)}</text>`;
  }).join("");

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rings}${shape}${labels}</svg>`;
}

// ── Helpers ─────────────────────────────────────────

function formatVal(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(1)}만`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toFixed(v % 1 === 0 ? 0 : 1);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
