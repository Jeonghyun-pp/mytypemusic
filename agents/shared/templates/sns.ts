/**
 * SNS image templates — platform-optimized single-image templates for Satori.
 *
 * Unlike cardnews slides (1080x1350), these target platform-specific sizes:
 *   - Square (Instagram feed): 1080x1080
 *   - Story (Instagram/TikTok): 1080x1920
 *   - Twitter/X: 1200x675
 *   - YouTube thumbnail: 1280x720
 *   - Quote card: 1080x1080
 */
import type { SlideRenderSpec, TemplateConfig } from "./types";
import { escapeHtml, sx, sy } from "./util";

/** Convert hex color to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(162,155,254,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Metadata ─────────────────────────────────────────────

export const SNS_SQUARE_V1_CONFIG: TemplateConfig = {
  id: "sns.square.v1",
  kind: "sns",
  label: "SNS 정사각 V1",
  description: "Instagram 피드용 1080x1080, 중앙 타이틀 + 하단 카테고리",
  defaultBg: "linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)",
  defaults: { titleSizePx: 48, bodySizePx: 20, footerSizePx: 14, titleWeight: 800, bodyWeight: 400 },
};

export const SNS_STORY_V1_CONFIG: TemplateConfig = {
  id: "sns.story.v1",
  kind: "sns",
  label: "SNS 스토리 V1",
  description: "Instagram Story/TikTok 1080x1920, 풀스크린 그래디언트",
  defaultBg: "linear-gradient(180deg, #0F0F1A 0%, #1A1A2E 50%, #2D1B69 100%)",
  defaults: { titleSizePx: 56, bodySizePx: 24, footerSizePx: 16, titleWeight: 800, bodyWeight: 400 },
};

export const SNS_TWITTER_V1_CONFIG: TemplateConfig = {
  id: "sns.twitter.v1",
  kind: "sns",
  label: "SNS 트위터 V1",
  description: "Twitter/X 1200x675, 좌측 텍스트 + 우측 여백",
  defaultBg: "linear-gradient(135deg, #2D3436 0%, #636E72 100%)",
  defaults: { titleSizePx: 40, bodySizePx: 18, footerSizePx: 14, titleWeight: 800, bodyWeight: 400 },
};

export const SNS_YOUTUBE_V1_CONFIG: TemplateConfig = {
  id: "sns.youtube.v1",
  kind: "sns",
  label: "SNS 유튜브썸네일 V1",
  description: "YouTube 1280x720, 임팩트 타이틀 + 뱃지",
  defaultBg: "linear-gradient(135deg, #6C5CE7 0%, #A29BFE 100%)",
  defaults: { titleSizePx: 52, bodySizePx: 22, footerSizePx: 16, titleWeight: 900, bodyWeight: 500 },
};

export const SNS_QUOTE_V1_CONFIG: TemplateConfig = {
  id: "sns.quote.v1",
  kind: "sns",
  label: "SNS 인용 카드 V1",
  description: "인용문 중심 카드 1080x1080, 다크 배경",
  defaultBg: "linear-gradient(160deg, #1a0a2e 0%, #2d1b4e 40%, #4a2068 100%)",
  defaults: { titleSizePx: 18, bodySizePx: 32, footerSizePx: 14, titleWeight: 500, bodyWeight: 600 },
};

// ── Renderers ────────────────────────────────────────────

/** Instagram feed square (1080x1080) */
export function renderSnsSquareV1(input: SlideRenderSpec): string {
  const cfg = SNS_SQUARE_V1_CONFIG.defaults;
  const w = input.canvasWidth ?? 1080;
  const h = input.canvasHeight ?? 1080;
  const titleSize = input.titleSizePx ?? cfg.titleSizePx;
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const tc = input.textColor ?? "#fff";
  const fc = input.footerColor ?? "rgba(255,255,255,0.5)";
  const ac = input.accentColor ?? "#E17055";
  const pad = sx(60, input);

  return `<div style="position:relative;width:${w}px;height:${h}px;background:${input.bgGradient ?? SNS_SQUARE_V1_CONFIG.defaultBg};font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;padding:${pad}px;">
  <div style="display:flex;align-items:center;gap:${sx(8, input)}px;">
    <div style="display:flex;width:${sx(4, input)}px;height:${sy(20, input)}px;background:${ac};border-radius:2px;"></div>
    <div style="display:flex;font-size:${cfg.footerSizePx}px;font-weight:700;color:${ac};letter-spacing:2px;">${escapeHtml(input.footerText).toUpperCase()}</div>
  </div>
  <div style="display:flex;flex:1;align-items:center;">
    <div style="display:flex;flex-direction:column;gap:${sy(16, input)}px;">
      <div style="display:flex;font-size:${titleSize}px;font-weight:${tw};line-height:1.25;">${escapeHtml(input.title)}</div>
      <div style="display:flex;font-size:${bodySize}px;font-weight:400;line-height:1.5;color:rgba(255,255,255,0.65);">${escapeHtml(input.bodyText)}</div>
    </div>
  </div>
  <div style="display:flex;font-size:12px;color:${fc};">Web Magazine</div>
</div>`;
}

