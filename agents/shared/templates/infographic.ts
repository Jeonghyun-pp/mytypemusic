/**
 * Infographic templates — data-driven visual layouts.
 *
 * 4 templates:
 *   1. bar.v1 — Horizontal bar ranking with value labels
 *   2. donut.v1 — Donut chart with center stat
 *   3. comparison.v1 — Side-by-side metric comparison
 *   4. timeline.v1 — Vertical timeline with milestones
 */
import type { TemplateConfig, SlideRenderSpec } from "./types";
import { cw, ch, sx, sy, escapeHtml, bgStyle, ls } from "./util";

// ── Helpers ──────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  let r = parseInt(h.slice(0, 2), 16);
  let g = parseInt(h.slice(2, 4), 16);
  let b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r)) r = 0;
  if (isNaN(g)) g = 0;
  if (isNaN(b)) b = 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Parse bodyText lines as data: "Label | Value" or "Label | Value | Extra" */
function parseDataLines(body: string): Array<{ label: string; value: string; extra?: string }> {
  return body.split("\n").filter(Boolean).map((line) => {
    const parts = line.split("|").map((s) => s.trim());
    return { label: parts[0] ?? "", value: parts[1] ?? "", extra: parts[2] };
  });
}

// ── 1. Bar Chart Infographic ────────────────────────

export const INFOGRAPHIC_BAR_V1_CONFIG: TemplateConfig = {
  id: "infographic.bar.v1",
  kind: "infographic",
  label: "Bar Chart",
  description: "Horizontal bar ranking with value labels",
  defaultBg: "linear-gradient(160deg, #0F0F23 0%, #1A1A3E 100%)",
  defaults: { titleSizePx: 36, bodySizePx: 18, footerSizePx: 14, titleWeight: 700, bodyWeight: 400 },
};

export function renderInfographicBarV1(input: SlideRenderSpec): string {
  const w = cw(input);
  const h = ch(input);
  const accent = input.accentColor ?? "#6C5CE7";
  const textC = input.textColor ?? "#FFFFFF";
  const mutedC = input.footerColor ?? "#999999";
  const data = parseDataLines(input.bodyText);
  const maxNum = Math.max(...data.map((d) => parseFloat(d.value) || 0), 1);

  const bars = data.slice(0, 8).map((d, i) => {
    const numVal = parseFloat(d.value) || 0;
    const pct = (numVal / maxNum) * 100;
    const colors = ["#6C5CE7", "#00CEC9", "#FD79A8", "#FDCB6E", "#E17055", "#74B9FF", "#A29BFE", "#55EFC4"];
    const barColor = colors[i % colors.length]!;
    return `<div style="display:flex;align-items:center;gap:${sx(16, input)}px;width:100%">
      <div style="width:${sx(120, input)}px;font-size:${sx(16, input)}px;color:${textC};text-align:right;flex-shrink:0">${escapeHtml(d.label)}</div>
      <div style="flex:1;height:${sy(32, input)}px;background:${hexToRgba(barColor, 0.15)};border-radius:${sx(6, input)}px;overflow:hidden;display:flex">
        <div style="width:${pct}%;height:100%;background:${barColor};border-radius:${sx(6, input)}px;display:flex;align-items:center;justify-content:flex-end;padding-right:${sx(8, input)}px">
          <div style="font-size:${sx(13, input)}px;font-weight:600;color:#fff">${escapeHtml(d.value)}</div>
        </div>
      </div>
    </div>`;
  }).join("");

  return `<div style="display:flex;flex-direction:column;width:${w}px;height:${h}px;${bgStyle(input, INFOGRAPHIC_BAR_V1_CONFIG.defaultBg)};padding:${sx(60, input)}px;font-family:${input.fontFamily ?? "Pretendard, sans-serif"};gap:${sy(24, input)}px">
    <div style="display:flex;flex-direction:column;gap:${sy(8, input)}px">
      <div style="font-size:${sx(input.titleSizePx ?? 36, input)}px;font-weight:${input.titleWeight ?? 700};color:${textC};letter-spacing:${ls(input.letterSpacing)}">${escapeHtml(input.title)}</div>
      <div style="width:${sx(60, input)}px;height:3px;background:${accent};display:flex"></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:${sy(16, input)}px;flex:1;justify-content:center">
      ${bars}
    </div>
    <div style="font-size:${sx(input.bodySizePx ?? 14, input)}px;color:${mutedC}">${escapeHtml(input.footerText)}</div>
  </div>`;
}

