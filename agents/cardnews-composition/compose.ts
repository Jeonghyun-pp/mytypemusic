import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  TopicConfig,
  TemplateSpec,
  SlideBindings,
  CompositionResult,
  RenderedSlide,
  LayoutManifest,
} from "./types.js";
import { TopicConfigSchema, TemplateSpecSchema } from "./schema.js";
import {
  resolveOutputPaths,
  slideHtmlName,
  slidePngName,
  resolveLocalImagePath,
} from "./io/paths.js";
import { loadValidatedPost } from "./io/load-validated-post.js";
import {
  ensureDir,
  saveCaption,
  saveManifest,
  saveHtml,
  saveJson,
} from "./io/save-outputs.js";
import { buildSlideHtml, renderCoverHtml, renderFactHtml, renderOutroHtml, tryRenderMusicHtml } from "./renderer/html.js";
import { renderHtmlToPng } from "./renderer/satori.js";
import { measureOverflow, measureSafeAreaAndFooter, measureSlideQa } from "./renderer/measure-static.js";
import type { SlideOverflow } from "./renderer/measure-static.js";
import { pickHeroAsset, resolveCredits } from "./credits.js";
import { normalizeText } from "./text-fit.js";
import { buildCaption, buildDeckCaption } from "./caption.js";
import { loadTopic as loadTopicPackage } from "./io/load-topic.js";
import {
  validateTemplateForCover,
  validateTemplateForFact,
  validateTemplateForOutro,
  validateTemplateForAlbumCover,
  buildCoverSlotMapping,
  buildFactSlotMapping,
  buildOutroSlotMapping,
  buildAlbumCoverSlotMapping,
  buildMemeSlotMapping,
  buildGridSlotMapping,
  buildConcertSlotMapping,
} from "./mapping.js";
import { buildSlidePlan, type SlidePlan } from "./story-planner.js";
import { buildMusicSlidePlan, type MusicSlidePlanOptions } from "./music-story-planner.js";
import { isValidPresetId, STYLE_PRESETS, type StylePresetId, pickPresetByCategory } from "./presets.js";
import { listSlideHtml, listSlidePairs } from "./io/list-slides.js";
import type { LLMSlidePlan } from "./llm/schema.js";
import { mapKindToTemplateFamily } from "./llm/prompts.js";
import { pickBodyVariation } from "./selector.js";
import type { StyleProfile } from "./style-analysis/schema.js";
import { styleProfileToCSSOverrides, buildCSSOverrideBlock, paletteToCSSOverrides } from "./style-analysis/css-mapper.js";
import { getPalette } from "./style-analysis/palettes.js";
import type { FontMood } from "./fonts/registry.js";

// Music PostTypes that use buildMusicSlidePlan instead of buildSlidePlan
const MUSIC_POST_TYPES = new Set([
  "album_release", "album_recommendation", "concert_info",
  "meme", "artist_spotlight", "curated_playlist",
]);

// ============================================================================
// LLM Slide Plan → SlidePlan conversion
// ============================================================================

/**
 * Convert an LLMSlidePlan to the existing SlidePlan[] format
 * so the rendering pipeline can consume it without changes.
 */
function llmPlanToSlidePlans(llmPlan: LLMSlidePlan, category: string): SlidePlan[] {
  const presetId = pickPresetByCategory(category);
  const seed = llmPlan.topicId;

  return llmPlan.slides.map((slide) => {
    const family = mapKindToTemplateFamily(slide.kind);
    let templateId: string;

    if (family === "cover") {
      templateId = slide.templateHint ?? `cover.hero.v1`;
    } else if (family === "outro") {
      templateId = slide.templateHint ?? "outro.cta.v1";
    } else {
      // fact/summary → pick variation based on index
      const variationId = pickBodyVariation({ seed, index: slide.slideIndex - 2 });
      templateId = slide.templateHint ?? `body.fact.${variationId}`;
    }

    const payload: Record<string, unknown> = { presetId };

    if (family === "cover") {
      payload.coverVariationId = templateId.split(".").pop() ?? "v1";
    } else if (family === "fact") {
      payload.headline = slide.title;
      payload.body = slide.bodyText;
      payload.variationId = templateId.split(".").pop() ?? "v1";
    } else if (family === "outro") {
      payload.cta = slide.bodyText || slide.title;
    }

    return {
      index: slide.slideIndex,
      kind: family,
      templateId,
      payload,
    };
  });
}

/**
 * Try to load an existing LLM slide plan from the output directory.
 */
async function tryLoadLLMPlan(outDir: string): Promise<LLMSlidePlan | null> {
  const planPath = path.join(outDir, "llm-slide-plan.json");
  try {
    const raw = await fs.readFile(planPath, "utf-8");
    return JSON.parse(raw) as LLMSlidePlan;
  } catch {
    return null;
  }
}

interface StyleOverridesResult {
  cssBlock: string;
  mood?: FontMood;
}

/**
 * Try to load a style profile from the output directory.
 * Falls back to preset palette when no style-profile.json exists.
 * Returns the CSS override block string and font mood if found.
 */
async function tryLoadStyleOverrides(
  outDir: string,
  presetId?: StylePresetId,
): Promise<StyleOverridesResult> {
  const profilePath = path.join(outDir, "style-profile.json");
  try {
    const raw = await fs.readFile(profilePath, "utf-8");
    const profile = JSON.parse(raw) as StyleProfile;
    const overrides = styleProfileToCSSOverrides(profile);
    const block = buildCSSOverrideBlock(overrides);
    if (block) {
      console.log(`[deck] Loaded style profile (confidence: ${profile.confidence}, mood: ${overrides.fontMood})`);
    }
    return { cssBlock: block, mood: overrides.fontMood as FontMood | undefined };
  } catch {
    // Fallback: use preset palette when no style profile exists
    if (presetId) {
      const preset = STYLE_PRESETS[presetId];
      if (preset?.paletteId) {
        const palette = getPalette(preset.paletteId);
        if (palette) {
          const overrides = paletteToCSSOverrides(palette, preset.fontMood);
          const block = buildCSSOverrideBlock(overrides);
          if (block) {
            console.log(`[deck] No style profile — using preset palette: ${preset.paletteId} (mood: ${preset.fontMood})`);
          }
          return { cssBlock: block, mood: preset.fontMood as FontMood | undefined };
        }
      }
    }
    return { cssBlock: "" };
  }
}

/**
 * Resolve effective font mood: style profile > preset > default.
 */
function resolveEffectiveMood(
  styleMood: FontMood | undefined,
  presetId?: StylePresetId,
): FontMood {
  if (styleMood) return styleMood;
  if (presetId && STYLE_PRESETS[presetId]?.fontMood) return STYLE_PRESETS[presetId]!.fontMood!;
  return "bold-display";
}

// ============================================================================
// Internal helpers
// ============================================================================

const DEFAULT_TEMPLATE_PATH = path.join(
  __dirname,
  "templates",
  "cover.hero.v1.json"
);

async function loadTemplate(templatePath?: string): Promise<TemplateSpec> {
  const p = templatePath ?? DEFAULT_TEMPLATE_PATH;
  const raw = await fs.readFile(path.resolve(p), "utf-8");
  return TemplateSpecSchema.parse(JSON.parse(raw));
}

