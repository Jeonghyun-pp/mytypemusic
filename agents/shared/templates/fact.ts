/**
 * Fact (body) slide templates — inline-style HTML for Satori.
 */
import type { SlideRenderSpec, TemplateConfig } from "./types";
import { cw, ch, escapeHtml, ls, bgStyle, heroBlock, sx, sy } from "./util";

// ── Metadata ─────────────────────────────────────────────

export const FACT_V1_CONFIG: TemplateConfig = {
  id: "body.fact.v1",
  kind: "fact",
  label: "팩트 V1 (그라디언트)",
  description: "상단 헤드라인 + 구분선 + 중앙 본문, 그라디언트 배경",
  defaultBg: "linear-gradient(160deg, #0b2027 0%, #0a3d42 40%, #1b6b5a 100%)",
  defaults: { titleSizePx: 32, bodySizePx: 44, footerSizePx: 22, titleWeight: 600, bodyWeight: 700 },
};

export const FACT_V2_CONFIG: TemplateConfig = {
  id: "body.fact.v2",
  kind: "fact",
  label: "팩트 V2 (좌측 바)",
  description: "좌측 수직 악센트 바 + 번호 장식 + 좌측 정렬",
  defaultBg: "linear-gradient(160deg, #0b2027 0%, #0a3d42 40%, #1b6b5a 100%)",
  defaults: { titleSizePx: 32, bodySizePx: 44, footerSizePx: 22, titleWeight: 600, bodyWeight: 700 },
};

export const FACT_V3_CONFIG: TemplateConfig = {
  id: "body.fact.v3",
  kind: "fact",
  label: "팩트 V3 (카드)",
  description: "라운드 카드 안에 본문, 헤드라인은 작은 캡션",
  defaultBg: "linear-gradient(160deg, #1a0a2e 0%, #2d1b4e 40%, #4a2068 100%)",
  defaults: { titleSizePx: 24, bodySizePx: 42, footerSizePx: 22, titleWeight: 500, bodyWeight: 600 },
};

export const FACT_V4_CONFIG: TemplateConfig = {
  id: "body.fact.v4",
  kind: "fact",
  label: "팩트 V4 (에디토리얼)",
  description: "밝은 배경 (#FAFAF8), 세리프 무드, 에디토리얼 스타일",
  defaultBg: "#FAFAF8",
  defaults: { titleSizePx: 18, bodySizePx: 36, footerSizePx: 14, titleWeight: 500, bodyWeight: 600 },
};

// ── Renderers ────────────────────────────────────────────

export function renderFactV1(input: SlideRenderSpec): string {
  const cfg = FACT_V1_CONFIG.defaults;
  const w = cw(input);
  const h = ch(input);
  const headlineSize = input.headlineSizePx ?? input.titleSizePx ?? cfg.titleSizePx;
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const bw = input.bodyWeight ?? cfg.bodyWeight;
  const tc = input.textColor ?? "#fff";
  const ac = input.accentColor ?? "rgba(255,255,255,0.3)";
  const fc = input.footerColor ?? "rgba(255,255,255,0.7)";
  const spacing = ls(input.letterSpacing);

  const left = sx(80, input);
  const contentW = w - left * 2;

  return `<div style="position:relative;width:${w}px;height:${h}px;${bgStyle(input, FACT_V1_CONFIG.defaultBg)}font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;">${heroBlock(input, sy(220, input))}
  <div style="position:absolute;top:${sy(120, input)}px;left:${left}px;width:${contentW}px;font-size:${headlineSize}px;font-weight:${tw};color:rgba(255,255,255,0.55);letter-spacing:${spacing};display:flex;">${escapeHtml(input.title)}</div>
  <div style="position:absolute;top:${sy(200, input)}px;left:${left}px;width:${contentW}px;height:2px;background:${ac};display:flex;"></div>
  <div style="position:absolute;top:${sy(260, input)}px;left:${left}px;width:${contentW}px;height:${sy(800, input)}px;font-size:${bodySize}px;font-weight:${bw};line-height:1.4;display:flex;">${escapeHtml(input.bodyText)}</div>
  <div style="position:absolute;bottom:${sy(60, input)}px;left:${left}px;width:${contentW}px;font-size:22px;color:${fc};display:flex;">${escapeHtml(input.footerText)}</div>
</div>`;
}