// ── 2. Donut Chart Infographic ──────────────────────

export const INFOGRAPHIC_DONUT_V1_CONFIG: TemplateConfig = {
  id: "infographic.donut.v1",
  kind: "infographic",
  label: "Donut Chart",
  description: "Donut chart with center stat and legend",
  defaultBg: "linear-gradient(160deg, #0F0F23 0%, #1A1A3E 100%)",
  defaults: { titleSizePx: 36, bodySizePx: 16, footerSizePx: 14, titleWeight: 700, bodyWeight: 400 },
};

export function renderInfographicDonutV1(input: SlideRenderSpec): string {
  const w = cw(input);
  const h = ch(input);
  const textC = input.textColor ?? "#FFFFFF";
  const mutedC = input.footerColor ?? "#999999";
  const accent = input.accentColor ?? "#6C5CE7";
  const data = parseDataLines(input.bodyText);
  const colors = ["#6C5CE7", "#00CEC9", "#FD79A8", "#FDCB6E", "#E17055", "#74B9FF", "#A29BFE", "#55EFC4"];

  // SVG donut
  const total = data.reduce((s, d) => s + (parseFloat(d.value) || 0), 0) || 1;
  const cx = 150, cy = 150, r = 120, ir = 75;
  let cum = -Math.PI / 2;
  const slicedData = data.slice(0, 6);
  const arcs = slicedData.map((d, i) => {
    const val = parseFloat(d.value) || 0;
    const angle = (val / total) * Math.PI * 2;
    const color = colors[i % colors.length]!;

    // Full circle (single segment) — SVG arc can't draw start==end, use two half-arcs
    if (slicedData.length === 1 || angle >= Math.PI * 2 - 0.001) {
      const midAngle = cum + Math.PI;
      const mx1 = cx + r * Math.cos(cum);
      const my1 = cy + r * Math.sin(cum);
      const mx2 = cx + r * Math.cos(midAngle);
      const my2 = cy + r * Math.sin(midAngle);
      const imx1 = cx + ir * Math.cos(cum);
      const imy1 = cy + ir * Math.sin(cum);
      const imx2 = cx + ir * Math.cos(midAngle);
      const imy2 = cy + ir * Math.sin(midAngle);
      cum += angle;
      return `<path d="M${mx1},${my1} A${r},${r} 0 0 1 ${mx2},${my2} A${r},${r} 0 0 1 ${mx1},${my1} Z" fill="${color}" />` +
        `<path d="M${imx1},${imy1} A${ir},${ir} 0 0 1 ${imx2},${imy2} A${ir},${ir} 0 0 1 ${imx1},${imy1} Z" fill="${slicedData.length === 1 ? "#0F0F23" : color}" />`;
    }

    const x1 = cx + r * Math.cos(cum);
    const y1 = cy + r * Math.sin(cum);
    const x2 = cx + r * Math.cos(cum + angle);
    const y2 = cy + r * Math.sin(cum + angle);
    const ix1 = cx + ir * Math.cos(cum + angle);
    const iy1 = cy + ir * Math.sin(cum + angle);
    const ix2 = cx + ir * Math.cos(cum);
    const iy2 = cy + ir * Math.sin(cum);
    const lg = angle > Math.PI ? 1 : 0;
    cum += angle;
    return `<path d="M${x1},${y1} A${r},${r} 0 ${lg} 1 ${x2},${y2} L${ix1},${iy1} A${ir},${ir} 0 ${lg} 0 ${ix2},${iy2} Z" fill="${color}" />`;
  }).join("");

  const svgSize = sx(300, input);

  const legend = data.slice(0, 6).map((d, i) =>
    `<div style="display:flex;align-items:center;gap:${sx(10, input)}px">
      <div style="width:${sx(14, input)}px;height:${sx(14, input)}px;border-radius:3px;background:${colors[i % colors.length]};flex-shrink:0;display:flex"></div>
      <div style="font-size:${sx(16, input)}px;color:${textC}">${escapeHtml(d.label)}</div>
      <div style="font-size:${sx(16, input)}px;font-weight:600;color:${mutedC};margin-left:auto">${escapeHtml(d.value)}</div>
    </div>`
  ).join("");

  return `<div style="display:flex;flex-direction:column;width:${w}px;height:${h}px;${bgStyle(input, INFOGRAPHIC_DONUT_V1_CONFIG.defaultBg)};padding:${sx(60, input)}px;font-family:${input.fontFamily ?? "Pretendard, sans-serif"};gap:${sy(24, input)}px">
    <div style="display:flex;flex-direction:column;gap:${sy(8, input)}px">
      <div style="font-size:${sx(input.titleSizePx ?? 36, input)}px;font-weight:700;color:${textC}">${escapeHtml(input.title)}</div>
      <div style="width:${sx(60, input)}px;height:3px;background:${accent};display:flex"></div>
    </div>
    <div style="display:flex;justify-content:center;align-items:center;flex:1">
      <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 300 300">${arcs}<text x="150" y="150" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="28" font-weight="700">${Math.round(total)}</text></svg>
    </div>
    <div style="display:flex;flex-direction:column;gap:${sy(12, input)}px;padding:${sx(20, input)}px;background:rgba(255,255,255,0.05);border-radius:12px">
      ${legend}
    </div>
    <div style="font-size:${sx(14, input)}px;color:${mutedC}">${escapeHtml(input.footerText)}</div>
  </div>`;
}

