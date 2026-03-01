/**
 * Cover slide templates — inline-style HTML for Satori.
 */
import type { SlideRenderSpec, TemplateConfig } from "./types";
import { cw, ch, escapeHtml, ls, bgStyle, heroBlock, sx, sy } from "./util";

// ── Metadata ─────────────────────────────────────────────

export const COVER_V1_CONFIG: TemplateConfig = {
  id: "cover.hero.v1",
  kind: "cover",
  label: "커버 V1 (중앙)",
  description: "중앙 상단 타이틀 + 220px 하단 스크림",
  defaultBg: "linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
  defaults: { titleSizePx: 72, bodySizePx: 30, footerSizePx: 22, titleWeight: 800, bodyWeight: 400 },
};

export const COVER_V2_CONFIG: TemplateConfig = {
  id: "cover.hero.v2",
  kind: "cover",
  label: "커버 V2 (좌측)",
  description: "좌측 정렬 하단 타이틀 + 360px 스크림",
  defaultBg: "linear-gradient(160deg, #1a0a2e 0%, #2d1b4e 40%, #4a2068 100%)",
  defaults: { titleSizePx: 56, bodySizePx: 28, footerSizePx: 22, titleWeight: 800, bodyWeight: 400 },
};

// ── Renderers ────────────────────────────────────────────

export function renderCoverV1(input: SlideRenderSpec): string {
  const cfg = COVER_V1_CONFIG.defaults;
  const w = cw(input);
  const h = ch(input);
  const titleSize = input.titleSizePx ?? cfg.titleSizePx;
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const bw = input.bodyWeight ?? cfg.bodyWeight;
  const tc = input.textColor ?? "#fff";
  const fc = input.footerColor ?? "rgba(255,255,255,0.7)";
  const spacing = ls(input.letterSpacing);

  const left = sx(80, input);
  const contentW = w - left * 2;
  const bodyLeft = sx(120, input);
  const bodyW = w - bodyLeft * 2;

  return `<div style="position:relative;width:${w}px;height:${h}px;${bgStyle(input, COVER_V1_CONFIG.defaultBg)}font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;align-items:center;">${heroBlock(input, sy(220, input))}
  <div style="position:absolute;top:${sy(260, input)}px;left:${left}px;width:${contentW}px;font-size:${titleSize}px;font-weight:${tw};line-height:1.25;text-align:center;letter-spacing:${spacing};display:flex;justify-content:center;">${escapeHtml(input.title)}</div>
  <div style="position:absolute;top:${sy(580, input)}px;left:${bodyLeft}px;width:${bodyW}px;font-size:${bodySize}px;font-weight:${bw};line-height:1.5;text-align:center;color:rgba(255,255,255,0.75);display:flex;justify-content:center;">${escapeHtml(input.bodyText)}</div>
  <div style="position:absolute;bottom:${sy(60, input)}px;left:${left}px;width:${contentW}px;font-size:22px;color:${fc};text-align:center;display:flex;justify-content:center;">${escapeHtml(input.footerText)}</div>
</div>`;
}

export function renderCoverV2(input: SlideRenderSpec): string {
  const cfg = COVER_V2_CONFIG.defaults;
  const w = cw(input);
  const h = ch(input);
  const titleSize = input.titleSizePx ?? cfg.titleSizePx;
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const bw = input.bodyWeight ?? cfg.bodyWeight;
  const tc = input.textColor ?? "#fff";
  const fc = input.footerColor ?? "rgba(255,255,255,0.7)";
  const spacing = ls(input.letterSpacing);

  const left = sx(80, input);
  const contentW = w - left * 2;
  const bodyW = w - left - sx(160, input);

  return `<div style="position:relative;width:${w}px;height:${h}px;${bgStyle(input, COVER_V2_CONFIG.defaultBg)}font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;">${heroBlock(input, sy(360, input))}
  <div style="position:absolute;bottom:${sy(320, input)}px;left:${left}px;width:${contentW}px;font-size:${titleSize}px;font-weight:${tw};line-height:1.3;letter-spacing:${spacing};display:flex;">${escapeHtml(input.title)}</div>
  <div style="position:absolute;bottom:${sy(200, input)}px;left:${left}px;width:${bodyW}px;font-size:${bodySize}px;font-weight:${bw};line-height:1.5;color:rgba(255,255,255,0.75);display:flex;">${escapeHtml(input.bodyText)}</div>
  <div style="position:absolute;bottom:${sy(60, input)}px;left:${left}px;width:${contentW}px;font-size:22px;color:${fc};display:flex;">${escapeHtml(input.footerText)}</div>
</div>`;
}