/** Instagram Story / TikTok (1080x1920) */
export function renderSnsStoryV1(input: SlideRenderSpec): string {
  const cfg = SNS_STORY_V1_CONFIG.defaults;
  const w = input.canvasWidth ?? 1080;
  const h = input.canvasHeight ?? 1920;
  const titleSize = input.titleSizePx ?? cfg.titleSizePx;
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const tc = input.textColor ?? "#fff";
  const ac = input.accentColor ?? "#E17055";
  const pad = sx(60, input);

  return `<div style="position:relative;width:${w}px;height:${h}px;background:${input.bgGradient ?? SNS_STORY_V1_CONFIG.defaultBg};font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;padding:${pad}px;justify-content:flex-end;">
  <div style="display:flex;width:${sx(40, input)}px;height:${sy(4, input)}px;background:${ac};border-radius:2px;margin-bottom:${sy(16, input)}px;"></div>
  <div style="display:flex;font-size:${cfg.footerSizePx}px;font-weight:700;color:${ac};letter-spacing:2px;margin-bottom:${sy(24, input)}px;">${escapeHtml(input.footerText)}</div>
  <div style="display:flex;font-size:${titleSize}px;font-weight:${tw};line-height:1.25;margin-bottom:${sy(20, input)}px;">${escapeHtml(input.title)}</div>
  <div style="display:flex;font-size:${bodySize}px;font-weight:400;line-height:1.5;color:rgba(255,255,255,0.65);margin-bottom:${sy(120, input)}px;">${escapeHtml(input.bodyText)}</div>
  <div style="display:flex;font-size:12px;color:rgba(255,255,255,0.4);">Web Magazine</div>
</div>`;
}

/** Twitter/X (1200x675) */
export function renderSnsTwitterV1(input: SlideRenderSpec): string {
  const cfg = SNS_TWITTER_V1_CONFIG.defaults;
  const w = input.canvasWidth ?? 1200;
  const h = input.canvasHeight ?? 675;
  const titleSize = input.titleSizePx ?? cfg.titleSizePx;
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const tc = input.textColor ?? "#fff";
  const ac = input.accentColor ?? "#E17055";
  const pad = sx(48, input);

  return `<div style="position:relative;width:${w}px;height:${h}px;background:${input.bgGradient ?? SNS_TWITTER_V1_CONFIG.defaultBg};font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;padding:${pad}px;justify-content:center;">
  <div style="display:flex;align-items:center;gap:${sx(8, input)}px;margin-bottom:${sy(16, input)}px;">
    <div style="display:flex;width:${sx(4, input)}px;height:${sy(16, input)}px;background:${ac};border-radius:2px;"></div>
    <div style="display:flex;font-size:${cfg.footerSizePx}px;font-weight:700;color:${ac};letter-spacing:2px;">${escapeHtml(input.footerText)}</div>
  </div>
  <div style="display:flex;font-size:${titleSize}px;font-weight:${tw};line-height:1.3;width:${Math.round(w * 0.7)}px;">${escapeHtml(input.title)}</div>
  <div style="display:flex;font-size:${bodySize}px;font-weight:400;line-height:1.5;color:rgba(255,255,255,0.6);margin-top:${sy(12, input)}px;width:${Math.round(w * 0.6)}px;">${escapeHtml(input.bodyText)}</div>
  <div style="position:absolute;bottom:${pad}px;right:${pad}px;font-size:12px;color:rgba(255,255,255,0.35);display:flex;">Web Magazine</div>
</div>`;
}