// ── 3. Comparison Infographic ───────────────────────

export const INFOGRAPHIC_COMPARISON_V1_CONFIG: TemplateConfig = {
  id: "infographic.comparison.v1",
  kind: "infographic",
  label: "Comparison",
  description: "Side-by-side metric comparison (vs.)",
  defaultBg: "linear-gradient(160deg, #0F0F23 0%, #1A1A3E 100%)",
  defaults: { titleSizePx: 36, bodySizePx: 18, footerSizePx: 14, titleWeight: 700, bodyWeight: 400 },
};

export function renderInfographicComparisonV1(input: SlideRenderSpec): string {
  const w = cw(input);
  const h = ch(input);
  const textC = input.textColor ?? "#FFFFFF";
  const mutedC = input.footerColor ?? "#999999";
  const accent = input.accentColor ?? "#6C5CE7";
  const data = parseDataLines(input.bodyText);
  // Expected format: "Metric | Left Value | Right Value"
  // First line is header: "Left Name | Right Name"
  const header = data[0];
  const metrics = data.slice(1, 7);

  const leftName = header?.label ?? "A";
  const rightName = header?.value ?? "B";

  const rows = metrics.map((d) =>
    `<div style="display:flex;align-items:center;gap:${sx(16, input)}px;width:100%">
      <div style="flex:1;text-align:right;font-size:${sx(22, input)}px;font-weight:700;color:#00CEC9">${escapeHtml(d.value)}</div>
      <div style="width:${sx(160, input)}px;text-align:center;font-size:${sx(16, input)}px;color:${mutedC}">${escapeHtml(d.label)}</div>
      <div style="flex:1;text-align:left;font-size:${sx(22, input)}px;font-weight:700;color:#FD79A8">${escapeHtml(d.extra ?? "")}</div>
    </div>`
  ).join("");

  return `<div style="display:flex;flex-direction:column;width:${w}px;height:${h}px;${bgStyle(input, INFOGRAPHIC_COMPARISON_V1_CONFIG.defaultBg)};padding:${sx(60, input)}px;font-family:${input.fontFamily ?? "Pretendard, sans-serif"};gap:${sy(24, input)}px">
    <div style="display:flex;flex-direction:column;gap:${sy(8, input)}px;align-items:center">
      <div style="font-size:${sx(input.titleSizePx ?? 36, input)}px;font-weight:700;color:${textC};text-align:center">${escapeHtml(input.title)}</div>
      <div style="width:${sx(60, input)}px;height:3px;background:${accent};display:flex"></div>
    </div>
    <div style="display:flex;justify-content:center;gap:${sx(40, input)}px;padding:${sy(20, input)}px 0">
      <div style="font-size:${sx(28, input)}px;font-weight:700;color:#00CEC9">${escapeHtml(leftName)}</div>
      <div style="font-size:${sx(24, input)}px;color:${mutedC}">VS</div>
      <div style="font-size:${sx(28, input)}px;font-weight:700;color:#FD79A8">${escapeHtml(rightName)}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:${sy(20, input)}px;flex:1;justify-content:center">
      ${rows}
    </div>
    <div style="font-size:${sx(14, input)}px;color:${mutedC};text-align:center">${escapeHtml(input.footerText)}</div>
  </div>`;
}