async function loadTopic(topicPath: string): Promise<TopicConfig> {
  const raw = await fs.readFile(path.resolve(topicPath), "utf-8");
  return TopicConfigSchema.parse(JSON.parse(raw));
}

/**
 * Build Instagram caption text.
 * Attribution appendix is always included when present — structurally enforced.
 */
function buildCaptionText(
  topic: TopicConfig,
  captionAppendix: string
): string {
  const lines: string[] = [];

  lines.push(topic.title);
  if (topic.subtitle) lines.push(topic.subtitle);
  if (topic.bodyText) lines.push("", topic.bodyText);

  if (captionAppendix) {
    lines.push("", captionAppendix);
  }

  if (topic.hashtags && topic.hashtags.length > 0) {
    const tags = topic.hashtags
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .join(" ");
    lines.push("", tags);
  }

  return lines.join("\n");
}

// ============================================================================
// Preflight + Credits (Step 1)
// ============================================================================

export interface PreflightOptions {
  inputPath: string;
  outDir: string;
}

export interface CreditsPreview {
  pickedAssetId: string;
  role: string;
  localPath: string;
  footerCredits: string;
  footerLines: string[];
  captionAppendix: string;
}

/**
 * Preflight validation + credits resolution.
 * Outputs two preview files for inspection before rendering:
 *   - compliance.preview.json  (parsed subset dump)
 *   - credits.preview.json     (hero + resolved credits)
 *
 * Fails if:
 *   - allowed === false (post blocked by Agent1)
 *   - No suitable hero asset found
 *   - Attribution required but no credit text resolvable
 */
export async function preflightAndCredits(
  options: PreflightOptions
): Promise<CreditsPreview> {
  const { inputPath, outDir } = options;

  const { compliance } = await loadValidatedPost(inputPath);

  if (!compliance.allowed) {
    const notes = compliance.notes?.join("; ") ?? "no details";
    throw new Error(`Post not allowed: ${notes}`);
  }

  const hero = pickHeroAsset(compliance.images);
  if (!hero) {
    throw new Error(
      "No suitable hero asset found (need hero_unedited or background_editable)"
    );
  }

  const credits = resolveCredits(compliance, hero);

  const preview: CreditsPreview = {
    pickedAssetId: hero.assetId,
    role: hero.role,
    localPath: hero.localPath,
    footerCredits: credits.footerCredits,
    footerLines: credits.footerLines,
    captionAppendix: credits.captionAppendix,
  };

  await ensureDir(outDir);
  await saveJson(path.join(outDir, "compliance.preview.json"), compliance);
  await saveJson(path.join(outDir, "credits.preview.json"), preview);

  return preview;
}

// ============================================================================
// Template + Mapping Preview (Step 2)
// ============================================================================

/**
 * Load inputs, validate template, build slot mapping, and save previews.
 * Outputs:
 *   - template.preview.json  (parsed template)
 *   - mapping.preview.json   (slot-level mapping)
 */
export async function templateAndMappingPreview(config: {
  inputPath: string;
  topicPath: string;
  outDir: string;
  templatePath?: string;
}): Promise<void> {
  const { inputPath, topicPath, outDir } = config;

  // 1) Load & validate compliance
  const { compliance } = await loadValidatedPost(inputPath);

  if (!compliance.allowed) {
    const notes = compliance.notes?.join("; ") ?? "no details";
    throw new Error(`Post not allowed: ${notes}`);
  }

  // 2) Load topic
  const topic = await loadTopicPackage(topicPath);

  // 3) Load & parse template
  const template = await loadTemplate(config.templatePath);

  // 4) Validate template structure
  validateTemplateForCover(template);

  // 5) Build slot mapping
  const mapping = buildCoverSlotMapping({ template, compliance, topic });

  // 6) Save previews
  await ensureDir(outDir);
  await saveJson(path.join(outDir, "template.preview.json"), template);
  await saveJson(path.join(outDir, "mapping.preview.json"), mapping);
}

// ============================================================================
// HTML Generation (Step 3)
// ============================================================================

/** Font downscale constants for overflow retry */
const DEFAULT_TITLE_SIZE = 72;
const DEFAULT_SUBTITLE_SIZE = 30;
const TITLE_STEP = 6;
const SUBTITLE_STEP = 4;
const MAX_RETRIES = 2;

/**
 * Generate slide_01.html from template + mapping.
 * No PNG rendering — that happens in a later step.
 *
 * After initial render, measures text overflow via Playwright.
 * If title/subtitle overflows, font size is reduced and HTML
 * is re-rendered (up to 2 retries: title -6px, subtitle -4px each).
 */
