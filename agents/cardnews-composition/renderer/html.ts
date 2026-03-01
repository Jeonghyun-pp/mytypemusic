import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  TemplateSpec,
  TemplateSlot,
  SlideBindings,
} from "../types.js";
import type { SlotMapping } from "../mapping.js";
import { applySlotTextConstraints } from "../text-fit.js";

const W = 1080;
const H = 1350;

const DEFAULT_TITLE_SIZE_PX = 72;
const DEFAULT_SUBTITLE_SIZE_PX = 30;
const DEFAULT_FOOTER_SIZE_PX = 22;
const MIN_FOOTER_SIZE_PX = 18;
const FOOTER_ZONE_H = 220;

export interface CoverStyleVars {
  titleSizePx?: number;
  subtitleSizePx?: number;
  footerSizePx?: number;
}

export interface CoverOffsetVars {
  titleTopPx?: number;
  subtitleTopPx?: number;
  footerBottomPx?: number;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Convert an absolute local file path to a file:// URL.
 * Handles Windows backslashes safely.
 */
function localPathToFileUrl(localPath: string): string {
  return pathToFileURL(path.resolve(localPath)).href;
}

// ============================================================================
// Cover HTML renderer (Step 3 + A2 CSS variable / measurement support)
// ============================================================================

/**
 * Render a cover slide to a self-contained HTML string.
 *
 * Dispatches to variation-specific renderers based on template.templateId:
 *   - cover.hero.v1: center/upper title, 220px scrim (default)
 *   - cover.hero.v2: left-aligned, title pushed to lower area, 360px scrim
 *
 * Both variations support styleVars/offsetVars for autofix compatibility.
 */
export function renderCoverHtml(params: {
  template: TemplateSpec;
  mapping: SlotMapping;
  styleVars?: CoverStyleVars;
  offsetVars?: CoverOffsetVars;
  /** Extra CSS rules injected after the base styles (from StyleProfile) */
  cssOverrideBlock?: string;
}): string {
  const tid = params.template.templateId;
  if (tid === "cover.hero.v2") return renderCoverHtmlV2(params);
  return renderCoverHtmlV1(params);
}

// ---- Shared cover extraction helpers ----

interface CoverExtracted {
  heroSrc: string;
  titleText: string;
  footerText: string;
  subtitleText: string;
  titleSlot: import("../types.js").TemplateSlot;
  footerSlot: import("../types.js").TemplateSlot;
  subtitleSlot: import("../types.js").TemplateSlot | undefined;
  subX: number;
  subY: number;
  subW: number;
  subH: number;
}

function extractCoverData(params: {
  template: TemplateSpec;
  mapping: SlotMapping;
}): CoverExtracted {
  const { template, mapping } = params;

  const heroVal = mapping["heroImage"];
  const titleVal = mapping["title"];
  const footerVal = mapping["footerCredits"];
  const subtitleVal = mapping["subtitle"];

  if (!heroVal || heroVal.kind !== "image") {
    throw new Error("renderCoverHtml: heroImage slot missing or wrong kind");
  }
  if (!titleVal || titleVal.kind !== "text") {
    throw new Error("renderCoverHtml: title slot missing or wrong kind");
  }
  if (!footerVal || footerVal.kind !== "text") {
    throw new Error("renderCoverHtml: footerCredits slot missing or wrong kind");
  }

  const titleSlot = template.slots.find((s) => s.id === "title");
  const footerSlot = template.slots.find((s) => s.id === "footerCredits");
  const subtitleSlot = template.slots.find((s) => s.id === "subtitle");

  if (!titleSlot || !footerSlot) {
    throw new Error("renderCoverHtml: template missing required slots");
  }

  const heroSrc = localPathToFileUrl(heroVal.localPath);

  const titleText = applySlotTextConstraints({
    text: titleVal.text,
    maxChars: titleSlot.constraints?.maxChars,
    maxLines: titleSlot.constraints?.maxLines,
  });

  const footerText = applySlotTextConstraints({
    text: footerVal.text,
    maxChars: footerSlot.constraints?.maxChars,
    maxLines: footerSlot.constraints?.maxLines,
  });

  let subtitleText = "";
  if (subtitleVal && subtitleVal.kind === "text" && subtitleVal.text && subtitleSlot) {
    subtitleText = applySlotTextConstraints({
      text: subtitleVal.text,
      maxChars: subtitleSlot.constraints?.maxChars,
      maxLines: subtitleSlot.constraints?.maxLines,
    });
  }

  const subX = subtitleSlot ? subtitleSlot.x : titleSlot.x;
  const subY = subtitleSlot ? subtitleSlot.y : titleSlot.y + titleSlot.height + 16;
  const subW = subtitleSlot ? subtitleSlot.width : titleSlot.width;
  const subH = subtitleSlot ? subtitleSlot.height : 80;

  return {
    heroSrc, titleText, footerText, subtitleText,
    titleSlot, footerSlot, subtitleSlot,
    subX, subY, subW, subH,
  };
}

// ============================================================================
// Cover V1: center/upper title, standard scrim (original)
// ============================================================================

function renderCoverHtmlV1(params: {
  template: TemplateSpec;
  mapping: SlotMapping;
  styleVars?: CoverStyleVars;
  offsetVars?: CoverOffsetVars;
  cssOverrideBlock?: string;
}): string {
  const { template, styleVars, offsetVars } = params;
  const d = extractCoverData(params);
  const sa = template.safeArea;

  const titleSizePx = styleVars?.titleSizePx ?? DEFAULT_TITLE_SIZE_PX;
  const subtitleSizePx = styleVars?.subtitleSizePx ?? DEFAULT_SUBTITLE_SIZE_PX;
  const footerSizePx = Math.max(styleVars?.footerSizePx ?? DEFAULT_FOOTER_SIZE_PX, MIN_FOOTER_SIZE_PX);

  const titleTopPx = offsetVars?.titleTopPx ?? d.titleSlot.y;
  const subtitleTopPx = offsetVars?.subtitleTopPx ?? d.subY;
  const footerBottomPx = offsetVars?.footerBottomPx ?? (H - d.footerSlot.y - d.footerSlot.height);

  let subtitleBlock = "";
  if (d.subtitleText) {
    subtitleBlock =
      `  <div id="box-subtitle" class="slot-subtitle"` +
      ` data-bbox-w="${d.subW}" data-bbox-h="${d.subH}"` +
      `>${escapeHtml(d.subtitleText)}</div>`;
  }

  const css = `
:root {
  --title-size: ${titleSizePx}px;
  --subtitle-size: ${subtitleSizePx}px;
  --footer-size: ${footerSizePx}px;
  --title-top: ${titleTopPx}px;
  --subtitle-top: ${subtitleTopPx}px;
  --footer-bottom: ${footerBottomPx}px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
.canvas {
  display: flex; flex-direction: column;
  position: relative; width: ${W}px; height: ${H}px;
  background: #000;
  font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  color: #fff;
}
.hero-img {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover; filter: brightness(0.62); display: block;
}
.scrim {
  position: absolute; left: 0; right: 0; bottom: 0;
  height: ${FOOTER_ZONE_H}px;
  background: linear-gradient(to top, rgba(0,0,0,0.65), transparent);
  pointer-events: none;
}
.slot-title {
  position: absolute; left: ${d.titleSlot.x}px; top: var(--title-top);
  width: ${d.titleSlot.width}px; height: ${d.titleSlot.height}px;
  font-size: var(--title-size); font-weight: 700;
  line-height: 1.18; text-shadow: 0 2px 12px rgba(0,0,0,0.55); overflow: hidden;
  display: flex; flex-direction: column;
}
.slot-subtitle {
  position: absolute; left: ${d.subX}px; top: var(--subtitle-top);
  width: ${d.subW}px; height: ${d.subH}px;
  font-size: var(--subtitle-size); font-weight: 500;
  line-height: 1.35; color: rgba(255,255,255,0.85);
  text-shadow: 0 1px 6px rgba(0,0,0,0.4); overflow: hidden;
  display: flex; flex-direction: column;
}
.slot-footer {
  position: absolute; left: ${d.footerSlot.x}px; bottom: var(--footer-bottom);
  width: ${d.footerSlot.width}px; height: ${d.footerSlot.height}px;
  font-size: var(--footer-size); color: rgba(255,255,255,0.7);
  line-height: ${d.footerSlot.height}px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
  display: flex; flex-direction: column;
}`.trim();

  const overrideBlock = params.cssOverrideBlock ?? "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<style>
${css}
${overrideBlock}
</style>
</head>
<body>
<div id="canvas" class="canvas" data-safe-top="${sa.top}" data-safe-bottom="${sa.bottom}" data-safe-left="${sa.left}" data-safe-right="${sa.right}" data-footer-zone-h="${FOOTER_ZONE_H}">
  <img class="hero-img" src="${escapeHtml(d.heroSrc)}" alt="${escapeHtml(d.titleText)}" />
  <div class="scrim"></div>
  <div id="box-title" class="slot-title" data-bbox-w="${d.titleSlot.width}" data-bbox-h="${d.titleSlot.height}">${escapeHtml(d.titleText)}</div>
${subtitleBlock}
  <div id="box-footer" class="slot-footer">${escapeHtml(d.footerText)}</div>
</div>
</body>
</html>`;
}

// ============================================================================
// Cover V2: left-aligned, title in lower area, taller scrim
// ============================================================================

const COVER_V2_SCRIM_H = 360;

function renderCoverHtmlV2(params: {
  template: TemplateSpec;
  mapping: SlotMapping;
  styleVars?: CoverStyleVars;
  offsetVars?: CoverOffsetVars;
  cssOverrideBlock?: string;
}): string {
  const { template, styleVars, offsetVars } = params;
  const d = extractCoverData(params);
  const sa = template.safeArea;

  const titleSizePx = styleVars?.titleSizePx ?? 56;
  const subtitleSizePx = styleVars?.subtitleSizePx ?? 24;
  const footerSizePx = Math.max(styleVars?.footerSizePx ?? DEFAULT_FOOTER_SIZE_PX, MIN_FOOTER_SIZE_PX);

  const titleTopPx = offsetVars?.titleTopPx ?? d.titleSlot.y;
  const subtitleTopPx = offsetVars?.subtitleTopPx ?? d.subY;
  const footerBottomPx = offsetVars?.footerBottomPx ?? (H - d.footerSlot.y - d.footerSlot.height);

  let subtitleBlock = "";
  if (d.subtitleText) {
    subtitleBlock =
      `  <div id="box-subtitle" class="slot-subtitle"` +
      ` data-bbox-w="${d.subW}" data-bbox-h="${d.subH}"` +
      `>${escapeHtml(d.subtitleText)}</div>`;
  }

  const css = `
:root {
  --title-size: ${titleSizePx}px;
  --subtitle-size: ${subtitleSizePx}px;
  --footer-size: ${footerSizePx}px;
  --title-top: ${titleTopPx}px;
  --subtitle-top: ${subtitleTopPx}px;
  --footer-bottom: ${footerBottomPx}px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
.canvas {
  display: flex; flex-direction: column;
  position: relative; width: ${W}px; height: ${H}px;
  background: #000;
  font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  color: #fff;
}
.hero-img {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover; filter: brightness(0.55); display: block;
}
/* Taller scrim for v2 — stronger readability for lower-positioned text */
.scrim {
  position: absolute; left: 0; right: 0; bottom: 0;
  height: ${COVER_V2_SCRIM_H}px;
  background: linear-gradient(to top, rgba(0,0,0,0.72), transparent);
  pointer-events: none;
}
/* Left-aligned title in lower area */
.slot-title {
  position: absolute; left: ${d.titleSlot.x}px; top: var(--title-top);
  width: ${d.titleSlot.width}px; height: ${d.titleSlot.height}px;
  font-size: var(--title-size); font-weight: 700;
  line-height: 1.22; text-align: left;
  text-shadow: 0 2px 16px rgba(0,0,0,0.7); overflow: hidden;
  display: flex; flex-direction: column;
}
/* Subtitle below title, left-aligned */
.slot-subtitle {
  position: absolute; left: ${d.subX}px; top: var(--subtitle-top);
  width: ${d.subW}px; height: ${d.subH}px;
  font-size: var(--subtitle-size); font-weight: 500;
  line-height: 1.35; color: rgba(255,255,255,0.75);
  text-shadow: 0 1px 8px rgba(0,0,0,0.5); overflow: hidden;
  display: flex; flex-direction: column;
}
.slot-footer {
  position: absolute; left: ${d.footerSlot.x}px; bottom: var(--footer-bottom);
  width: ${d.footerSlot.width}px; height: ${d.footerSlot.height}px;
  font-size: var(--footer-size); color: rgba(255,255,255,0.7);
  line-height: ${d.footerSlot.height}px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
  display: flex; flex-direction: column;
}`.trim();

  const overrideBlock = params.cssOverrideBlock ?? "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<style>
${css}
${overrideBlock}
</style>
</head>
<body>
<div id="canvas" class="canvas" data-safe-top="${sa.top}" data-safe-bottom="${sa.bottom}" data-safe-left="${sa.left}" data-safe-right="${sa.right}" data-footer-zone-h="${COVER_V2_SCRIM_H}">
  <img class="hero-img" src="${escapeHtml(d.heroSrc)}" alt="${escapeHtml(d.titleText)}" />
  <div class="scrim"></div>
  <div id="box-title" class="slot-title" data-bbox-w="${d.titleSlot.width}" data-bbox-h="${d.titleSlot.height}">${escapeHtml(d.titleText)}</div>
${subtitleBlock}
  <div id="box-footer" class="slot-footer">${escapeHtml(d.footerText)}</div>
</div>
</body>
</html>`;
}

// ============================================================================
// Fact (body) HTML renderer
// ============================================================================

const DEFAULT_HEADLINE_SIZE_PX = 36;
const DEFAULT_BODY_SIZE_PX = 48;

/**
 * Render a fact (body) slide to self-contained HTML.
 *
 * Dispatches to variation-specific renderers based on template.templateId:
 *   - body.fact.v1: headline top + divider + center body (default)
 *   - body.fact.v2: left vertical bar/number accent + left-aligned text
 *   - body.fact.v3: rounded card containing body, headline as small caption
 *
 * All variations share 1080x1350 canvas, solid gradient bg, footerCredits at bottom.
 */
export function renderFactHtml(params: {
  template: TemplateSpec;
  mapping: SlotMapping;
  styleVars?: { headlineSizePx?: number; bodySizePx?: number; footerSizePx?: number };
  offsetVars?: { footerBottomPx?: number };
  slideIndex?: number;
  /** Extra CSS rules injected after the base styles (from StyleProfile) */
  cssOverrideBlock?: string;
}): string {
  const tid = params.template.templateId;
  if (tid === "body.fact.v2") return renderFactHtmlV2(params);
  if (tid === "body.fact.v3") return renderFactHtmlV3(params);
  if (tid === "body.fact.v4") return renderFactHtmlV4(params);
  return renderFactHtmlV1(params);
}

// ---- Shared helpers for fact renderers ----

interface FactSlots {
  headlineSlot: import("../types.js").TemplateSlot;
  bodySlot: import("../types.js").TemplateSlot;
  footerSlot: import("../types.js").TemplateSlot;
}

interface FactTexts {
  headlineText: string;
  bodyText: string;
  footerText: string;
}

function extractFactSlots(template: TemplateSpec): FactSlots {
  const headlineSlot = template.slots.find((s) => s.id === "headline");
  const bodySlot = template.slots.find((s) => s.id === "body");
  const footerSlot = template.slots.find((s) => s.id === "footerCredits");
  if (!headlineSlot || !bodySlot || !footerSlot) {
    throw new Error("renderFactHtml: template missing required slots");
  }
  return { headlineSlot, bodySlot, footerSlot };
}

/**
 * Extract optional hero image from mapping for fact/outro slides.
 * Returns file URL string or null if no hero image is present.
 */
function extractHeroImageSrc(mapping: SlotMapping): string | null {
  const heroVal = mapping["heroImage"];
  if (!heroVal || heroVal.kind !== "image") return null;
  return localPathToFileUrl(heroVal.localPath);
}

function extractFactTexts(mapping: SlotMapping, slots: FactSlots): FactTexts {
  const headlineVal = mapping["headline"];
  const bodyVal = mapping["body"];
  const footerVal = mapping["footerCredits"];

  if (!headlineVal || headlineVal.kind !== "text") {
    throw new Error("renderFactHtml: headline slot missing or wrong kind");
  }
  if (!bodyVal || bodyVal.kind !== "text") {
    throw new Error("renderFactHtml: body slot missing or wrong kind");
  }
  if (!footerVal || footerVal.kind !== "text") {
    throw new Error("renderFactHtml: footerCredits slot missing or wrong kind");
  }

  return {
    headlineText: applySlotTextConstraints({
      text: headlineVal.text,
      maxChars: slots.headlineSlot.constraints?.maxChars,
      maxLines: slots.headlineSlot.constraints?.maxLines,
    }),
    bodyText: applySlotTextConstraints({
      text: bodyVal.text,
      maxChars: slots.bodySlot.constraints?.maxChars,
      maxLines: slots.bodySlot.constraints?.maxLines,
    }),
    footerText: applySlotTextConstraints({
      text: footerVal.text,
      maxChars: slots.footerSlot.constraints?.maxChars,
      maxLines: slots.footerSlot.constraints?.maxLines,
    }),
  };
}

// ============================================================================
// V1: headline top + divider + center body (original)
// ============================================================================

function renderFactHtmlV1(params: {
  template: TemplateSpec;
  mapping: SlotMapping;
  styleVars?: { headlineSizePx?: number; bodySizePx?: number; footerSizePx?: number };
  offsetVars?: { footerBottomPx?: number };
  cssOverrideBlock?: string;
}): string {
  const { template, mapping, styleVars, offsetVars } = params;
  const slots = extractFactSlots(template);
  const texts = extractFactTexts(mapping, slots);
  const { headlineSlot, bodySlot, footerSlot } = slots;
  const heroSrc = extractHeroImageSrc(mapping);

  const headlineSizePx = styleVars?.headlineSizePx ?? DEFAULT_HEADLINE_SIZE_PX;
  const bodySizePx = styleVars?.bodySizePx ?? DEFAULT_BODY_SIZE_PX;
  const footerSizePx = Math.max(
    styleVars?.footerSizePx ?? DEFAULT_FOOTER_SIZE_PX,
    MIN_FOOTER_SIZE_PX
  );
  const footerBottomPx = offsetVars?.footerBottomPx ?? (H - footerSlot.y - footerSlot.height);
  const sa = template.safeArea;
  const dividerY = headlineSlot.y + headlineSlot.height + 20;

  const bgStyle = heroSrc
    ? "background: #000;"
    : "background: linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);";

  const heroImgCss = heroSrc ? `
.hero-img {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover; filter: brightness(0.45); display: block;
}
.scrim {
  position: absolute; left: 0; right: 0; bottom: 0;
  height: ${FOOTER_ZONE_H}px;
  background: linear-gradient(to top, rgba(0,0,0,0.65), transparent);
  pointer-events: none;
}` : "";

  const css = `
:root {
  --headline-size: ${headlineSizePx}px;
  --body-size: ${bodySizePx}px;
  --footer-size: ${footerSizePx}px;
  --footer-bottom: ${footerBottomPx}px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
.canvas {
  display: flex; flex-direction: column;
  position: relative; width: ${W}px; height: ${H}px;
  ${bgStyle}
  font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  color: #fff;
}${heroImgCss}
.slot-headline {
  position: absolute; left: ${headlineSlot.x}px; top: ${headlineSlot.y}px;
  width: ${headlineSlot.width}px; height: ${headlineSlot.height}px;
  font-size: var(--headline-size); font-weight: 600;
  color: rgba(255,255,255,0.55); letter-spacing: 2px;
  line-height: ${headlineSlot.height}px; overflow: hidden;
  display: flex; flex-direction: column;
}
.divider {
  position: absolute; left: ${headlineSlot.x}px; top: ${dividerY}px;
  width: 80px; height: 4px;
  background: rgba(255,255,255,0.25); border-radius: 2px;
}
.slot-body {
  position: absolute; left: ${bodySlot.x}px; top: ${bodySlot.y}px;
  width: ${bodySlot.width}px; height: ${bodySlot.height}px;
  font-size: var(--body-size); font-weight: 700;
  line-height: 1.35; text-shadow: 0 2px 8px rgba(0,0,0,0.3); overflow: hidden;
  display: flex; flex-direction: column;
}
.slot-footer {
  position: absolute; left: ${footerSlot.x}px; bottom: var(--footer-bottom);
  width: ${footerSlot.width}px; height: ${footerSlot.height}px;
  font-size: var(--footer-size); color: rgba(255,255,255,0.7);
  line-height: ${footerSlot.height}px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
  display: flex; flex-direction: column;
}`.trim();

  const overrideBlock = params.cssOverrideBlock ?? "";

  const heroBlock = heroSrc
    ? `  <img class="hero-img" src="${escapeHtml(heroSrc)}" alt="" />\n  <div class="scrim"></div>\n`
    : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8" />
<style>
${css}
${overrideBlock}
</style>
</head>
<body>
<div id="canvas" class="canvas" data-safe-top="${sa.top}" data-safe-bottom="${sa.bottom}" data-safe-left="${sa.left}" data-safe-right="${sa.right}" data-footer-zone-h="${FOOTER_ZONE_H}">
${heroBlock}  <div id="box-headline" class="slot-headline" data-bbox-w="${headlineSlot.width}" data-bbox-h="${headlineSlot.height}">${escapeHtml(texts.headlineText)}</div>
  <div class="divider"></div>
  <div id="box-body" class="slot-body" data-bbox-w="${bodySlot.width}" data-bbox-h="${bodySlot.height}">${escapeHtml(texts.bodyText)}</div>
  <div id="box-footer" class="slot-footer">${escapeHtml(texts.footerText)}</div>
</div>
</body>
</html>`;
}

// ============================================================================
// V2: left vertical bar + number accent + left-aligned text
// ============================================================================

function renderFactHtmlV2(params: {
  template: TemplateSpec;
  mapping: SlotMapping;
  styleVars?: { headlineSizePx?: number; bodySizePx?: number; footerSizePx?: number };
  offsetVars?: { footerBottomPx?: number };
  slideIndex?: number;
  cssOverrideBlock?: string;
}): string {
  const { template, mapping, styleVars, offsetVars } = params;
  const slots = extractFactSlots(template);
  const texts = extractFactTexts(mapping, slots);
  const { headlineSlot, bodySlot, footerSlot } = slots;
  const heroSrc = extractHeroImageSrc(mapping);

  const headlineSizePx = styleVars?.headlineSizePx ?? 32;
  const bodySizePx = styleVars?.bodySizePx ?? 44;
  const footerSizePx = Math.max(
    styleVars?.footerSizePx ?? DEFAULT_FOOTER_SIZE_PX,
    MIN_FOOTER_SIZE_PX
  );
  const footerBottomPx = offsetVars?.footerBottomPx ?? (H - footerSlot.y - footerSlot.height);
  const sa = template.safeArea;

  // Decorative number: use slideIndex or default to "01"
  const displayNum = String(params.slideIndex ?? 1).padStart(2, "0");

  const bgStyle = heroSrc
    ? "background: #000;"
    : "background: linear-gradient(160deg, #0b2027 0%, #0a3d42 40%, #1b6b5a 100%);";

  const css = `
:root {
  --headline-size: ${headlineSizePx}px;
  --body-size: ${bodySizePx}px;
  --footer-size: ${footerSizePx}px;
  --footer-bottom: ${footerBottomPx}px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
.canvas {
  display: flex; flex-direction: column;
  position: relative; width: ${W}px; height: ${H}px;
  ${bgStyle}
  font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  color: #fff;
}${heroSrc ? `
.hero-img {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover; filter: brightness(0.45); display: block;
}
.scrim {
  position: absolute; left: 0; right: 0; bottom: 0;
  height: ${FOOTER_ZONE_H}px;
  background: linear-gradient(to top, rgba(0,0,0,0.65), transparent);
  pointer-events: none;
}` : ""}
/* Left vertical accent bar */
.accent-bar {
  position: absolute; left: 60px; top: 100px;
  width: 4px; height: 800px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(255,255,255,0.08));
  border-radius: 2px;
}
/* Large decorative number */
.accent-number {
  position: absolute; left: 60px; top: 90px;
  font-size: 120px; font-weight: 800;
  color: rgba(255,255,255,0.06);
  letter-spacing: -4px; line-height: 1;
  pointer-events: none;
}
.slot-headline {
  position: absolute; left: ${headlineSlot.x}px; top: ${headlineSlot.y}px;
  width: ${headlineSlot.width}px; height: ${headlineSlot.height}px;
  font-size: var(--headline-size); font-weight: 600;
  color: rgba(255,255,255,0.55); letter-spacing: 1px;
  line-height: ${headlineSlot.height}px; overflow: hidden;
  display: flex; flex-direction: column;
}
.slot-body {
  position: absolute; left: ${bodySlot.x}px; top: ${bodySlot.y}px;
  width: ${bodySlot.width}px; height: ${bodySlot.height}px;
  font-size: var(--body-size); font-weight: 700;
  line-height: 1.4; text-shadow: 0 1px 6px rgba(0,0,0,0.25); overflow: hidden;
  display: flex; flex-direction: column;
}
.slot-footer {
  position: absolute; left: ${footerSlot.x}px; bottom: var(--footer-bottom);
  width: ${footerSlot.width}px; height: ${footerSlot.height}px;
  font-size: var(--footer-size); color: rgba(255,255,255,0.7);
  line-height: ${footerSlot.height}px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
  display: flex; flex-direction: column;
}`.trim();

  const overrideBlock = params.cssOverrideBlock ?? "";

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8" />
<style>
${css}
${overrideBlock}
</style>
</head>
<body>
<div id="canvas" class="canvas" data-safe-top="${sa.top}" data-safe-bottom="${sa.bottom}" data-safe-left="${sa.left}" data-safe-right="${sa.right}" data-footer-zone-h="${FOOTER_ZONE_H}">
${heroSrc ? `  <img class="hero-img" src="${escapeHtml(heroSrc)}" alt="" />\n  <div class="scrim"></div>` : ""}
  <div class="accent-number">${escapeHtml(displayNum)}</div>
  <div class="accent-bar"></div>
  <div id="box-headline" class="slot-headline" data-bbox-w="${headlineSlot.width}" data-bbox-h="${headlineSlot.height}">${escapeHtml(texts.headlineText)}</div>
  <div id="box-body" class="slot-body" data-bbox-w="${bodySlot.width}" data-bbox-h="${bodySlot.height}">${escapeHtml(texts.bodyText)}</div>
  <div id="box-footer" class="slot-footer">${escapeHtml(texts.footerText)}</div>
</div>
</body>
</html>`;
}

// ============================================================================
// V3: rounded card containing body, headline as small caption
// ============================================================================

function renderFactHtmlV3(params: {
  template: TemplateSpec;
  mapping: SlotMapping;
  styleVars?: { headlineSizePx?: number; bodySizePx?: number; footerSizePx?: number };
  offsetVars?: { footerBottomPx?: number };
  cssOverrideBlock?: string;
}): string {
  const { template, mapping, styleVars, offsetVars } = params;
  const slots = extractFactSlots(template);
  const texts = extractFactTexts(mapping, slots);
  const { headlineSlot, bodySlot, footerSlot } = slots;
  const heroSrc = extractHeroImageSrc(mapping);

  const headlineSizePx = styleVars?.headlineSizePx ?? 24;
  const bodySizePx = styleVars?.bodySizePx ?? 42;
  const footerSizePx = Math.max(
    styleVars?.footerSizePx ?? DEFAULT_FOOTER_SIZE_PX,
    MIN_FOOTER_SIZE_PX
  );
  const footerBottomPx = offsetVars?.footerBottomPx ?? (H - footerSlot.y - footerSlot.height);
  const sa = template.safeArea;

  // Card dimensions (centered within canvas)
  const cardLeft = 70;
  const cardTop = 280;
  const cardWidth = 940;
  const cardHeight = 680;

  const css = `
:root {
  --headline-size: ${headlineSizePx}px;
  --body-size: ${bodySizePx}px;
  --footer-size: ${footerSizePx}px;
  --footer-bottom: ${footerBottomPx}px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
.canvas {
  display: flex; flex-direction: column;
  position: relative; width: ${W}px; height: ${H}px;
  ${heroSrc ? "background: #000;" : "background: linear-gradient(160deg, #1a0a2e 0%, #2d1b4e 40%, #4a2068 100%);"}
  font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  color: #fff;
}${heroSrc ? `
.hero-img {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover; filter: brightness(0.45); display: block;
}
.scrim {
  position: absolute; left: 0; right: 0; bottom: 0;
  height: ${FOOTER_ZONE_H}px;
  background: linear-gradient(to top, rgba(0,0,0,0.65), transparent);
  pointer-events: none;
}` : ""}
/* Headline — small caption above card */
.slot-headline {
  position: absolute; left: ${headlineSlot.x}px; top: ${headlineSlot.y}px;
  width: ${headlineSlot.width}px; height: ${headlineSlot.height}px;
  font-size: var(--headline-size); font-weight: 500;
  color: rgba(255,255,255,0.45); letter-spacing: 4px;
  text-transform: uppercase; line-height: ${headlineSlot.height}px;
  overflow: hidden;
  display: flex; flex-direction: column;
}
/* Rounded card container */
.card {
  position: absolute;
  left: ${cardLeft}px; top: ${cardTop}px;
  width: ${cardWidth}px; height: ${cardHeight}px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 24px;
  display: flex; align-items: center; justify-content: center;
  padding: 50px;
}
/* Body text inside card */
.slot-body {
  width: ${bodySlot.width}px;
  max-height: ${bodySlot.height}px;
  font-size: var(--body-size); font-weight: 600;
  line-height: 1.4; text-shadow: 0 2px 8px rgba(0,0,0,0.2); overflow: hidden;
  display: flex; flex-direction: column;
}
.slot-footer {
  position: absolute; left: ${footerSlot.x}px; bottom: var(--footer-bottom);
  width: ${footerSlot.width}px; height: ${footerSlot.height}px;
  font-size: var(--footer-size); color: rgba(255,255,255,0.7);
  line-height: ${footerSlot.height}px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
  display: flex; flex-direction: column;
}`.trim();

  const overrideBlock = params.cssOverrideBlock ?? "";

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8" />
<style>
${css}
${overrideBlock}
</style>
</head>
<body>
<div id="canvas" class="canvas" data-safe-top="${sa.top}" data-safe-bottom="${sa.bottom}" data-safe-left="${sa.left}" data-safe-right="${sa.right}" data-footer-zone-h="${FOOTER_ZONE_H}">
${heroSrc ? `  <img class="hero-img" src="${escapeHtml(heroSrc)}" alt="" />\n  <div class="scrim"></div>` : ""}
  <div id="box-headline" class="slot-headline" data-bbox-w="${headlineSlot.width}" data-bbox-h="${headlineSlot.height}">${escapeHtml(texts.headlineText)}</div>
  <div class="card">
    <div id="box-body" class="slot-body" data-bbox-w="${bodySlot.width}" data-bbox-h="${bodySlot.height}">${escapeHtml(texts.bodyText)}</div>
  </div>
  <div id="box-footer" class="slot-footer">${escapeHtml(texts.footerText)}</div>
</div>
</body>
</html>`;
}

// ============================================================================
// V4: Editorial light-background body (magazine style)
// ============================================================================

function renderFactHtmlV4(params: {
  template: TemplateSpec;
  mapping: SlotMapping;
  styleVars?: { headlineSizePx?: number; bodySizePx?: number; footerSizePx?: number };
  offsetVars?: { footerBottomPx?: number };
  cssOverrideBlock?: string;
}): string {
  const { template, mapping, styleVars, offsetVars } = params;
  const slots = extractFactSlots(template);
  const texts = extractFactTexts(mapping, slots);
  const { headlineSlot, bodySlot, footerSlot } = slots;

  const headlineSizePx = styleVars?.headlineSizePx ?? 18;
  const bodySizePx = styleVars?.bodySizePx ?? 36;
  const footerSizePx = Math.max(
    styleVars?.footerSizePx ?? DEFAULT_FOOTER_SIZE_PX,
    MIN_FOOTER_SIZE_PX
  );
  const footerBottomPx = offsetVars?.footerBottomPx ?? (H - footerSlot.y - footerSlot.height);
  const sa = template.safeArea;

  const css = `
:root {
  --headline-size: ${headlineSizePx}px;
  --body-size: ${bodySizePx}px;
  --footer-size: ${footerSizePx}px;
  --footer-bottom: ${footerBottomPx}px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
.canvas {
  display: flex; flex-direction: column;
  position: relative; width: ${W}px; height: ${H}px;
  background: #FAFAF8;
  font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  color: #1A1A1A;
}
/* Headline — small label (editorial caption style) */
.slot-headline {
  position: absolute; left: ${headlineSlot.x}px; top: ${headlineSlot.y}px;
  width: ${headlineSlot.width}px; height: ${headlineSlot.height}px;
  font-size: var(--headline-size); font-weight: 500;
  color: rgba(26,26,26,0.55); letter-spacing: -0.2px;
  line-height: ${headlineSlot.height}px;
  overflow: hidden;
  display: flex; flex-direction: column;
}
/* Divider line under headline */
.divider {
  position: absolute; left: ${headlineSlot.x}px; top: ${headlineSlot.y + headlineSlot.height + 20}px;
  width: 40px; height: 2px;
  background: rgba(26,26,26,0.2);
}
/* Body text — editorial, generous spacing */
.slot-body {
  position: absolute; left: ${bodySlot.x}px; top: ${bodySlot.y}px;
  width: ${bodySlot.width}px; max-height: ${bodySlot.height}px;
  font-size: var(--body-size); font-weight: 600;
  line-height: 1.5; letter-spacing: -0.5px;
  overflow: hidden;
  display: flex; flex-direction: column;
}
/* Footer */
.slot-footer {
  position: absolute; left: ${footerSlot.x}px; bottom: var(--footer-bottom);
  width: ${footerSlot.width}px; height: ${footerSlot.height}px;
  font-size: var(--footer-size); color: rgba(26,26,26,0.5);
  line-height: ${footerSlot.height}px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
  display: flex; flex-direction: column;
}`.trim();

  const overrideBlock = params.cssOverrideBlock ?? "";

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8" />
<style>
${css}
${overrideBlock}
</style>
</head>
<body>
<div id="canvas" class="canvas" data-safe-top="${sa.top}" data-safe-bottom="${sa.bottom}" data-safe-left="${sa.left}" data-safe-right="${sa.right}" data-footer-zone-h="${FOOTER_ZONE_H}">
  <div id="box-headline" class="slot-headline" data-bbox-w="${headlineSlot.width}" data-bbox-h="${headlineSlot.height}">${escapeHtml(texts.headlineText)}</div>
  <div class="divider"></div>
  <div id="box-body" class="slot-body" data-bbox-w="${bodySlot.width}" data-bbox-h="${bodySlot.height}">${escapeHtml(texts.bodyText)}</div>
  <div id="box-footer" class="slot-footer">${escapeHtml(texts.footerText)}</div>
</div>
</body>
</html>`;
}

// ============================================================================
// Outro (end) HTML renderer
// ============================================================================

const DEFAULT_CTA_SIZE_PX = 52;

/**
 * Render an outro (end/CTA) slide to self-contained HTML.
 *
 * Visual spec:
 *   - 1080x1350 canvas, solid dark gradient background
 *   - cta: center, large bold text, 1–2 lines
 *   - footerCredits: bottom fixed
 */
export function renderOutroHtml(params: {
  template: TemplateSpec;
  mapping: SlotMapping;
  styleVars?: { ctaSizePx?: number; footerSizePx?: number };
  offsetVars?: { footerBottomPx?: number };
  cssOverrideBlock?: string;
}): string {
  const { template, mapping, styleVars, offsetVars } = params;

  const ctaSlot = template.slots.find((s) => s.id === "cta");
  const footerSlot = template.slots.find((s) => s.id === "footerCredits");

  if (!ctaSlot || !footerSlot) {
    throw new Error("renderOutroHtml: template missing required slots");
  }

  const heroSrc = extractHeroImageSrc(mapping);

  const ctaSizePx = styleVars?.ctaSizePx ?? DEFAULT_CTA_SIZE_PX;
  const footerSizePx = Math.max(
    styleVars?.footerSizePx ?? DEFAULT_FOOTER_SIZE_PX,
    MIN_FOOTER_SIZE_PX
  );
  const footerBottomPx = offsetVars?.footerBottomPx ?? (H - footerSlot.y - footerSlot.height);

  const sa = template.safeArea;

  // ---- Extract mapping values ----
  const ctaVal = mapping["cta"];
  const footerVal = mapping["footerCredits"];

  if (!ctaVal || ctaVal.kind !== "text") {
    throw new Error("renderOutroHtml: cta slot missing or wrong kind");
  }
  if (!footerVal || footerVal.kind !== "text") {
    throw new Error("renderOutroHtml: footerCredits slot missing or wrong kind");
  }

  const ctaText = applySlotTextConstraints({
    text: ctaVal.text,
    maxChars: ctaSlot.constraints?.maxChars,
    maxLines: ctaSlot.constraints?.maxLines,
  });
  const footerText = applySlotTextConstraints({
    text: footerVal.text,
    maxChars: footerSlot.constraints?.maxChars,
    maxLines: footerSlot.constraints?.maxLines,
  });

  const css = `
:root {
  --cta-size: ${ctaSizePx}px;
  --footer-size: ${footerSizePx}px;
  --footer-bottom: ${footerBottomPx}px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: ${W}px;
  height: ${H}px;
  overflow: hidden;
}
.canvas {
  display: flex; flex-direction: column;
  position: relative;
  width: ${W}px;
  height: ${H}px;
  ${heroSrc ? "background: #000;" : "background: linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%);"}
  font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  color: #fff;
}${heroSrc ? `
.hero-img {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover; filter: brightness(0.45); display: block;
}
.scrim {
  position: absolute; left: 0; right: 0; bottom: 0;
  height: ${FOOTER_ZONE_H}px;
  background: linear-gradient(to top, rgba(0,0,0,0.65), transparent);
  pointer-events: none;
}` : ""}
.slot-cta {
  position: absolute;
  left: ${ctaSlot.x}px;
  top: ${ctaSlot.y}px;
  width: ${ctaSlot.width}px;
  height: ${ctaSlot.height}px;
  font-size: var(--cta-size);
  font-weight: 700;
  line-height: 1.4;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  text-shadow: 0 2px 12px rgba(0,0,0,0.4);
  overflow: hidden;
}
.slot-footer {
  position: absolute;
  left: ${footerSlot.x}px;
  bottom: var(--footer-bottom);
  width: ${footerSlot.width}px;
  height: ${footerSlot.height}px;
  font-size: var(--footer-size);
  color: rgba(255,255,255,0.7);
  line-height: ${footerSlot.height}px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex; flex-direction: column;
}`.trim();

  const overrideBlock = params.cssOverrideBlock ?? "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<style>
${css}
${overrideBlock}
</style>
</head>
<body>
<div id="canvas" class="canvas" data-safe-top="${sa.top}" data-safe-bottom="${sa.bottom}" data-safe-left="${sa.left}" data-safe-right="${sa.right}" data-footer-zone-h="${FOOTER_ZONE_H}">
${heroSrc ? `  <img class="hero-img" src="${escapeHtml(heroSrc)}" alt="" />\n  <div class="scrim"></div>` : ""}
  <div id="box-cta" class="slot-cta" data-bbox-w="${ctaSlot.width}" data-bbox-h="${ctaSlot.height}">${escapeHtml(ctaText)}</div>
  <div id="box-footer" class="slot-footer">${escapeHtml(footerText)}</div>
</div>
</body>
</html>`;
}

// ============================================================================
// Music: Album Cover HTML renderer
// ============================================================================

export function renderMusicAlbumCoverHtml(params: {
  template: TemplateSpec;
  mapping: SlotMapping;
}): string {
  const { template, mapping } = params;
  const sa = template.safeArea;

  const albumArtVal = mapping["albumArt"];
  const titleVal = mapping["title"];
  const footerVal = mapping["footerCredits"];
  const artistVal = mapping["artist"];
  const releaseDateVal = mapping["releaseDate"];

  if (!albumArtVal || albumArtVal.kind !== "image") {
    throw new Error("renderMusicAlbumCoverHtml: albumArt slot missing");
  }
  if (!titleVal || titleVal.kind !== "text") {
    throw new Error("renderMusicAlbumCoverHtml: title slot missing");
  }
  if (!footerVal || footerVal.kind !== "text") {
    throw new Error("renderMusicAlbumCoverHtml: footerCredits slot missing");
  }

  const albumSrc = localPathToFileUrl(albumArtVal.localPath);
  const albumSlot = template.slots.find((s) => s.id === "albumArt")!;

  const titleText = applySlotTextConstraints({
    text: titleVal.text,
    maxChars: template.slots.find((s) => s.id === "title")?.constraints?.maxChars,
    maxLines: template.slots.find((s) => s.id === "title")?.constraints?.maxLines,
  });

  const footerText = applySlotTextConstraints({
    text: footerVal.text,
    maxChars: template.slots.find((s) => s.id === "footerCredits")?.constraints?.maxChars,
    maxLines: template.slots.find((s) => s.id === "footerCredits")?.constraints?.maxLines,
  });

  const artistText = artistVal?.kind === "text" ? escapeHtml(artistVal.text) : "";
  const releaseText = releaseDateVal?.kind === "text" ? escapeHtml(releaseDateVal.text) : "";

  const css = `
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
.canvas {
  position: relative; width: ${W}px; height: ${H}px;
  background: linear-gradient(160deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
  font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  color: #fff; display: flex; flex-direction: column; align-items: center;
}
.album-art {
  position: absolute; left: ${albumSlot.x}px; top: ${albumSlot.y}px;
  width: ${albumSlot.width}px; height: ${albumSlot.height}px;
  border-radius: 12px; overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.album-art img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.title {
  position: absolute; left: 60px; top: 960px;
  width: 960px; text-align: center;
  font-size: 48px; font-weight: 700; line-height: 1.2;
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
}
.artist {
  position: absolute; left: 60px; top: 1090px;
  width: 960px; text-align: center;
  font-size: 28px; font-weight: 500;
  color: rgba(255,255,255,0.8);
}
.release-date {
  position: absolute; left: 60px; top: 1150px;
  width: 960px; text-align: center;
  font-size: 20px; color: rgba(255,255,255,0.6);
}
.footer {
  position: absolute; left: 60px; bottom: 40px;
  width: 960px; font-size: 14px;
  color: rgba(255,255,255,0.7); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}`.trim();

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8" />
<style>${css}</style>
</head>
<body>
<div class="canvas" data-safe-top="${sa.top}" data-safe-bottom="${sa.bottom}" data-safe-left="${sa.left}" data-safe-right="${sa.right}">
  <div class="album-art"><img src="${escapeHtml(albumSrc)}" alt="${escapeHtml(titleText)}" /></div>
  <div class="title">${escapeHtml(titleText)}</div>
  ${artistText ? `<div class="artist">${artistText}</div>` : ""}
  ${releaseText ? `<div class="release-date">${releaseText}</div>` : ""}
  <div class="footer">${escapeHtml(footerText)}</div>
</div>
</body>
</html>`;
}

// ============================================================================
// Music: Album Detail (tracklist) HTML renderer
// ============================================================================

export function renderMusicAlbumDetailHtml(params: {
  template: TemplateSpec;
  mapping: SlotMapping;
}): string {
  const { template, mapping } = params;
  const sa = template.safeArea;

  const headlineVal = mapping["headline"];
  const tracklistVal = mapping["tracklist"];
  const footerVal = mapping["footerCredits"];

  const headlineText = headlineVal?.kind === "text" ? headlineVal.text : "";
  const tracklistText = tracklistVal?.kind === "text" ? tracklistVal.text : "";
  const footerText = footerVal?.kind === "text" ? footerVal.text : "";

  const headlineSlot = template.slots.find(s => s.id === "headline");
  const tracklistSlot = template.slots.find(s => s.id === "tracklist");
  const footerSlot = template.slots.find(s => s.id === "footerCredits");

  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .canvas {
      display: flex; flex-direction: column;
      position: relative;
      width: 1080px; height: 1350px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      font-family: 'Pretendard', 'Apple SD Gothic Neo', sans-serif;
      overflow: hidden;
    }
    .headline {
      position: absolute;
      top: ${headlineSlot?.y ?? 120}px;
      left: ${headlineSlot?.x ?? 80}px;
      width: ${headlineSlot?.width ?? 920}px;
      font-size: ${headlineSlot?.style?.fontSize ?? 28}px;
      font-weight: ${headlineSlot?.style?.fontWeight ?? "600"};
      color: ${headlineSlot?.style?.color ?? "rgba(255,255,255,0.55)"};
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .tracklist {
      position: absolute;
      top: ${tracklistSlot?.y ?? 240}px;
      left: ${tracklistSlot?.x ?? 80}px;
      width: ${tracklistSlot?.width ?? 920}px;
      height: ${tracklistSlot?.height ?? 900}px;
      font-size: ${tracklistSlot?.style?.fontSize ?? 36}px;
      font-weight: ${tracklistSlot?.style?.fontWeight ?? "600"};
      color: ${tracklistSlot?.style?.color ?? "#FFFFFF"};
      line-height: ${tracklistSlot?.style?.lineHeight ?? 1.8};
      overflow: hidden;
    }
    .footer {
      position: absolute;
      bottom: ${footerSlot ? (1350 - footerSlot.y - footerSlot.height) : 40}px;
      left: ${footerSlot?.x ?? 60}px;
      width: ${footerSlot?.width ?? 960}px;
      font-size: ${footerSlot?.style?.fontSize ?? 14}px;
      color: ${footerSlot?.style?.color ?? "rgba(255,255,255,0.7)"};
      text-align: center;
    }
  `;

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8" />
<style>${css}</style>
</head>
<body>
<div class="canvas" data-safe-top="${sa.top}" data-safe-bottom="${sa.bottom}" data-safe-left="${sa.left}" data-safe-right="${sa.right}">
  <div class="headline">${escapeHtml(headlineText)}</div>
  <div class="tracklist">${escapeHtml(tracklistText)}</div>
  <div class="footer">${escapeHtml(footerText)}</div>
</div>
</body>
</html>`;
}

// ============================================================================
// Music: Meme HTML renderer
// ============================================================================

export function renderMemeHtml(params: {
  template: TemplateSpec;
  mapping: SlotMapping;
}): string {
  const { template, mapping } = params;
  const sa = template.safeArea;

  const memeVal = mapping["memeText"];
  const footerVal = mapping["footerCredits"];
  const artistImageVal = mapping["artistImage"];

  if (!memeVal || memeVal.kind !== "text") {
    throw new Error("renderMemeHtml: memeText slot missing");
  }
  if (!footerVal || footerVal.kind !== "text") {
    throw new Error("renderMemeHtml: footerCredits slot missing");
  }

  const memeSlot = template.slots.find((s) => s.id === "memeText")!;
  const memeText = applySlotTextConstraints({
    text: memeVal.text,
    maxChars: memeSlot.constraints?.maxChars,
    maxLines: memeSlot.constraints?.maxLines,
  });

  const footerText = applySlotTextConstraints({
    text: footerVal.text,
    maxChars: template.slots.find((s) => s.id === "footerCredits")?.constraints?.maxChars,
    maxLines: template.slots.find((s) => s.id === "footerCredits")?.constraints?.maxLines,
  });

  const isV1 = template.templateId === "music.meme.v1";
  const hasImage = isV1 && artistImageVal && artistImageVal.kind === "image";
  const imageSrc = hasImage ? localPathToFileUrl(artistImageVal.localPath) : "";

  const bgStyle = hasImage
    ? "background: #000;"
    : "background: linear-gradient(160deg, #1a0a2e 0%, #2d1b4e 40%, #4a2068 100%);";

  const imageBlock = hasImage
    ? `<img class="bg-img" src="${escapeHtml(imageSrc)}" alt="" />`
    : "";

  const css = `
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
.canvas {
  display: flex; flex-direction: column;
  position: relative; width: ${W}px; height: ${H}px;
  ${bgStyle}
  font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  color: #fff;
}
.bg-img {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover; filter: brightness(0.45); display: block;
}
.meme-text {
  position: absolute; left: ${memeSlot.x}px; top: ${memeSlot.y}px;
  width: ${memeSlot.width}px; height: ${memeSlot.height}px;
  font-size: 56px; font-weight: 800;
  line-height: 1.3; text-align: center;
  text-shadow: 0 4px 16px rgba(0,0,0,0.8);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.footer {
  position: absolute; left: 60px; bottom: 40px;
  width: 960px; font-size: 14px;
  color: rgba(255,255,255,0.7); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}`.trim();

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8" />
<style>${css}</style>
</head>
<body>
<div class="canvas" data-safe-top="${sa.top}" data-safe-bottom="${sa.bottom}" data-safe-left="${sa.left}" data-safe-right="${sa.right}">
  ${imageBlock}
  <div class="meme-text">${escapeHtml(memeText)}</div>
  <div class="footer">${escapeHtml(footerText)}</div>
</div>
</body>
</html>`;
}

// ============================================================================
// Music: Grid HTML renderer
// ============================================================================

export function renderGridHtml(params: {
  template: TemplateSpec;
  mapping: SlotMapping;
}): string {
  const { template, mapping } = params;
  const sa = template.safeArea;

  const titleVal = mapping["title"];
  const footerVal = mapping["footerCredits"];

  if (!titleVal || titleVal.kind !== "text") {
    throw new Error("renderGridHtml: title slot missing");
  }
  if (!footerVal || footerVal.kind !== "text") {
    throw new Error("renderGridHtml: footerCredits slot missing");
  }

  const titleText = escapeHtml(titleVal.text);
  const footerText = escapeHtml(footerVal.text);

  // Build grid image HTML
  const gridImages: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const slotId = `albumArt${i}`;
    const val = mapping[slotId];
    const slot = template.slots.find((s) => s.id === slotId);
    if (val && val.kind === "image" && slot) {
      const src = localPathToFileUrl(val.localPath);
      gridImages.push(
        `<div style="position:absolute;left:${slot.x}px;top:${slot.y}px;` +
        `width:${slot.width}px;height:${slot.height}px;border-radius:8px;overflow:hidden;">` +
        `<img src="${escapeHtml(src)}" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>`,
      );
    }
  }

  const css = `
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
.canvas {
  display: flex; flex-direction: column;
  position: relative; width: ${W}px; height: ${H}px;
  background: linear-gradient(160deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
  font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  color: #fff;
}
.title {
  position: absolute; left: 60px; top: 80px;
  width: 960px; text-align: center;
  font-size: 40px; font-weight: 700;
}
.footer {
  position: absolute; left: 60px; bottom: 40px;
  width: 960px; font-size: 14px;
  color: rgba(255,255,255,0.7); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}`.trim();

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8" />
<style>${css}</style>
</head>
<body>
<div class="canvas" data-safe-top="${sa.top}" data-safe-bottom="${sa.bottom}" data-safe-left="${sa.left}" data-safe-right="${sa.right}">
  <div class="title">${titleText}</div>
  ${gridImages.join("\n  ")}
  <div class="footer">${footerText}</div>
</div>
</body>
</html>`;
}

// ============================================================================
// Music: Concert HTML renderer
// ============================================================================

export function renderConcertHtml(params: {
  template: TemplateSpec;
  mapping: SlotMapping;
}): string {
  const { template, mapping } = params;
  const sa = template.safeArea;

  const posterVal = mapping["posterImage"];
  const venueVal = mapping["venue"];
  const dateVal = mapping["date"];
  const lineupVal = mapping["lineup"];
  const footerVal = mapping["footerCredits"];

  if (!posterVal || posterVal.kind !== "image") {
    throw new Error("renderConcertHtml: posterImage slot missing");
  }
  if (!venueVal || venueVal.kind !== "text") {
    throw new Error("renderConcertHtml: venue slot missing");
  }
  if (!dateVal || dateVal.kind !== "text") {
    throw new Error("renderConcertHtml: date slot missing");
  }
  if (!footerVal || footerVal.kind !== "text") {
    throw new Error("renderConcertHtml: footerCredits slot missing");
  }

  const posterSrc = localPathToFileUrl(posterVal.localPath);
  const posterSlot = template.slots.find((s) => s.id === "posterImage")!;

  const lineupText = lineupVal?.kind === "text" ? escapeHtml(lineupVal.text).replace(/\n/g, "<br>") : "";

  const css = `
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
.canvas {
  display: flex; flex-direction: column;
  position: relative; width: ${W}px; height: ${H}px;
  background: #0a0a0a;
  font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  color: #fff;
}
.poster {
  position: absolute; left: ${posterSlot.x}px; top: ${posterSlot.y}px;
  width: ${posterSlot.width}px; height: ${posterSlot.height}px;
  overflow: hidden;
}
.poster img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  filter: brightness(0.75);
}
.poster-scrim {
  position: absolute; left: 0; right: 0; bottom: 0; height: 200px;
  background: linear-gradient(to top, rgba(10,10,10,1), transparent);
}
.venue {
  position: absolute; left: 80px; top: 740px;
  font-size: 36px; font-weight: 700;
}
.date {
  position: absolute; left: 80px; top: 820px;
  font-size: 28px; font-weight: 600;
  color: rgba(255,255,255,0.85);
}
.lineup {
  position: absolute; left: 80px; top: 900px;
  width: 920px;
  font-size: 32px; font-weight: 500;
  color: rgba(255,255,255,0.75);
  line-height: 1.6;
}
.footer {
  position: absolute; left: 60px; bottom: 40px;
  width: 960px; font-size: 14px;
  color: rgba(255,255,255,0.7); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}`.trim();

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8" />
<style>${css}</style>
</head>
<body>
<div class="canvas" data-safe-top="${sa.top}" data-safe-bottom="${sa.bottom}" data-safe-left="${sa.left}" data-safe-right="${sa.right}">
  <div class="poster"><img src="${escapeHtml(posterSrc)}" alt="" /><div class="poster-scrim"></div></div>
  <div class="venue">${escapeHtml(venueVal.text)}</div>
  <div class="date">${escapeHtml(dateVal.text)}</div>
  ${lineupText ? `<div class="lineup">${lineupText}</div>` : ""}
  <div class="footer">${escapeHtml(footerVal.text)}</div>
</div>
</body>
</html>`;
}

// ============================================================================
// Legacy slot-based renderer (used by compose() full pipeline)
// ============================================================================

function renderSlotCss(slot: TemplateSlot): string {
  const parts: string[] = [
    `position:absolute`,
    `left:${slot.x}px`,
    `top:${slot.y}px`,
    `width:${slot.width}px`,
    `height:${slot.height}px`,
  ];

  if (slot.style) {
    const s = slot.style;
    if (s.fontSize !== undefined) parts.push(`font-size:${s.fontSize}px`);
    if (s.fontWeight) parts.push(`font-weight:${s.fontWeight}`);
    if (s.color) parts.push(`color:${s.color}`);
    if (s.textShadow) parts.push(`text-shadow:${s.textShadow}`);
    if (s.textAlign) parts.push(`text-align:${s.textAlign}`);
    if (s.lineHeight !== undefined) parts.push(`line-height:${s.lineHeight}`);
  }

  return parts.join(";") + ";";
}

/**
 * Dispatch music.* family templates to specialized renderers.
 * Returns null if the template is not a music family (caller should use legacy path).
 */
export function tryRenderMusicHtml(
  template: TemplateSpec,
  mapping: SlotMapping,
): string | null {
  const fam = template.family;
  if (fam === "music.album" && template.templateId.includes("cover")) {
    return renderMusicAlbumCoverHtml({ template, mapping });
  }
  if (fam === "music.album" && template.templateId.includes("detail")) {
    return renderMusicAlbumDetailHtml({ template, mapping });
  }
  if (fam === "music.meme") {
    return renderMemeHtml({ template, mapping });
  }
  if (fam === "music.grid") {
    return renderGridHtml({ template, mapping });
  }
  if (fam === "music.concert") {
    return renderConcertHtml({ template, mapping });
  }
  return null;
}

export function buildSlideHtml(
  template: TemplateSpec,
  bindings: SlideBindings
): string {
  const slotHtmlParts: string[] = [];

  for (const slot of template.slots) {
    const binding = bindings.bindings[slot.id];
    if (!binding) continue;

    if (binding.type === "image") {
      const fit = slot.fit ?? "cover";
      slotHtmlParts.push(
        `<div style="${renderSlotCss(slot)}overflow:hidden;">` +
          `<img src="${escapeHtml(binding.src)}" ` +
          `alt="${escapeHtml(binding.alt ?? "")}" ` +
          `style="width:100%;height:100%;object-fit:${fit};display:block;" />` +
          `</div>`
      );
    } else {
      slotHtmlParts.push(
        `<div style="${renderSlotCss(slot)}overflow:hidden;` +
          `display:flex;align-items:center;">` +
          `<span>${escapeHtml(binding.content)}</span>` +
          `</div>`
      );
    }
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=${W}" />
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: ${W}px;
  height: ${H}px;
  overflow: hidden;
  position: relative;
  font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  background: #000;
}
</style>
</head>
<body>
${slotHtmlParts.join("\n")}
</body>
</html>`;
}
