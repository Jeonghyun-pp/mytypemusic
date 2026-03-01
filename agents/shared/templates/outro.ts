/**
 * Outro (CTA) slide template — inline-style HTML for Satori.
 */
import type { SlideRenderSpec, TemplateConfig } from "./types";
import { cw, ch, escapeHtml, bgStyle, heroBlock, sx, sy } from "./util";

// ── Metadata ─────────────────────────────────────────────

export const OUTRO_V1_CONFIG: TemplateConfig = {
  id: "end.outro.v1",
  kind: "cta",
  label: "아웃트로 V1",
  description: "중앙 CTA 텍스트 + 하단 크레딧",
  defaultBg: "linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
  defaults: { titleSizePx: 52, bodySizePx: 22, footerSizePx: 22, titleWeight: 700, bodyWeight: 400 },
};

// ── Renderer ─────────────────────────────────────────────

export function renderOutroV1(input: SlideRenderSpec): string {
  const cfg = OUTRO_V1_CONFIG.defaults;
  const w = cw(input);
  const h = ch(input);
  const ctaSize = input.titleSizePx ?? cfg.titleSizePx;
  const tw = input.titleWeight ?? cfg.titleWeight;
  const tc = input.textColor ?? "#fff";
  const fc = input.footerColor ?? "rgba(255,255,255,0.7)";

  const left = sx(80, input);
  const contentW = w - left * 2;

  return `<div style="position:relative;width:${w}px;height:${h}px;${bgStyle(input, OUTRO_V1_CONFIG.defaultBg)}font-family:${input.fontFamily ?? "Pretendard,sans-serif"};color:${tc};display:flex;flex-direction:column;align-items:center;justify-content:center;">${heroBlock(input, sy(220, input))}
  <div style="width:${w - sx(180, input)}px;font-size:${ctaSize}px;font-weight:${tw};line-height:1.4;text-align:center;display:flex;align-items:center;justify-content:center;">${escapeHtml(input.title)}</div>
  <div style="position:absolute;bottom:${sy(60, input)}px;left:${left}px;width:${contentW}px;font-size:22px;color:${fc};text-align:center;display:flex;justify-content:center;">${escapeHtml(input.footerText)}</div>
</div>`;
}