export async function generateCoverHtml(config: {
  inputPath: string;
  topicPath: string;
  outDir: string;
  templatePath?: string;
  cssOverrideBlock?: string;
}): Promise<{ htmlPath: string }> {
  const { inputPath, topicPath, outDir } = config;

  // 1) Load compliance
  const { compliance, inputDir } = await loadValidatedPost(inputPath);
  if (!compliance.allowed) {
    const notes = compliance.notes?.join("; ") ?? "no details";
    throw new Error(`Post not allowed: ${notes}`);
  }

  // 2) Load topic
  const topic = await loadTopicPackage(topicPath);

  // 3) Load & validate template
  const template = await loadTemplate(config.templatePath);
  validateTemplateForCover(template);

  // 4) Build slot mapping
  const mapping = buildCoverSlotMapping({ template, compliance, topic });

  // 5) Resolve hero localPath to absolute
  const heroSlot = mapping["heroImage"];
  if (heroSlot && heroSlot.kind === "image") {
    const absPath = resolveLocalImagePath(heroSlot.localPath, inputDir);
    mapping["heroImage"] = { ...heroSlot, localPath: absPath };
  }

  await ensureDir(outDir);
  const htmlPath = resolveOutputPaths(outDir, 1).html;
  const tmpPath = path.join(outDir, "slide_01.tmp.html");

  // 6) Render + measure + retry loop
  let titleSizePx = DEFAULT_TITLE_SIZE;
  let subtitleSizePx = DEFAULT_SUBTITLE_SIZE;
  let retryAttempts = 0;
  let lastTitleOverflow = false;
  let lastSubtitleOverflow = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const html = renderCoverHtml({
      template,
      mapping,
      styleVars: { titleSizePx, subtitleSizePx },
      cssOverrideBlock: config.cssOverrideBlock,
    });
    await saveHtml(tmpPath, html);

    const overflow = await measureOverflow(tmpPath);
    lastTitleOverflow = overflow.titleOverflow;
    lastSubtitleOverflow = overflow.subtitleOverflow;

    if (!overflow.titleOverflow && !overflow.subtitleOverflow) {
      break;
    }

    retryAttempts = attempt + 1;

    if (attempt === MAX_RETRIES) {
      console.log(
        `[warn] Text overflow persists after ${MAX_RETRIES} retries ` +
          `(title=${titleSizePx}px, subtitle=${subtitleSizePx}px)`
      );
      break;
    }

    // Downscale overflowing slots
    if (overflow.titleOverflow) titleSizePx -= TITLE_STEP;
    if (overflow.subtitleOverflow) subtitleSizePx -= SUBTITLE_STEP;
  }

  // 7) Move tmp → final
  await fs.rename(tmpPath, htmlPath);
  await saveJson(path.join(outDir, "mapping.preview.json"), mapping);

  // 8) Autofix loop: safe-area + footer-zone violation correction
  const titleSlot = template.slots.find((s) => s.id === "title")!;
  const footerSlot = template.slots.find((s) => s.id === "footerCredits")!;
  const subtitleSlot = template.slots.find((s) => s.id === "subtitle");
  const defaultSubY = subtitleSlot
    ? subtitleSlot.y
    : titleSlot.y + titleSlot.height + 16;

  const AUTOFIX_MAX = 2;
  let titleTopPx = titleSlot.y;
  let subtitleTopPx = defaultSubY;
  let footerBottomPx = 1350 - footerSlot.y - footerSlot.height;
  let footerSizePx = 22;
  let hideSubtitle = false;
  let autofixAttempts = 0;

  let qa = await measureSafeAreaAndFooter(htmlPath);

  for (let fix = 0; fix < AUTOFIX_MAX && qa.violations.length > 0; fix++) {
    autofixAttempts = fix + 1;

    const vs = new Set(qa.violations);

    if (vs.has("title_outside_safe_area")) {
      titleSizePx = Math.max(titleSizePx - 4, 52);
      titleTopPx += 8;
    }
    if (vs.has("subtitle_outside_safe_area")) {
      if (fix === 1) {
        hideSubtitle = true;
      } else {
        subtitleSizePx = Math.max(subtitleSizePx - 3, 24);
        subtitleTopPx += 6;
      }
    }
    if (
      vs.has("footer_outside_safe_area") ||
      vs.has("footer_outside_footer_zone")
    ) {
      footerSizePx = Math.max(footerSizePx - 2, 18);
      footerBottomPx += 6;
    }

    const effectiveMapping = { ...mapping };
    if (hideSubtitle) delete effectiveMapping["subtitle"];

    const fixedHtml = renderCoverHtml({
      template,
      mapping: effectiveMapping,
      styleVars: { titleSizePx, subtitleSizePx, footerSizePx },
      offsetVars: { titleTopPx, subtitleTopPx, footerBottomPx },
      cssOverrideBlock: config.cssOverrideBlock,
    });
    await saveHtml(htmlPath, fixedHtml);

    qa = await measureSafeAreaAndFooter(htmlPath);
  }

  // 9) Save QA report
  const qaReport = {
    createdAt: new Date().toISOString(),
    templateId: template.templateId,
    safeArea: qa.safeArea,
    overflow: {
      title: lastTitleOverflow,
      subtitle: lastSubtitleOverflow,
    },
    attempts: {
      overflow: retryAttempts,
      autofix: autofixAttempts,
    },
    finalVars: {
      titleSizePx,
      subtitleSizePx,
      footerSizePx,
      titleTopPx,
      subtitleTopPx,
      footerBottomPx,
      hideSubtitle,
    },
    boxes: qa.boxes,
    violations: qa.violations,
  };

  await saveJson(path.join(outDir, "qa.report.json"), qaReport);

  if (qa.violations.length > 0) {
    console.log(
      `[warn] QA violations remain after ${autofixAttempts} autofix attempts: ` +
        qa.violations.join(", ")
    );
  }

  return { htmlPath };
}

// ============================================================================
// Multi-slide HTML Deck Generation (Step B1)
// ============================================================================

/** Deck-level autofix constants for fact/outro slides */
const DECK_AUTOFIX_MAX = 2;
const HEADLINE_STEP = 3;
const HEADLINE_MIN = 28;
const BODY_STEP = 4;
const BODY_MIN = 30;
const CTA_STEP = 4;
const CTA_MIN = 36;
const DECK_FOOTER_STEP = 2;
const DECK_FOOTER_MIN = 18;
const DEFAULT_DECK_FOOTER_SIZE = 22;
const DEFAULT_DECK_CTA_SIZE = 52;

function getFactDefaultSizes(templateId: string): { headlineSizePx: number; bodySizePx: number } {
  if (templateId === "body.fact.v2") return { headlineSizePx: 32, bodySizePx: 44 };
  if (templateId === "body.fact.v3") return { headlineSizePx: 24, bodySizePx: 42 };
  if (templateId === "body.fact.v4") return { headlineSizePx: 18, bodySizePx: 36 };
  return { headlineSizePx: 36, bodySizePx: 48 };
}

// ============================================================================
// Single Slide Rendering (Phase 4: per-slide interactive editing)
// ============================================================================

/**
 * Render a single slide to HTML + PNG.
 *
 * Reuses the same rendering pipeline as generateHtmlDeck() but for one slide.
 * Used by the slide-preview API for interactive editing.
 */
