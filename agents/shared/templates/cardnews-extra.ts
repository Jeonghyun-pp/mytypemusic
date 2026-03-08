/**
 * Extended cardnews slide templates — quote, stat, list, ranking, highlight, minimal cover, CTA.
 */
import type { SlideRenderSpec, TemplateConfig } from "./types";
import { cw, ch, escapeHtml, ls, bgStyle, heroBlock, sx, sy } from "./util";

/** Convert hex color to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(225,112,85,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Metadata ─────────────────────────────────────────────

export const COVER_MINIMAL_V1_CONFIG: TemplateConfig = {
  id: "cover.minimal.v1",
  kind: "cover",
  label: "커버 미니멀 V1",
  description: "밝은 배경, 대형 타이틀, 미니멀 레이아웃",
  defaultBg: "#F8F9FA",
  defaults: { titleSizePx: 64, bodySizePx: 24, footerSizePx: 14, titleWeight: 800, bodyWeight: 400 },
};

export const QUOTE_V1_CONFIG: TemplateConfig = {
  id: "body.quote.v1",
  kind: "quote",
  label: "인용 V1",
  description: "큰따옴표 장식 + 중앙 인용문, 다크 배경",
  defaultBg: "linear-gradient(160deg, #1A1A2E 0%, #16213E 100%)",
  defaults: { titleSizePx: 18, bodySizePx: 36, footerSizePx: 18, titleWeight: 500, bodyWeight: 600 },
};

export const STAT_V1_CONFIG: TemplateConfig = {
  id: "body.stat.v1",
  kind: "stat",
  label: "통계 V1",
  description: "대형 숫자 강조 + 설명 텍스트",
  defaultBg: "linear-gradient(135deg, #2D3436 0%, #636E72 100%)",
  defaults: { titleSizePx: 96, bodySizePx: 24, footerSizePx: 18, titleWeight: 900, bodyWeight: 400 },
};

export const LIST_V1_CONFIG: TemplateConfig = {
  id: "body.list.v1",
  kind: "list",
  label: "리스트 V1",
  description: "번호 매긴 리스트 아이템, 좌측 넘버링",
  defaultBg: "linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
  defaults: { titleSizePx: 28, bodySizePx: 22, footerSizePx: 18, titleWeight: 700, bodyWeight: 400 },
};

export const RANKING_V1_CONFIG: TemplateConfig = {
  id: "body.ranking.v1",
  kind: "ranking",
  label: "랭킹 V1",
  description: "대형 순위 번호 + 항목명 + 설명",
  defaultBg: "linear-gradient(135deg, #6C5CE7 0%, #A29BFE 100%)",
  defaults: { titleSizePx: 120, bodySizePx: 36, footerSizePx: 18, titleWeight: 900, bodyWeight: 600 },
};

export const HIGHLIGHT_V1_CONFIG: TemplateConfig = {
  id: "body.highlight.v1",
  kind: "fact",
  label: "하이라이트 V1",
  description: "악센트 컬러 좌측 바 + 핵심 메시지 강조",
  defaultBg: "linear-gradient(160deg, #1A1A2E 0%, #2D1B69 100%)",
  defaults: { titleSizePx: 14, bodySizePx: 40, footerSizePx: 18, titleWeight: 700, bodyWeight: 700 },
};

export const CTA_V1_CONFIG: TemplateConfig = {
  id: "end.cta.v1",
  kind: "cta",
  label: "CTA V1",
  description: "팔로우/구독 유도 CTA + 소셜 아이콘 영역",
  defaultBg: "linear-gradient(135deg, #6C5CE7 0%, #A29BFE 100%)",
  defaults: { titleSizePx: 44, bodySizePx: 22, footerSizePx: 16, titleWeight: 800, bodyWeight: 400 },
};

// ── Renderers ────────────────────────────────────────────

export function renderCoverMinimalV1(input: SlideRenderSpec): string {
  const cfg = COVER_MINIMAL_V1_CONFIG.defaults;
  const w = cw(input);
  const h = ch(input);
  const titleSize = input.titleSizePx ?? cfg.titleSizePx;
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const bw = input.bodyWeight ?? cfg.bodyWeight;
  const tc = input.textColor ?? "#1A1A1A";
  const fc = input.footerColor ?? "rgba(26,26,26,0.5)";
  const ac = input.accentColor ?? "#6C5CE7";

  const left = sx(80, input);
  const contentW = w - left * 2;

  return `<div style="position:relative;width:${w}px;height:${h}px;background:${input.bgGradient ?? COVER_MINIMAL_V1_CONFIG.defaultBg};font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;">
  <div style="position:absolute;top:${sy(80, input)}px;left:${left}px;width:40px;height:4px;background:${ac};border-radius:2px;display:flex;"></div>
  <div style="position:absolute;top:${sy(120, input)}px;left:${left}px;width:${contentW}px;font-size:${cfg.footerSizePx}px;font-weight:600;color:${ac};letter-spacing:2px;display:flex;">${escapeHtml(input.footerText).toUpperCase()}</div>
  <div style="position:absolute;top:${sy(400, input)}px;left:${left}px;width:${contentW}px;font-size:${titleSize}px;font-weight:${tw};line-height:1.25;display:flex;">${escapeHtml(input.title)}</div>
  <div style="position:absolute;top:${sy(700, input)}px;left:${left}px;width:${contentW - sx(100, input)}px;font-size:${bodySize}px;font-weight:${bw};line-height:1.6;color:rgba(26,26,26,0.65);display:flex;">${escapeHtml(input.bodyText)}</div>
</div>`;
}

export function renderQuoteV1(input: SlideRenderSpec): string {
  const cfg = QUOTE_V1_CONFIG.defaults;
  const w = cw(input);
  const h = ch(input);
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const bw = input.bodyWeight ?? cfg.bodyWeight;
  const tc = input.textColor ?? "#fff";
  const fc = input.footerColor ?? "rgba(255,255,255,0.5)";
  const ac = input.accentColor ?? "#E17055";

  const left = sx(80, input);
  const contentW = w - left * 2;

  const acFaded = hexToRgba(ac, 0.3);

  return `<div style="position:relative;width:${w}px;height:${h}px;${bgStyle(input, QUOTE_V1_CONFIG.defaultBg)}font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;align-items:center;justify-content:center;">${heroBlock(input, sy(220, input))}
  <div style="font-size:120px;font-weight:800;color:${acFaded};line-height:0.8;display:flex;">"</div>
  <div style="width:${contentW}px;font-size:${bodySize}px;font-weight:${bw};line-height:1.5;text-align:center;margin-top:${sy(20, input)}px;display:flex;justify-content:center;">${escapeHtml(input.bodyText)}</div>
  <div style="width:${contentW}px;font-size:${cfg.titleSizePx}px;font-weight:500;color:${fc};text-align:center;margin-top:${sy(40, input)}px;display:flex;justify-content:center;">— ${escapeHtml(input.title)}</div>
  <div style="position:absolute;bottom:${sy(60, input)}px;left:${left}px;width:${contentW}px;font-size:${cfg.footerSizePx}px;color:${fc};text-align:center;display:flex;justify-content:center;">${escapeHtml(input.footerText)}</div>
</div>`;
}

export function renderStatV1(input: SlideRenderSpec): string {
  const cfg = STAT_V1_CONFIG.defaults;
  const w = cw(input);
  const h = ch(input);
  const numSize = input.titleSizePx ?? cfg.titleSizePx;
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const bw = input.bodyWeight ?? cfg.bodyWeight;
  const tc = input.textColor ?? "#fff";
  const fc = input.footerColor ?? "rgba(255,255,255,0.5)";
  const ac = input.accentColor ?? "#E17055";

  const left = sx(80, input);
  const contentW = w - left * 2;

  return `<div style="position:relative;width:${w}px;height:${h}px;${bgStyle(input, STAT_V1_CONFIG.defaultBg)}font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;align-items:center;justify-content:center;">${heroBlock(input, sy(220, input))}
  <div style="font-size:${numSize}px;font-weight:${tw};color:${ac};line-height:1;display:flex;">${escapeHtml(input.title)}</div>
  <div style="width:${contentW}px;font-size:${bodySize}px;font-weight:${bw};line-height:1.5;text-align:center;margin-top:${sy(24, input)}px;color:rgba(255,255,255,0.75);display:flex;justify-content:center;">${escapeHtml(input.bodyText)}</div>
  <div style="position:absolute;bottom:${sy(60, input)}px;left:${left}px;width:${contentW}px;font-size:${cfg.footerSizePx}px;color:${fc};text-align:center;display:flex;justify-content:center;">${escapeHtml(input.footerText)}</div>
</div>`;
}

export function renderListV1(input: SlideRenderSpec): string {
  const cfg = LIST_V1_CONFIG.defaults;
  const w = cw(input);
  const h = ch(input);
  const titleSize = input.titleSizePx ?? cfg.titleSizePx;
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const tc = input.textColor ?? "#fff";
  const fc = input.footerColor ?? "rgba(255,255,255,0.5)";
  const ac = input.accentColor ?? "#6C5CE7";

  const left = sx(80, input);
  const contentW = w - left * 2;

  // bodyText is expected to be newline-separated list items
  const items = input.bodyText.split("\n").filter(Boolean);
  const itemsHtml = items
    .map(
      (item, i) =>
        `<div style="display:flex;align-items:flex-start;gap:${sx(16, input)}px;margin-bottom:${sy(20, input)}px;">
          <div style="display:flex;justify-content:center;align-items:center;min-width:${sx(40, input)}px;height:${sy(40, input)}px;background:${ac};border-radius:8px;color:white;font-size:18px;font-weight:700;">${i + 1}</div>
          <div style="display:flex;font-size:${bodySize}px;font-weight:400;line-height:1.4;flex:1;">${escapeHtml(item)}</div>
        </div>`,
    )
    .join("");

  return `<div style="position:relative;width:${w}px;height:${h}px;${bgStyle(input, LIST_V1_CONFIG.defaultBg)}font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;">${heroBlock(input, sy(220, input))}
  <div style="position:absolute;top:${sy(100, input)}px;left:${left}px;width:${contentW}px;font-size:${titleSize}px;font-weight:${tw};letter-spacing:${ls(input.letterSpacing)};display:flex;">${escapeHtml(input.title)}</div>
  <div style="position:absolute;top:${sy(200, input)}px;left:${left}px;width:${contentW}px;display:flex;flex-direction:column;">${itemsHtml}</div>
  <div style="position:absolute;bottom:${sy(60, input)}px;left:${left}px;width:${contentW}px;font-size:${cfg.footerSizePx}px;color:${fc};display:flex;">${escapeHtml(input.footerText)}</div>
</div>`;
}

export function renderRankingV1(input: SlideRenderSpec): string {
  const cfg = RANKING_V1_CONFIG.defaults;
  const w = cw(input);
  const h = ch(input);
  const rankSize = input.titleSizePx ?? cfg.titleSizePx;
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const bw = input.bodyWeight ?? cfg.bodyWeight;
  const tc = input.textColor ?? "#fff";
  const fc = input.footerColor ?? "rgba(255,255,255,0.6)";
  const displayNum = String(input.slideIndex + 1).padStart(2, "0");

  const left = sx(80, input);
  const contentW = w - left * 2;

  return `<div style="position:relative;width:${w}px;height:${h}px;${bgStyle(input, RANKING_V1_CONFIG.defaultBg)}font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;">${heroBlock(input, sy(220, input))}
  <div style="position:absolute;top:${sy(80, input)}px;right:${sx(60, input)}px;font-size:${rankSize}px;font-weight:${tw};color:rgba(255,255,255,0.15);line-height:1;display:flex;">${displayNum}</div>
  <div style="position:absolute;top:${sy(500, input)}px;left:${left}px;width:${contentW}px;display:flex;flex-direction:column;">
    <div style="font-size:${bodySize}px;font-weight:${bw};line-height:1.3;display:flex;">${escapeHtml(input.title)}</div>
    <div style="font-size:22px;font-weight:400;line-height:1.5;margin-top:${sy(20, input)}px;color:rgba(255,255,255,0.7);display:flex;">${escapeHtml(input.bodyText)}</div>
  </div>
  <div style="position:absolute;bottom:${sy(60, input)}px;left:${left}px;width:${contentW}px;font-size:${cfg.footerSizePx}px;color:${fc};display:flex;">${escapeHtml(input.footerText)}</div>
</div>`;
}

export function renderHighlightV1(input: SlideRenderSpec): string {
  const cfg = HIGHLIGHT_V1_CONFIG.defaults;
  const w = cw(input);
  const h = ch(input);
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const bw = input.bodyWeight ?? cfg.bodyWeight;
  const tc = input.textColor ?? "#fff";
  const fc = input.footerColor ?? "rgba(255,255,255,0.5)";
  const ac = input.accentColor ?? "#E17055";

  const left = sx(80, input);
  const barLeft = sx(70, input);
  const contentLeft = sx(100, input);
  const contentW = w - contentLeft - sx(80, input);

  return `<div style="position:relative;width:${w}px;height:${h}px;${bgStyle(input, HIGHLIGHT_V1_CONFIG.defaultBg)}font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;">${heroBlock(input, sy(220, input))}
  <div style="position:absolute;top:${sy(100, input)}px;left:${left}px;font-size:${cfg.titleSizePx}px;font-weight:${cfg.titleWeight};color:${ac};letter-spacing:2px;display:flex;">${escapeHtml(input.title).toUpperCase()}</div>
  <div style="position:absolute;left:${barLeft}px;top:${sy(180, input)}px;width:6px;height:${sy(400, input)}px;background:${ac};border-radius:3px;display:flex;"></div>
  <div style="position:absolute;top:${sy(200, input)}px;left:${contentLeft}px;width:${contentW}px;font-size:${bodySize}px;font-weight:${bw};line-height:1.45;display:flex;">${escapeHtml(input.bodyText)}</div>
  <div style="position:absolute;bottom:${sy(60, input)}px;left:${left}px;width:${w - left * 2}px;font-size:${cfg.footerSizePx}px;color:${fc};display:flex;">${escapeHtml(input.footerText)}</div>
</div>`;
}

export function renderCtaV1(input: SlideRenderSpec): string {
  const cfg = CTA_V1_CONFIG.defaults;
  const w = cw(input);
  const h = ch(input);
  const titleSize = input.titleSizePx ?? cfg.titleSizePx;
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const tc = input.textColor ?? "#fff";
  const fc = input.footerColor ?? "rgba(255,255,255,0.7)";

  const left = sx(80, input);
  const contentW = w - left * 2;

  return `<div style="position:relative;width:${w}px;height:${h}px;${bgStyle(input, CTA_V1_CONFIG.defaultBg)}font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;align-items:center;justify-content:center;">${heroBlock(input, sy(220, input))}
  <div style="width:${contentW}px;font-size:${titleSize}px;font-weight:${tw};line-height:1.3;text-align:center;display:flex;justify-content:center;">${escapeHtml(input.title)}</div>
  <div style="width:${contentW}px;font-size:${bodySize}px;font-weight:400;line-height:1.5;text-align:center;margin-top:${sy(24, input)}px;color:rgba(255,255,255,0.7);display:flex;justify-content:center;">${escapeHtml(input.bodyText)}</div>
  <div style="margin-top:${sy(48, input)}px;padding:${sy(16, input)}px ${sx(48, input)}px;background:rgba(255,255,255,0.2);border-width:2px;border-style:solid;border-color:rgba(255,255,255,0.5);border-radius:${sx(40, input)}px;font-size:20px;font-weight:600;display:flex;align-items:center;justify-content:center;">${escapeHtml(input.footerText || "더 알아보기 →")}</div>
  <div style="position:absolute;bottom:${sy(60, input)}px;left:${left}px;width:${contentW}px;font-size:${cfg.footerSizePx}px;color:${fc};text-align:center;display:flex;justify-content:center;">${escapeHtml(input.footerText)}</div>
</div>`;
}