/** YouTube Thumbnail (1280x720) */
export function renderSnsYoutubeV1(input: SlideRenderSpec): string {
  const cfg = SNS_YOUTUBE_V1_CONFIG.defaults;
  const w = input.canvasWidth ?? 1280;
  const h = input.canvasHeight ?? 720;
  const titleSize = input.titleSizePx ?? cfg.titleSizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const tc = input.textColor ?? "#fff";
  const pad = sx(48, input);

  return `<div style="position:relative;width:${w}px;height:${h}px;background:${input.bgGradient ?? SNS_YOUTUBE_V1_CONFIG.defaultBg};font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;padding:${pad}px;">
  <div style="display:flex;padding:${sy(8, input)}px ${sx(16, input)}px;background:rgba(0,0,0,0.3);border-radius:8px;font-size:14px;font-weight:700;color:#fff;align-self:flex-start;">${escapeHtml(input.footerText)}</div>
  <div style="display:flex;flex:1;align-items:center;">
    <div style="display:flex;font-size:${titleSize}px;font-weight:${tw};line-height:1.2;width:${Math.round(w * 0.75)}px;">${escapeHtml(input.title)}</div>
  </div>
  <div style="display:flex;font-size:18px;font-weight:500;color:rgba(255,255,255,0.7);">${escapeHtml(input.bodyText)}</div>
</div>`;
}

/** Quote card (1080x1080) */
export function renderSnsQuoteV1(input: SlideRenderSpec): string {
  const cfg = SNS_QUOTE_V1_CONFIG.defaults;
  const w = input.canvasWidth ?? 1080;
  const h = input.canvasHeight ?? 1080;
  const bodySize = input.bodySizePx ?? cfg.bodySizePx;
  const bw = input.bodyWeight ?? cfg.bodyWeight;
  const tc = input.textColor ?? "#fff";
  const fc = input.footerColor ?? "rgba(255,255,255,0.4)";
  const ac = input.accentColor ?? "#A29BFE";
  // Derive faded accent color (25% opacity) from accent hex
  const acFaded = hexToRgba(ac, 0.25);
  const acHalf = hexToRgba(ac, 0.5);
  const pad = sx(80, input);

  return `<div style="position:relative;width:${w}px;height:${h}px;background:${input.bgGradient ?? SNS_QUOTE_V1_CONFIG.defaultBg};font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;padding:${pad}px;justify-content:center;align-items:center;">
  <div style="display:flex;font-size:100px;font-weight:800;color:${acFaded};line-height:0.8;">"</div>
  <div style="display:flex;font-size:${bodySize}px;font-weight:${bw};line-height:1.6;text-align:center;margin-top:${sy(24, input)}px;width:${w - pad * 2}px;justify-content:center;">${escapeHtml(input.bodyText)}</div>
  <div style="display:flex;flex-direction:column;align-items:center;margin-top:${sy(40, input)}px;gap:${sy(8, input)}px;">
    <div style="display:flex;width:${sx(40, input)}px;height:2px;background:${acHalf};"></div>
    <div style="display:flex;font-size:${cfg.titleSizePx}px;font-weight:500;color:${fc};">${escapeHtml(input.title)}</div>
  </div>
  <div style="position:absolute;bottom:${Math.round(pad / 2)}px;display:flex;font-size:12px;color:${fc};">Web Magazine</div>
</div>`;
}