export async function renderSingleSlide(config: {
  slideIndex: number;
  kind: "cover" | "fact" | "summary" | "cta";
  title: string;
  bodyText: string;
  templateId: string;
  inputPath: string;
  topicPath: string;
  outDir: string;
  templatesDir?: string;
  category?: string;
  stylePresetId?: string;
  fontMood?: string;
}): Promise<{ htmlPath: string; pngPath: string }> {
  const { slideIndex, kind, title, bodyText, templateId, inputPath, topicPath, outDir } = config;
  const templatesDir = config.templatesDir ?? path.join(__dirname, "templates");

  await ensureDir(outDir);

  // Load compliance + topic + style overrides
  const { compliance, inputDir } = await loadValidatedPost(inputPath);
  if (!compliance.allowed) {
    throw new Error(`Post not allowed: ${compliance.notes?.join("; ") ?? "no details"}`);
  }
  const topic = await loadTopicPackage(topicPath);
  const presetId = (config.stylePresetId && isValidPresetId(config.stylePresetId))
    ? (config.stylePresetId as StylePresetId)
    : pickPresetByCategory(config.category ?? topic.category);
  const styleResult = await tryLoadStyleOverrides(outDir, presetId);
  const cssOverrideBlock = styleResult.cssBlock || undefined;
  const effectiveMood = (config.fontMood as FontMood | undefined)
    ?? resolveEffectiveMood(styleResult.mood, presetId);

  // Resolve output paths
  const htmlPath = resolveOutputPaths(outDir, slideIndex).html;
  const pngPath = resolveOutputPaths(outDir, slideIndex).png;
  const tmpPath = path.join(
    outDir,
    `slide_${String(slideIndex).padStart(2, "0")}.tmp.html`,
  );

  const family = mapKindToTemplateFamily(kind);

  if (family === "cover") {
    // Cover slide — use generateCoverHtml logic with specific output handling
    const coverTemplatePath = path.join(templatesDir, `${templateId}.json`);
    const template = await loadTemplate(coverTemplatePath);
    validateTemplateForCover(template);

    const mapping = buildCoverSlotMapping({ template, compliance, topic });

    // Resolve hero image path
    const heroSlot = mapping["heroImage"];
    if (heroSlot && heroSlot.kind === "image") {
      mapping["heroImage"] = { ...heroSlot, localPath: resolveLocalImagePath(heroSlot.localPath, inputDir) };
    }

    // Override title text from user edit
    mapping["title"] = { kind: "text", text: normalizeText(title) };

    let titleSizePx = DEFAULT_TITLE_SIZE;
    let subtitleSizePx = DEFAULT_SUBTITLE_SIZE;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const html = renderCoverHtml({
        template,
        mapping,
        styleVars: { titleSizePx, subtitleSizePx },
        cssOverrideBlock,
      });
      await saveHtml(tmpPath, html);

      const overflow = await measureOverflow(tmpPath);
      if (!overflow.titleOverflow && !overflow.subtitleOverflow) break;
      if (attempt === MAX_RETRIES) break;
      if (overflow.titleOverflow) titleSizePx -= TITLE_STEP;
      if (overflow.subtitleOverflow) subtitleSizePx -= SUBTITLE_STEP;
    }

    await fs.rename(tmpPath, htmlPath);
    await renderHtmlToPng(htmlPath, pngPath, effectiveMood);

    return { htmlPath, pngPath };
  }

  // Fact / Summary / Outro slides
  const templatePath = path.join(templatesDir, `${templateId}.json`);
  const template = await loadTemplate(templatePath);

  if (family === "fact") {
    validateTemplateForFact(template);
    const mapping = buildFactSlotMapping({
      template,
      compliance,
      payload: { headline: title, body: bodyText },
    });

    // Resolve heroImage localPath to absolute (for per-slide hero backgrounds)
    const factHero = mapping["heroImage"];
    if (factHero && factHero.kind === "image") {
      mapping["heroImage"] = { ...factHero, localPath: resolveLocalImagePath(factHero.localPath, inputDir) };
    }

    const defaults = getFactDefaultSizes(templateId);
    let headlineSizePx = defaults.headlineSizePx;
    let bodySizePx = defaults.bodySizePx;
    let footerSizePx = DEFAULT_DECK_FOOTER_SIZE;

    for (let pass = 0; pass <= DECK_AUTOFIX_MAX; pass++) {
      const html = renderFactHtml({
        template,
        mapping,
        styleVars: { headlineSizePx, bodySizePx, footerSizePx },
        slideIndex,
        cssOverrideBlock,
      });
      await saveHtml(tmpPath, html);

      const qa = await measureSlideQa(tmpPath);
      const violations = qa.safeAreaAndFooter.violations;
      const overflow = qa.overflow;
      const hasIssues =
        violations.length > 0 ||
        overflow.headline === true ||
        overflow.body === true;

      if (!hasIssues || pass === DECK_AUTOFIX_MAX) break;

      if (overflow.headline || violations.some((v: string) => v.includes("headline"))) {
        headlineSizePx = Math.max(headlineSizePx - HEADLINE_STEP, HEADLINE_MIN);
      }
      if (overflow.body || violations.some((v: string) => v.includes("body"))) {
        bodySizePx = Math.max(bodySizePx - BODY_STEP, BODY_MIN);
      }
      if (violations.some((v: string) => v.includes("footer"))) {
        footerSizePx = Math.max(footerSizePx - DECK_FOOTER_STEP, DECK_FOOTER_MIN);
      }
    }

    await fs.rename(tmpPath, htmlPath);
    await renderHtmlToPng(htmlPath, pngPath, effectiveMood);

    return { htmlPath, pngPath };
  }

  // Outro (CTA)
  validateTemplateForOutro(template);
  const mapping = buildOutroSlotMapping({
    template,
    compliance,
    payload: { cta: bodyText || title },
  });

  // Resolve heroImage localPath to absolute (for per-slide hero backgrounds)
  const outroHero = mapping["heroImage"];
  if (outroHero && outroHero.kind === "image") {
    mapping["heroImage"] = { ...outroHero, localPath: resolveLocalImagePath(outroHero.localPath, inputDir) };
  }

  let ctaSizePx = DEFAULT_DECK_CTA_SIZE;
  let footerSizePx = DEFAULT_DECK_FOOTER_SIZE;

  for (let pass = 0; pass <= DECK_AUTOFIX_MAX; pass++) {
    const html = renderOutroHtml({
      template,
      mapping,
      styleVars: { ctaSizePx, footerSizePx },
      cssOverrideBlock,
    });
    await saveHtml(tmpPath, html);

    const qa = await measureSlideQa(tmpPath);
    const violations = qa.safeAreaAndFooter.violations;
    const overflow = qa.overflow;
    const hasIssues = violations.length > 0 || overflow.cta === true;

    if (!hasIssues || pass === DECK_AUTOFIX_MAX) break;

    if (overflow.cta) {
      ctaSizePx = Math.max(ctaSizePx - CTA_STEP, CTA_MIN);
    }
    if (violations.some((v: string) => v.includes("footer"))) {
      footerSizePx = Math.max(footerSizePx - DECK_FOOTER_STEP, DECK_FOOTER_MIN);
    }
  }

  await fs.rename(tmpPath, htmlPath);
  await renderHtmlToPng(htmlPath, pngPath, effectiveMood);

  return { htmlPath, pngPath };
}

/**
 * Generate a full HTML deck (cover + fact slides + outro) from inputs.
 *
 * - Cover slide: delegates to generateCoverHtml (includes QA/autofix).
 * - Fact slides: one per keyFact (up to 4), rendered via renderFactHtml.
 * - Outro slide: CTA, rendered via renderOutroHtml.
 *
 * All slides include footerCredits (attribution enforced).
 * PNG rendering / finalize happen in subsequent steps.
 */