// ── 4. Timeline Infographic ─────────────────────────

export const INFOGRAPHIC_TIMELINE_V1_CONFIG: TemplateConfig = {
  id: "infographic.timeline.v1",
  kind: "infographic",
  label: "Timeline",
  description: "Vertical timeline with milestones",
  defaultBg: "linear-gradient(160deg, #0F0F23 0%, #1A1A3E 100%)",
  defaults: { titleSizePx: 36, bodySizePx: 16, footerSizePx: 14, titleWeight: 700, bodyWeight: 400 },
};

export function renderInfographicTimelineV1(input: SlideRenderSpec): string {
  const w = cw(input);
  const h = ch(input);
  const textC = input.textColor ?? "#FFFFFF";
  const mutedC = input.footerColor ?? "#999999";
  const accent = input.accentColor ?? "#6C5CE7";
  const data = parseDataLines(input.bodyText);
  const colors = ["#6C5CE7", "#00CEC9", "#FD79A8", "#FDCB6E", "#E17055", "#74B9FF"];

  const items = data.slice(0, 6).map((d, i) => {
    const dotColor = colors[i % colors.length]!;
    const isLast = i === Math.min(data.length, 6) - 1;
    return `<div style="display:flex;gap:${sx(20, input)}px">
      <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:${sx(40, input)}px">
        <div style="width:${sx(16, input)}px;height:${sx(16, input)}px;border-radius:50%;background:${dotColor};flex-shrink:0;display:flex"></div>
        ${isLast ? "" : `<div style="width:2px;flex:1;background:${hexToRgba(dotColor, 0.3)};display:flex"></div>`}
      </div>
      <div style="display:flex;flex-direction:column;gap:${sy(4, input)}px;padding-bottom:${sy(24, input)}px">
        <div style="font-size:${sx(14, input)}px;font-weight:600;color:${dotColor}">${escapeHtml(d.value)}</div>
        <div style="font-size:${sx(18, input)}px;font-weight:600;color:${textC}">${escapeHtml(d.label)}</div>
        ${d.extra ? `<div style="font-size:${sx(14, input)}px;color:${mutedC}">${escapeHtml(d.extra)}</div>` : ""}
      </div>
    </div>`;
  }).join("");

  return `<div style="display:flex;flex-direction:column;width:${w}px;height:${h}px;${bgStyle(input, INFOGRAPHIC_TIMELINE_V1_CONFIG.defaultBg)};padding:${sx(60, input)}px;font-family:${input.fontFamily ?? "Pretendard, sans-serif"};gap:${sy(24, input)}px">
    <div style="display:flex;flex-direction:column;gap:${sy(8, input)}px">
      <div style="font-size:${sx(input.titleSizePx ?? 36, input)}px;font-weight:700;color:${textC}">${escapeHtml(input.title)}</div>
      <div style="width:${sx(60, input)}px;height:3px;background:${accent};display:flex"></div>
    </div>
    <div style="display:flex;flex-direction:column;flex:1;justify-content:center">
      ${items}
    </div>
    <div style="font-size:${sx(14, input)}px;color:${mutedC}">${escapeHtml(input.footerText)}</div>
  </div>`;
}