export function renderFactV2(input: SlideRenderSpec): string {
  const cfg = FACT_V2_CONFIG.defaults;
  const w = cw(input);
  const h = ch(input);
  const headlineSize = input.headlineSizePx ?? input.titleSizePx ?? cfg.titleSizePx;
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const bw = input.bodyWeight ?? cfg.bodyWeight;
  const tc = input.textColor ?? "#fff";
  const fc = input.footerColor ?? "rgba(255,255,255,0.7)";
  const spacing = ls(input.letterSpacing);
  const displayNum = String(input.slideIndex + 1).padStart(2, "0");

  const barLeft = sx(60, input);
  const contentLeft = sx(100, input);
  const contentW = w - contentLeft - sx(80, input);

  return `<div style="position:relative;width:${w}px;height:${h}px;${bgStyle(input, FACT_V2_CONFIG.defaultBg)}font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;">${heroBlock(input, sy(220, input))}
  <div style="position:absolute;left:${barLeft}px;top:${sy(90, input)}px;font-size:120px;font-weight:800;color:rgba(255,255,255,0.06);letter-spacing:-4px;line-height:1;display:flex;">${escapeHtml(displayNum)}</div>
  <div style="position:absolute;left:${barLeft}px;top:${sy(100, input)}px;width:4px;height:${sy(800, input)}px;background:linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(255,255,255,0.08));border-radius:2px;display:flex;"></div>
  <div style="position:absolute;top:${sy(120, input)}px;left:${contentLeft}px;width:${contentW}px;font-size:${headlineSize}px;font-weight:${tw};color:rgba(255,255,255,0.55);letter-spacing:${spacing};display:flex;">${escapeHtml(input.title)}</div>
  <div style="position:absolute;top:${sy(260, input)}px;left:${contentLeft}px;width:${contentW}px;height:${sy(800, input)}px;font-size:${bodySize}px;font-weight:${bw};line-height:1.4;display:flex;">${escapeHtml(input.bodyText)}</div>
  <div style="position:absolute;bottom:${sy(60, input)}px;left:${contentLeft}px;width:${contentW}px;font-size:22px;color:${fc};display:flex;">${escapeHtml(input.footerText)}</div>
</div>`;
}

export function renderFactV3(input: SlideRenderSpec): string {
  const cfg = FACT_V3_CONFIG.defaults;
  const w = cw(input);
  const h = ch(input);
  const headlineSize = input.headlineSizePx ?? input.titleSizePx ?? cfg.titleSizePx;
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const bw = input.bodyWeight ?? cfg.bodyWeight;
  const tc = input.textColor ?? "#fff";
  const fc = input.footerColor ?? "rgba(255,255,255,0.7)";
  const spacing = ls(input.letterSpacing);
  const radius = input.cardRadius ?? 24;

  const left = sx(80, input);
  const contentW = w - left * 2;
  const cardLeft = sx(70, input);
  const cardW = w - cardLeft * 2;
  const cardH = sy(680, input);
  const innerW = cardW - sx(100, input);

  return `<div style="position:relative;width:${w}px;height:${h}px;${bgStyle(input, FACT_V3_CONFIG.defaultBg)}font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;">${heroBlock(input, sy(220, input))}
  <div style="position:absolute;top:${sy(200, input)}px;left:${left}px;width:${contentW}px;font-size:${headlineSize}px;font-weight:${tw};color:rgba(255,255,255,0.45);letter-spacing:${spacing};text-transform:uppercase;display:flex;">${escapeHtml(input.title)}</div>
  <div style="position:absolute;left:${cardLeft}px;top:${sy(280, input)}px;width:${cardW}px;height:${cardH}px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:${radius}px;display:flex;align-items:center;justify-content:center;padding:${sx(50, input)}px;">
    <div style="width:${innerW}px;font-size:${bodySize}px;font-weight:${bw};line-height:1.4;display:flex;">${escapeHtml(input.bodyText)}</div>
  </div>
  <div style="position:absolute;bottom:${sy(60, input)}px;left:${left}px;width:${contentW}px;font-size:22px;color:${fc};display:flex;">${escapeHtml(input.footerText)}</div>
</div>`;
}

/** Fact V4: editorial light background (#FAFAF8) */
export function renderFactV4(input: SlideRenderSpec): string {
  const cfg = FACT_V4_CONFIG.defaults;
  const w = cw(input);
  const h = ch(input);
  const headlineSize = input.headlineSizePx ?? input.titleSizePx ?? cfg.titleSizePx;
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const bw = input.bodyWeight ?? cfg.bodyWeight;
  const tc = input.textColor ?? "#1A1A1A";
  const fc = input.footerColor ?? "rgba(26,26,26,0.5)";
  const spacing = ls(input.letterSpacing);

  const left = sx(75, input);
  const contentW = w - left * 2;

  return `<div style="position:relative;width:${w}px;height:${h}px;background:${input.bgGradient ?? FACT_V4_CONFIG.defaultBg};font-family:${input.fontFamily ?? '"Noto Serif KR","Pretendard",serif'};color:${tc};display:flex;flex-direction:column;">
  <div style="position:absolute;top:${sy(140, input)}px;left:${left}px;width:${contentW}px;font-size:${headlineSize}px;font-weight:${tw};color:rgba(26,26,26,0.55);letter-spacing:${spacing};display:flex;">${escapeHtml(input.title)}</div>
  <div style="position:absolute;top:${sy(75, input)}px;left:${left}px;width:${contentW}px;height:2px;background:rgba(26,26,26,0.12);display:flex;"></div>
  <div style="position:absolute;top:${sy(400, input)}px;left:${left}px;width:${contentW}px;height:${sy(600, input)}px;font-size:${bodySize}px;font-weight:${bw};line-height:1.5;display:flex;">${escapeHtml(input.bodyText)}</div>
  <div style="position:absolute;bottom:${sy(50, input)}px;left:${left}px;width:${contentW}px;font-size:${cfg.footerSizePx}px;color:${fc};display:flex;">${escapeHtml(input.footerText)}</div>
</div>`;
}