export async function generateHtmlDeck(config: {
  inputPath: string;
  topicPath: string;
  outDir: string;
  templatesDir?: string;
  seed?: string;
  stylePresetId?: string;
  postType?: string;
  musicOptions?: MusicSlidePlanOptions;
}): Promise<{ slideCount: number; htmlPaths: string[]; reportPath: string; mood: FontMood }> {
  const { inputPath, topicPath, outDir } = config;

  // 1) Load compliance
  const { compliance, inputDir } = await loadValidatedPost(inputPath);
  if (!compliance.allowed) {
    const notes = compliance.notes?.join("; ") ?? "no details";
    throw new Error(`Post not allowed: ${notes}`);
  }

  // 2) Load topic
  const topic = await loadTopicPackage(topicPath);

  // 3) Build slide plan — LLM plan (if present) > music PostType > general
  const llmPlan = await tryLoadLLMPlan(outDir);
  let plan: SlidePlan[];

  if (llmPlan) {
    console.log(`[deck] Using LLM slide plan (${llmPlan.totalSlides} slides, model: ${llmPlan.model})`);
    plan = llmPlanToSlidePlans(llmPlan, topic.category);
  } else if (config.postType && MUSIC_POST_TYPES.has(config.postType)) {
    plan = buildMusicSlidePlan(
      config.postType as Parameters<typeof buildMusicSlidePlan>[0],
      topic,
      config.musicOptions,
    );
  } else {
    plan = buildSlidePlan(topic, {
      seed: config.seed,
      stylePresetId: isValidPresetId(config.stylePresetId ?? "")
        ? (config.stylePresetId as StylePresetId)
        : undefined,
    });
  }

  // 4) Load style overrides (if style-profile.json exists, otherwise use preset palette)
  const deckPresetId = isValidPresetId(config.stylePresetId ?? "")
    ? (config.stylePresetId as StylePresetId)
    : pickPresetByCategory(topic.category);
  const styleResult = await tryLoadStyleOverrides(outDir, deckPresetId);
  const cssOverrideBlock = styleResult.cssBlock || undefined;

  // 4b) Resolve effective font mood
  const deckMood = resolveEffectiveMood(styleResult.mood, deckPresetId);

  // 5) Resolve templates directory
  const templatesDir = config.templatesDir ?? path.join(__dirname, "templates");

  await ensureDir(outDir);

  const htmlPaths: string[] = [];

  // Track per-slide autofix data for the deck QA report
  const autofixRecords: Array<{
    index: number;
    kind: string;
    attempts: number;
    finalVars: Record<string, number>;
  }> = [];

  for (const slide of plan) {
    if (slide.kind === "cover") {
      const isMusic = slide.templateId.startsWith("music.");

      if (!isMusic) {
        // 5a) Standard cover — delegate to generateCoverHtml (includes its own autofix)
        const coverTemplatePath = path.join(
          templatesDir,
          `${slide.templateId}.json`
        );
        const { htmlPath } = await generateCoverHtml({
          inputPath,
          topicPath,
          outDir,
          templatePath: coverTemplatePath,
          cssOverrideBlock,
        });
        htmlPaths.push(htmlPath);
        autofixRecords.push({ index: slide.index, kind: "cover", attempts: 0, finalVars: {} });
        continue;
      }

      // 5a-music) Music cover/meme/grid/concert — use music mapping + renderer
      const musicTemplatePath = path.join(templatesDir, `${slide.templateId}.json`);
      const template = await loadTemplate(musicTemplatePath);
      const htmlPath = resolveOutputPaths(outDir, slide.index).html;
      const payload = (slide.payload ?? {}) as Record<string, unknown>;

      let mapping;
      const fam = template.family;
      if (fam === "music.album") {
        validateTemplateForAlbumCover(template);
        mapping = buildAlbumCoverSlotMapping({ template, compliance, topic, payload: payload as { artist?: string; releaseDate?: string } });
      } else if (fam.startsWith("music.meme")) {
        mapping = buildMemeSlotMapping({ template, compliance, payload: { memeText: (payload.memeText as string) ?? "" } });
      } else if (fam === "music.grid") {
        mapping = buildGridSlotMapping({ template, compliance, payload: { title: topic.title, albumPaths: payload.albumPaths as string[] | undefined } });
      } else if (fam === "music.concert") {
        mapping = buildConcertSlotMapping({
          template, compliance,
          payload: {
            venue: (payload.venue as string) ?? "",
            date: (payload.date as string) ?? "",
            lineup: payload.lineup as string[] | undefined,
          },
        });
      } else {
        throw new Error(`Unknown music template family "${fam}" for cover slide`);
      }

      // Resolve hero image path to absolute
      for (const [slotId, val] of Object.entries(mapping)) {
        if (val.kind === "image" && val.localPath) {
          const { inputDir } = await loadValidatedPost(inputPath);
          mapping[slotId] = { ...val, localPath: resolveLocalImagePath(val.localPath, inputDir) };
        }
      }

      const musicHtml = tryRenderMusicHtml(template, mapping);
      if (!musicHtml) {
        throw new Error(`tryRenderMusicHtml returned null for family "${fam}"`);
      }
      await saveHtml(htmlPath, musicHtml);
      htmlPaths.push(htmlPath);
      autofixRecords.push({ index: slide.index, kind: fam, attempts: 0, finalVars: {} });
      continue;
    }

    // 5b) Load template for fact/outro
    const templatePath = path.join(templatesDir, `${slide.templateId}.json`);
    const template = await loadTemplate(templatePath);
    const htmlPath = resolveOutputPaths(outDir, slide.index).html;
    const tmpPath = path.join(
      outDir,
      `slide_${String(slide.index).padStart(2, "0")}.tmp.html`
    );

    if (slide.kind === "fact") {
      // Music fact templates (e.g. music.album.detail.v1) — use music renderer
      if (slide.templateId.startsWith("music.")) {
        const credits = resolveCredits(compliance, pickHeroAsset(compliance.images) ?? compliance.images[0]!);
        const mapping: Record<string, import("./mapping.js").SlotValue> = {
          headline: { kind: "text", text: normalizeText(topic.title) },
          tracklist: { kind: "text", text: normalizeText(topic.keyFacts?.join("\n") ?? "") },
          footerCredits: { kind: "text", text: normalizeText(credits.footerCredits) },
        };
        const musicHtml = tryRenderMusicHtml(template, mapping);
        if (!musicHtml) {
          throw new Error(`tryRenderMusicHtml returned null for template "${template.templateId}"`);
        }
        await saveHtml(htmlPath, musicHtml);
        htmlPaths.push(htmlPath);
        autofixRecords.push({ index: slide.index, kind: template.family, attempts: 0, finalVars: {} });
        continue;
      }

      validateTemplateForFact(template);
      const factPayload = slide.payload as { headline: string; body: string; variationId?: string };
      const mapping = buildFactSlotMapping({ template, compliance, payload: factPayload, slideIndex: slide.index - 1 });

      // Resolve heroImage localPath to absolute (for per-slide hero backgrounds)
      const factHeroSlot = mapping["heroImage"];
      if (factHeroSlot && factHeroSlot.kind === "image") {
        mapping["heroImage"] = { ...factHeroSlot, localPath: resolveLocalImagePath(factHeroSlot.localPath, inputDir) };
      }

      // Initial font sizes (match template-variation defaults in renderer)
      const defaults = getFactDefaultSizes(slide.templateId);
      let headlineSizePx = defaults.headlineSizePx;
      let bodySizePx = defaults.bodySizePx;
      let footerSizePx = DEFAULT_DECK_FOOTER_SIZE;
      let autofixAttempts = 0;

      for (let pass = 0; pass <= DECK_AUTOFIX_MAX; pass++) {
        const html = renderFactHtml({
          template,
          mapping,
          styleVars: { headlineSizePx, bodySizePx, footerSizePx },
          slideIndex: slide.index,
          cssOverrideBlock,
        });
        await saveHtml(tmpPath, html);

        const qa = await measureSlideQa(tmpPath);
        const violations = qa.safeAreaAndFooter.violations;
        const overflow = qa.overflow;
        const hasIssues =
          violations.length > 0 ||
          overflow.headline === true ||
          overflow.body === true;

        if (!hasIssues || pass === DECK_AUTOFIX_MAX) {
          autofixAttempts = pass;
          break;
        }

        // Rule-based adjustments
        if (overflow.headline || violations.some(v => v.includes("headline"))) {
          headlineSizePx = Math.max(headlineSizePx - HEADLINE_STEP, HEADLINE_MIN);
        }
        if (overflow.body || violations.some(v => v.includes("body"))) {
          bodySizePx = Math.max(bodySizePx - BODY_STEP, BODY_MIN);
        }
        if (violations.some(v => v.includes("footer"))) {
          footerSizePx = Math.max(footerSizePx - DECK_FOOTER_STEP, DECK_FOOTER_MIN);
        }
      }

      await fs.rename(tmpPath, htmlPath);
      htmlPaths.push(htmlPath);
      autofixRecords.push({
        index: slide.index,
        kind: "fact",
        attempts: autofixAttempts,
        finalVars: { headlineSizePx, bodySizePx, footerSizePx },
      });
    } else {
      // outro
      validateTemplateForOutro(template);
      const mapping = buildOutroSlotMapping({
        template,
        compliance,
        payload: slide.payload as { cta: string },
        slideIndex: slide.index - 1,
      });

      // Resolve heroImage localPath to absolute (for per-slide hero backgrounds)
      const outroHeroSlot = mapping["heroImage"];
      if (outroHeroSlot && outroHeroSlot.kind === "image") {
        mapping["heroImage"] = { ...outroHeroSlot, localPath: resolveLocalImagePath(outroHeroSlot.localPath, inputDir) };
      }

      let ctaSizePx = DEFAULT_DECK_CTA_SIZE;
      let footerSizePx = DEFAULT_DECK_FOOTER_SIZE;
      let autofixAttempts = 0;

      for (let pass = 0; pass <= DECK_AUTOFIX_MAX; pass++) {
        const html = renderOutroHtml({
          template,
          mapping,
          styleVars: { ctaSizePx, footerSizePx },
          cssOverrideBlock,
        });
        await saveHtml(tmpPath, html);

        const qa = await measureSlideQa(tmpPath);
        const violations = qa.safeAreaAndFooter.violations;
        const overflow = qa.overflow;
        const hasIssues =
          violations.length > 0 ||
          overflow.cta === true;

        if (!hasIssues || pass === DECK_AUTOFIX_MAX) {
          autofixAttempts = pass;
          break;
        }

        if (overflow.cta) {
          ctaSizePx = Math.max(ctaSizePx - CTA_STEP, CTA_MIN);
        }
        if (violations.some(v => v.includes("footer"))) {
          footerSizePx = Math.max(footerSizePx - DECK_FOOTER_STEP, DECK_FOOTER_MIN);
        }
      }

      await fs.rename(tmpPath, htmlPath);
      htmlPaths.push(htmlPath);
      autofixRecords.push({
        index: slide.index,
        kind: "outro",
        attempts: autofixAttempts,
        finalVars: { ctaSizePx, footerSizePx },
      });
    }
  }

  // ---- Final QA measurement on all slides → qa.deck.report.json ----
  const slideReports: Array<{
    index: number;
    file: string;
    kind: string;
    attempts: number;
    finalVars: Record<string, number>;
    safeAreaAndFooter: { safeArea: Record<string, number>; boxes: Record<string, unknown>; violations: string[] };
    overflow: SlideOverflow;
  }> = [];

  for (const hp of htmlPaths) {
    const filename = path.basename(hp);
    const match = /^slide_(\d\d)\.html$/.exec(filename);
    const idx = match?.[1] ? parseInt(match[1], 10) : 0;
    const qa = await measureSlideQa(hp);
    const record = autofixRecords.find(r => r.index === idx);

    slideReports.push({
      index: idx,
      file: filename,
      kind: record?.kind ?? "unknown",
      attempts: record?.attempts ?? 0,
      finalVars: record?.finalVars ?? {},
      safeAreaAndFooter: qa.safeAreaAndFooter,
      overflow: qa.overflow,
    });
  }

  let totalViolations = 0;
  let slidesWithViolations = 0;
  let overflowCount = 0;

  for (const s of slideReports) {
    const v = s.safeAreaAndFooter.violations.length;
    totalViolations += v;
    if (v > 0) slidesWithViolations++;
    for (const val of Object.values(s.overflow) as boolean[]) {
      if (val === true) overflowCount++;
    }
  }

  const deckReport = {
    createdAt: new Date().toISOString(),
    slideCount: htmlPaths.length,
    summary: { totalViolations, slidesWithViolations, overflowCount },
    slides: slideReports,
  };

  const reportPath = path.join(outDir, "qa.deck.report.json");
  await saveJson(reportPath, deckReport);

  return { slideCount: plan.length, htmlPaths, reportPath, mood: deckMood };
}

// ============================================================================
// PNG Rendering (Step 4)
// ============================================================================

/**
 * Render slide_01.html → slide_01.png via Playwright.
 * Assumes slide_01.html already exists in outDir (run --mode html first).
 *
 * Fails if:
 *   - slide_01.html not found in outDir
 *   - Playwright browser not installed
 */
export async function renderCoverPng(config: {
  outDir: string;
  mood?: FontMood;
}): Promise<{ pngPath: string }> {
  const { outDir } = config;
  const paths = resolveOutputPaths(outDir, 1);

  // Guard: HTML must exist
  try {
    await fs.access(paths.html);
  } catch {
    throw new Error(
      `slide_01.html not found at ${paths.html}.\n` +
        `Run --mode html first to generate it.`
    );
  }

  await renderHtmlToPng(paths.html, paths.png, config.mood);

  return { pngPath: paths.png };
}

// ============================================================================
// Multi-slide PNG Rendering (Step B2)
// ============================================================================

/**
 * Render all slide_XX.html files in outDir to slide_XX.png.
 * Sequential rendering (one browser at a time) for stability.
 *
 * Fails if no slide HTML files are found.
 */
export async function renderDeckPng(config: {
  outDir: string;
  mood?: FontMood;
}): Promise<{ count: number; pngPaths: string[] }> {
  const { outDir } = config;

  const htmlPaths = listSlideHtml(outDir);
  if (htmlPaths.length === 0) {
    throw new Error(
      "no slide_XX.html found (run --mode deck-html)"
    );
  }

  const pngPaths: string[] = [];

  for (const htmlPath of htmlPaths) {
    const pngPath = htmlPath.replace(/\.html$/, ".png");
    await renderHtmlToPng(htmlPath, pngPath, config.mood);
    pngPaths.push(pngPath);
  }

  return { count: pngPaths.length, pngPaths };
}

// ============================================================================
// Deck Finalize: caption.txt + layout_manifest.json (Step B3)
// ============================================================================

/**
 * Finalize a multi-slide deck: generate caption.txt + layout_manifest.json.
 * Assumes slide_XX.html and slide_XX.png already exist in outDir.
 * Does NOT re-generate HTML or PNG.
 */
export async function finalizeDeck(config: {
  inputPath: string;
  topicPath: string;
  outDir: string;
  seed?: string;
  stylePresetId?: string;
}): Promise<{ captionPath: string; manifestPath: string; slideCount: number }> {
  const { inputPath, topicPath, outDir } = config;

  // 1) Load compliance
  const { compliance } = await loadValidatedPost(inputPath);
  if (!compliance.allowed) {
    const notes = compliance.notes?.join("; ") ?? "no details";
    throw new Error(`Post not allowed: ${notes}`);
  }

  // 2) Load topic
  const topic = await loadTopicPackage(topicPath);

  // 3) List slide pairs (validates png existence)
  const slides = listSlidePairs(outDir);
  if (slides.length === 0) {
    throw new Error("no slide_XX.html found (run --mode deck-html)");
  }

  // 4) Resolve hero + credits
  const hero = pickHeroAsset(compliance.images);
  if (!hero) {
    throw new Error("No suitable hero asset found");
  }
  const credits = resolveCredits(compliance, hero);

  // 5) Build and save caption.txt
  const caption = buildDeckCaption({
    topic,
    captionAppendix: credits.captionAppendix,
  });
  await ensureDir(outDir);
  const capPath = path.join(outDir, "caption.txt");
  await fs.writeFile(capPath, caption, "utf-8");

  // 6) Build slide kind inference + plan text
  const plan = buildSlidePlan(topic, {
    seed: config.seed,
    stylePresetId: isValidPresetId(config.stylePresetId ?? "")
      ? (config.stylePresetId as StylePresetId)
      : undefined,
  });
  const lastIndex = slides[slides.length - 1]!.index;

  const manifestSlides = slides.map((s) => {
    // kind inference
    let kind: "cover" | "fact" | "outro" | "unknown" = "unknown";
    if (s.index === 1) kind = "cover";
    else if (s.index === lastIndex) kind = "outro";
    else kind = "fact";

    // text from plan (if available)
    const planEntry = plan.find((p) => p.index === s.index);
    let text: Record<string, string> | undefined;
    if (planEntry) {
      if (planEntry.kind === "fact") {
        const p = planEntry.payload as { headline?: string; body?: string };
        text = { headline: p.headline ?? "", body: p.body ?? "" };
      } else if (planEntry.kind === "outro") {
        const p = planEntry.payload as { cta?: string };
        text = { cta: p.cta ?? "" };
      }
    }

    // variationId from plan payload
    let variationId: string | undefined;
    if (planEntry) {
      if (planEntry.kind === "cover") {
        variationId = (planEntry.payload as { coverVariationId?: string }).coverVariationId ?? "v1";
      } else if (planEntry.kind === "fact") {
        variationId = (planEntry.payload as { variationId?: string }).variationId ?? "v1";
      } else if (planEntry.kind === "outro") {
        variationId = "v1";
      }
    }

    return {
      index: s.index,
      kind,
      templateId: planEntry?.templateId,
      variationId,
      outputs: {
        html: path.basename(s.htmlPath),
        png: path.basename(s.pngPath),
      },
      usedAssets: [
        {
          assetId: hero.assetId,
          role: hero.role,
          localPath: hero.localPath,
          sourceUrl: hero.sourceUrl,
        },
      ],
      ...(text ? { text } : {}),
    };
  });

  // 7) Resolve presetId from first slide's payload (all slides share the same preset)
  const resolvedPresetId =
    (plan[0]?.payload as { presetId?: string } | undefined)?.presetId ?? "default";

  // 8) Save layout_manifest.json
  const manifest = {
    postId: path.basename(outDir),
    createdAt: new Date().toISOString(),
    stylePresetId: resolvedPresetId,
    outputs: { caption: "caption.txt" },
    deck: {
      slideCount: slides.length,
      size: { width: 1080, height: 1350 },
    },
    credits: {
      footerLines: credits.footerLines,
      captionAppendix: credits.captionAppendix,
    },
    slides: manifestSlides,
  };

  const manPath = path.join(outDir, "layout_manifest.json");
  await saveJson(manPath, manifest);

  return {
    captionPath: capPath,
    manifestPath: manPath,
    slideCount: slides.length,
  };
}

// ============================================================================
// Deck QA: measure all slides and produce qa.deck.report.json (Step B5)
// ============================================================================

/**
 * Run QA measurement (safe-area/footer + text overflow) on every slide
 * in outDir and save a combined report to qa.deck.report.json.
 *
 * Requires slide_XX.html files to exist (run --mode deck-html first).
 * Sequential measurement (one browser at a time) for stability.
 */
export async function qaDeck(config: {
  outDir: string;
}): Promise<{ count: number; reportPath: string }> {
  const { outDir } = config;

  const htmlPaths = listSlideHtml(outDir);
  if (htmlPaths.length === 0) {
    throw new Error("no slide_XX.html found (run --mode deck-html)");
  }

  const slideResults: Array<{
    index: number;
    file: string;
    safeAreaAndFooter: { safeArea: Record<string, number>; boxes: Record<string, unknown>; violations: string[] };
    overflow: SlideOverflow;
  }> = [];

  for (const htmlPath of htmlPaths) {
    const result = await measureSlideQa(htmlPath);
    const filename = path.basename(htmlPath);
    const match = /^slide_(\d\d)\.html$/.exec(filename);
    const index = match?.[1] ? parseInt(match[1], 10) : 0;

    slideResults.push({
      index,
      file: filename,
      safeAreaAndFooter: result.safeAreaAndFooter,
      overflow: result.overflow,
    });
  }

  // Build summary
  let totalViolations = 0;
  let slidesWithViolations = 0;
  let overflowCount = 0;

  for (const s of slideResults) {
    const v = s.safeAreaAndFooter.violations.length;
    totalViolations += v;
    if (v > 0) slidesWithViolations++;

    for (const val of Object.values(s.overflow) as boolean[]) {
      if (val === true) overflowCount++;
    }
  }

  const report = {
    createdAt: new Date().toISOString(),
    slideCount: slideResults.length,
    summary: {
      totalViolations,
      slidesWithViolations,
      overflowCount,
    },
    slides: slideResults,
  };

  const reportPath = path.join(outDir, "qa.deck.report.json");
  await saveJson(reportPath, report);

  return { count: slideResults.length, reportPath };
}

// ============================================================================
// Finalize: caption.txt + layout_manifest.json (Step 5 — single slide)
// ============================================================================

/**
 * Generate caption.txt and layout_manifest.json for a single-slide post.
 * Assumes slide_01.html and slide_01.png already exist in outDir.
 *
 * Does NOT re-generate HTML or re-render PNG.
 *
 * Fails if:
 *   - allowed === false
 *   - slide_01.html not found
 *   - slide_01.png not found
 */
export async function finalizeOneSlide(config: {
  inputPath: string;
  topicPath: string;
  outDir: string;
  templatePath?: string;
}): Promise<{ captionPath: string; manifestPath: string }> {
  const { inputPath, topicPath, outDir } = config;

  // 1) Load compliance
  const { compliance } = await loadValidatedPost(inputPath);
  if (!compliance.allowed) {
    const notes = compliance.notes?.join("; ") ?? "no details";
    throw new Error(`Post not allowed: ${notes}`);
  }

  // 2) Load topic
  const topic = await loadTopicPackage(topicPath);

  // 3) Load & validate template
  const template = await loadTemplate(config.templatePath);
  validateTemplateForCover(template);

  // 4) Build slot mapping
  const mapping = buildCoverSlotMapping({ template, compliance, topic });

  // 5) Extract usedAsset from mapping.heroImage
  const heroSlot = mapping["heroImage"];
  if (!heroSlot || heroSlot.kind !== "image") {
    throw new Error("heroImage slot missing or not an image in mapping");
  }

  // 6) Find the actual asset from compliance.images to call resolveCredits
  const usedAsset = compliance.images.find(
    (img) => img.assetId === heroSlot.assetId
  );
  if (!usedAsset) {
    throw new Error(
      `Asset "${heroSlot.assetId}" from mapping not found in compliance.images`
    );
  }
  const credits = resolveCredits(compliance, usedAsset);

  // 7) Build and save caption.txt
  const caption = buildCaption({
    topic,
    captionAppendix: credits.captionAppendix,
  });
  await ensureDir(outDir);
  const capPath = path.join(outDir, "caption.txt");
  await fs.writeFile(capPath, caption, "utf-8");

  // 8) Check html/png existence
  const paths = resolveOutputPaths(outDir, 1);
  try {
    await fs.access(paths.html);
  } catch {
    throw new Error(
      "slide_01.html not found (run --mode html)"
    );
  }
  try {
    await fs.access(paths.png);
  } catch {
    throw new Error(
      "slide_01.png not found (run --mode png)"
    );
  }

  // 9) Build and save layout_manifest.json
  const manifest = {
    postId: path.basename(outDir),
    createdAt: new Date().toISOString(),
    templateId: template.templateId,
    outputs: {
      html: slideHtmlName(1),
      png: slidePngName(1),
      caption: "caption.txt",
    },
    slides: [
      {
        index: 1,
        templateId: template.templateId,
        usedAssets: [
          {
            assetId: heroSlot.assetId,
            role: heroSlot.role,
            localPath: heroSlot.localPath,
            sourceUrl: heroSlot.sourceUrl,
          },
        ],
        credits: {
          footerCredits: credits.footerCredits,
          footerLines: credits.footerLines,
          captionAppendix: credits.captionAppendix,
        },
      },
    ],
  };
  const manPath = path.join(outDir, "layout_manifest.json");
  await saveJson(manPath, manifest);

  return { captionPath: capPath, manifestPath: manPath };
}

// ============================================================================
// Full Composition (render pipeline, future use)
// ============================================================================

export interface ComposeOptions {
  inputPath: string;
  topicPath: string;
  outDir: string;
  templatePath?: string;
  postType?: string;
  humanInputPath?: string;
}

/**
 * Load humanInput from a JSON file (written by the pipeline).
 */
async function loadHumanInput(filePath: string): Promise<MusicSlidePlanOptions> {
  try {
    const raw = JSON.parse(await fs.readFile(path.resolve(filePath), "utf-8")) as Record<string, unknown>;
    return {
      memeText: typeof raw.memeText === "string" ? raw.memeText : undefined,
      memePosition: typeof raw.memePosition === "string" ? raw.memePosition as "top" | "center" | "bottom" : undefined,
      albums: Array.isArray(raw.selectedAlbums) ? (raw.selectedAlbums as Array<{ title: string; artist: string }>) : undefined,
      concertVenue: typeof raw.concertVenue === "string" ? raw.concertVenue : undefined,
      concertDate: typeof raw.concertDate === "string" ? raw.concertDate : undefined,
      concertLineup: Array.isArray(raw.concertLineup) ? raw.concertLineup as string[] : undefined,
      playlistTitle: typeof raw.playlistTitle === "string" ? raw.playlistTitle : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Compose a card-news post from Agent1 output + topic.
 *
 * For music PostTypes: uses deck flow (generateHtmlDeck → renderDeckPng → finalizeDeck).
 * For general_cardnews: single cover slide (backward compat).
 */
export async function compose(
  options: ComposeOptions
): Promise<CompositionResult> {
  const { inputPath, topicPath, outDir } = options;

  // ---- Music PostTypes: use deck flow ----
  if (options.postType && MUSIC_POST_TYPES.has(options.postType)) {
    const musicOptions = options.humanInputPath
      ? await loadHumanInput(options.humanInputPath)
      : {};

    console.log(`[compose] Music PostType "${options.postType}" → deck flow`);

    await generateHtmlDeck({
      inputPath,
      topicPath,
      outDir,
      postType: options.postType,
      musicOptions,
    });

    const { pngPaths } = await renderDeckPng({ outDir, mood: "bold-display" });

    const { captionPath, manifestPath } = await finalizeDeck({
      inputPath,
      topicPath,
      outDir,
    });

    // Build a CompositionResult compatible with the single-slide return type
    const slides: RenderedSlide[] = pngPaths.map((pngPath, i) => ({
      slideIndex: i + 1,
      htmlPath: pngPath.replace(/\.png$/, ".html"),
      pngPath,
    }));

    const captionText = await fs.readFile(captionPath, "utf-8");
    const manifestRaw = JSON.parse(await fs.readFile(manifestPath, "utf-8"));

    return {
      postId: `music-${options.postType}`,
      slides,
      captionText,
      layoutManifest: manifestRaw as LayoutManifest,
    };
  }

  // ---- Load & validate inputs ----
  const { compliance, inputDir } = await loadValidatedPost(inputPath);

  if (!compliance.allowed) {
    const notes = compliance.notes?.join("; ") ?? "no details";
    throw new Error(`Post not allowed: ${notes}`);
  }

  const topic = await loadTopic(topicPath);
  const template = await loadTemplate(options.templatePath);

  await ensureDir(outDir);

  // ---- Pick hero asset ----
  const hero = pickHeroAsset(compliance.images);
  if (!hero) throw new Error("No suitable hero asset found");

  // ---- Resolve credits ----
  const credits = resolveCredits(compliance, hero);

  // ---- Resolve hero image path to file:// URL ----
  const heroAbsPath = resolveLocalImagePath(hero.localPath, inputDir);
  const heroSrc = pathToFileURL(heroAbsPath).href;

  const bindings: SlideBindings = {
    templateId: template.templateId,
    bindings: {
      heroImage: { type: "image", src: heroSrc, alt: topic.title },
      title: { type: "text", content: topic.title },
      footerCredits: { type: "text", content: credits.footerCredits },
    },
  };

  // ---- Attribution guard: structurally prevent omission ----
  for (const slot of template.slots) {
    if (slot.attributionRequired) {
      const b = bindings.bindings[slot.id];
      if (!b || (b.type === "text" && !b.content)) {
        throw new Error(
          `Attribution slot "${slot.id}" is required but has no content. ` +
            `Cannot render without proper attribution.`
        );
      }
    }
  }

  // ---- Generate HTML ----
  const slideIndex = 1;
  const paths = resolveOutputPaths(outDir, slideIndex);
  const html = buildSlideHtml(template, bindings);
  await saveHtml(paths.html, html);

  // ---- Render to PNG ----
  await renderHtmlToPng(paths.html, paths.png);

  const slide: RenderedSlide = {
    slideIndex,
    htmlPath: paths.html,
    pngPath: paths.png,
  };

  // ---- Caption ----
  const captionText = buildCaptionText(topic, credits.captionAppendix);
  await saveCaption(outDir, captionText);

  // ---- Manifest ----
  const manifest: LayoutManifest = {
    postId: hero.assetId,
    templateId: template.templateId,
    slidesCount: 1,
    slides: [
      {
        index: slideIndex,
        htmlFile: slideHtmlName(slideIndex),
        pngFile: slidePngName(slideIndex),
        template: template.templateId,
      },
    ],
    attribution: {
      footerRendered: true,
      captionAppendix: credits.captionAppendix,
    },
    generatedAt: new Date().toISOString(),
  };
  await saveManifest(outDir, manifest);

  return {
    postId: hero.assetId,
    slides: [slide],
    captionText,
    layoutManifest: manifest,
  };
}
