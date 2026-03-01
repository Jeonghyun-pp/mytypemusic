import type { TemplateSpec, TopicPackage } from "./types.js";
import type { ValidatedPostSubset } from "./validated-post.schema.js";
import { pickHeroAsset, pickHeroAssetByIndex, resolveCredits } from "./credits.js";
import { normalizeText } from "./text-fit.js";

// ============================================================================
// Types
// ============================================================================

/** A resolved slot value — either an image reference or a text string */
export type SlotValue =
  | {
      kind: "image";
      assetId: string;
      localPath: string;
      sourceUrl: string;
      role: string;
    }
  | { kind: "text"; text: string };

/** Mapping from slot id → resolved value */
export type SlotMapping = Record<string, SlotValue>;

// ============================================================================
// Template Validation
// ============================================================================

/** Required slots for a "cover" template and their expected types */
const COVER_REQUIRED_SLOTS: ReadonlyArray<{
  id: string;
  type: "image" | "text";
}> = [
  { id: "heroImage", type: "image" },
  { id: "title", type: "text" },
  { id: "footerCredits", type: "text" },
];

/**
 * Validate that a template is suitable for the "cover" family.
 *
 * Checks:
 *   - family === "cover"
 *   - Required slots exist: heroImage (image), title (text), footerCredits (text)
 *   - subtitle slot is optional
 *
 * Throws on any violation.
 */
export function validateTemplateForCover(template: TemplateSpec): void {
  if (template.family !== "cover") {
    throw new Error(
      `Template family must be "cover", got "${template.family}"`
    );
  }

  for (const req of COVER_REQUIRED_SLOTS) {
    const slot = template.slots.find((s) => s.id === req.id);
    if (!slot) {
      throw new Error(
        `Required slot "${req.id}" not found in template "${template.templateId}"`
      );
    }
    if (slot.type !== req.type) {
      throw new Error(
        `Slot "${req.id}" must be type "${req.type}", got "${slot.type}" ` +
          `in template "${template.templateId}"`
      );
    }
  }
}

// ============================================================================
// Template Validation — body (fact)
// ============================================================================

const FACT_REQUIRED_SLOTS: ReadonlyArray<{
  id: string;
  type: "image" | "text";
}> = [
  { id: "headline", type: "text" },
  { id: "body", type: "text" },
  { id: "footerCredits", type: "text" },
];

/**
 * Validate that a template is suitable for the "body" (fact) family.
 * Checks: family === "body", required slots (headline, body, footerCredits).
 */
export function validateTemplateForFact(template: TemplateSpec): void {
  if (template.family !== "body") {
    throw new Error(
      `Template family must be "body", got "${template.family}"`
    );
  }
  for (const req of FACT_REQUIRED_SLOTS) {
    const slot = template.slots.find((s) => s.id === req.id);
    if (!slot) {
      throw new Error(
        `Required slot "${req.id}" not found in template "${template.templateId}"`
      );
    }
    if (slot.type !== req.type) {
      throw new Error(
        `Slot "${req.id}" must be type "${req.type}", got "${slot.type}" ` +
          `in template "${template.templateId}"`
      );
    }
  }
}

// ============================================================================
// Template Validation — end (outro)
// ============================================================================

const OUTRO_REQUIRED_SLOTS: ReadonlyArray<{
  id: string;
  type: "image" | "text";
}> = [
  { id: "cta", type: "text" },
  { id: "footerCredits", type: "text" },
];

/**
 * Validate that a template is suitable for the "end" (outro) family.
 * Checks: family === "end", required slots (cta, footerCredits).
 */
export function validateTemplateForOutro(template: TemplateSpec): void {
  if (template.family !== "end") {
    throw new Error(
      `Template family must be "end", got "${template.family}"`
    );
  }
  for (const req of OUTRO_REQUIRED_SLOTS) {
    const slot = template.slots.find((s) => s.id === req.id);
    if (!slot) {
      throw new Error(
        `Required slot "${req.id}" not found in template "${template.templateId}"`
      );
    }
    if (slot.type !== req.type) {
      throw new Error(
        `Slot "${req.id}" must be type "${req.type}", got "${slot.type}" ` +
          `in template "${template.templateId}"`
      );
    }
  }
}

// ============================================================================
// Slot Mapping Builder — Cover
// ============================================================================

/**
 * Build the slot mapping for a cover slide.
 *
 * Resolves:
 *   - heroImage  ← picked hero asset (localPath, assetId, sourceUrl, role)
 *   - title      ← topic.title
 *   - subtitle   ← topic.subtitle (only if template has a "subtitle" slot)
 *   - footerCredits ← resolveCredits().footerCredits (enforced)
 */
export function buildCoverSlotMapping(params: {
  template: TemplateSpec;
  compliance: ValidatedPostSubset;
  topic: TopicPackage;
  slideIndex?: number;
}): SlotMapping {
  const { template, compliance, topic } = params;

  // Pick hero asset (per-slide when slideIndex is provided)
  const hero = params.slideIndex != null
    ? pickHeroAssetByIndex(compliance.images, params.slideIndex)
    : pickHeroAsset(compliance.images);
  if (!hero) {
    throw new Error(
      "No suitable hero asset found (need hero_unedited or background_editable)"
    );
  }

  // Resolve credits (enforces attribution requirement)
  const credits = resolveCredits(compliance, hero);

  // Build mapping (normalizeText at mapping stage; truncate at render stage)
  const mapping: SlotMapping = {
    heroImage: {
      kind: "image",
      assetId: hero.assetId,
      localPath: hero.localPath,
      sourceUrl: hero.sourceUrl,
      role: hero.role,
    },
    title: {
      kind: "text",
      text: normalizeText(topic.title),
    },
    footerCredits: {
      kind: "text",
      text: normalizeText(credits.footerCredits),
    },
  };

  // subtitle: optional — include only when topic has it AND template has the slot
  if (topic.subtitle) {
    const subtitleSlot = template.slots.find((s) => s.id === "subtitle");
    if (subtitleSlot) {
      mapping.subtitle = { kind: "text", text: normalizeText(topic.subtitle) };
    }
  }

  return mapping;
}

// ============================================================================
// Slot Mapping Builder — Fact (body slide)
// ============================================================================

/**
 * Build the slot mapping for a fact (body) slide.
 *
 * Resolves:
 *   - headline      ← payload.headline
 *   - body          ← payload.body (keyFact text)
 *   - footerCredits ← resolveCredits().footerCredits (enforced)
 */
export function buildFactSlotMapping(params: {
  template: TemplateSpec;
  compliance: ValidatedPostSubset;
  payload: { headline: string; body: string };
  slideIndex?: number;
}): SlotMapping {
  const { template, compliance, payload } = params;

  const hero = params.slideIndex != null
    ? pickHeroAssetByIndex(compliance.images, params.slideIndex)
    : pickHeroAsset(compliance.images);
  if (!hero) {
    throw new Error(
      `No suitable hero asset for template "${template.templateId}"`
    );
  }
  const credits = resolveCredits(compliance, hero);

  const mapping: SlotMapping = {
    headline: { kind: "text", text: normalizeText(payload.headline) },
    body: { kind: "text", text: normalizeText(payload.body) },
    footerCredits: { kind: "text", text: normalizeText(credits.footerCredits) },
  };

  // Per-slide hero image background (optional — backward compatible)
  if (compliance.images.filter((img) => img.role === "hero_unedited").length > 1) {
    mapping.heroImage = {
      kind: "image",
      assetId: hero.assetId,
      localPath: hero.localPath,
      sourceUrl: hero.sourceUrl,
      role: hero.role,
    };
  }

  return mapping;
}

// ============================================================================
// Slot Mapping Builder — Outro (end slide)
// ============================================================================

/**
 * Build the slot mapping for an outro (end) slide.
 *
 * Resolves:
 *   - cta           ← payload.cta
 *   - footerCredits ← resolveCredits().footerCredits (enforced)
 */
export function buildOutroSlotMapping(params: {
  template: TemplateSpec;
  compliance: ValidatedPostSubset;
  payload: { cta: string };
  slideIndex?: number;
}): SlotMapping {
  const { template, compliance, payload } = params;

  const hero = params.slideIndex != null
    ? pickHeroAssetByIndex(compliance.images, params.slideIndex)
    : pickHeroAsset(compliance.images);
  if (!hero) {
    throw new Error(
      `No suitable hero asset for template "${template.templateId}"`
    );
  }
  const credits = resolveCredits(compliance, hero);

  const mapping: SlotMapping = {
    cta: { kind: "text", text: normalizeText(payload.cta) },
    footerCredits: { kind: "text", text: normalizeText(credits.footerCredits) },
  };

  // Per-slide hero image background (optional — backward compatible)
  if (compliance.images.filter((img) => img.role === "hero_unedited").length > 1) {
    mapping.heroImage = {
      kind: "image",
      assetId: hero.assetId,
      localPath: hero.localPath,
      sourceUrl: hero.sourceUrl,
      role: hero.role,
    };
  }

  return mapping;
}

// ============================================================================
// Music Template Validation
// ============================================================================

const MEME_REQUIRED_SLOTS: ReadonlyArray<{ id: string; type: "image" | "text" }> = [
  { id: "memeText", type: "text" },
  { id: "footerCredits", type: "text" },
];

export function validateTemplateForMeme(template: TemplateSpec): void {
  if (!template.family.startsWith("music.meme")) {
    throw new Error(`Template family must start with "music.meme", got "${template.family}"`);
  }
  for (const req of MEME_REQUIRED_SLOTS) {
    const slot = template.slots.find((s) => s.id === req.id);
    if (!slot) {
      throw new Error(`Required slot "${req.id}" not found in template "${template.templateId}"`);
    }
    if (slot.type !== req.type) {
      throw new Error(
        `Slot "${req.id}" must be type "${req.type}", got "${slot.type}" in template "${template.templateId}"`,
      );
    }
  }
}

const GRID_REQUIRED_SLOTS: ReadonlyArray<{ id: string; type: "image" | "text" }> = [
  { id: "albumArt1", type: "image" },
  { id: "albumArt2", type: "image" },
  { id: "albumArt3", type: "image" },
  { id: "albumArt4", type: "image" },
  { id: "title", type: "text" },
  { id: "footerCredits", type: "text" },
];

export function validateTemplateForGrid(template: TemplateSpec): void {
  if (template.family !== "music.grid") {
    throw new Error(`Template family must be "music.grid", got "${template.family}"`);
  }
  for (const req of GRID_REQUIRED_SLOTS) {
    const slot = template.slots.find((s) => s.id === req.id);
    if (!slot) {
      throw new Error(`Required slot "${req.id}" not found in template "${template.templateId}"`);
    }
    if (slot.type !== req.type) {
      throw new Error(
        `Slot "${req.id}" must be type "${req.type}", got "${slot.type}" in template "${template.templateId}"`,
      );
    }
  }
}

const CONCERT_REQUIRED_SLOTS: ReadonlyArray<{ id: string; type: "image" | "text" }> = [
  { id: "posterImage", type: "image" },
  { id: "venue", type: "text" },
  { id: "date", type: "text" },
  { id: "footerCredits", type: "text" },
];

export function validateTemplateForConcert(template: TemplateSpec): void {
  if (template.family !== "music.concert") {
    throw new Error(`Template family must be "music.concert", got "${template.family}"`);
  }
  for (const req of CONCERT_REQUIRED_SLOTS) {
    const slot = template.slots.find((s) => s.id === req.id);
    if (!slot) {
      throw new Error(`Required slot "${req.id}" not found in template "${template.templateId}"`);
    }
    if (slot.type !== req.type) {
      throw new Error(
        `Slot "${req.id}" must be type "${req.type}", got "${slot.type}" in template "${template.templateId}"`,
      );
    }
  }
}

const ALBUM_COVER_REQUIRED_SLOTS: ReadonlyArray<{ id: string; type: "image" | "text" }> = [
  { id: "albumArt", type: "image" },
  { id: "title", type: "text" },
  { id: "footerCredits", type: "text" },
];

export function validateTemplateForAlbumCover(template: TemplateSpec): void {
  if (template.family !== "music.album") {
    throw new Error(`Template family must be "music.album", got "${template.family}"`);
  }
  for (const req of ALBUM_COVER_REQUIRED_SLOTS) {
    const slot = template.slots.find((s) => s.id === req.id);
    if (!slot) {
      throw new Error(`Required slot "${req.id}" not found in template "${template.templateId}"`);
    }
    if (slot.type !== req.type) {
      throw new Error(
        `Slot "${req.id}" must be type "${req.type}", got "${slot.type}" in template "${template.templateId}"`,
      );
    }
  }
}

// ============================================================================
// Music Slot Mapping Builders
// ============================================================================

/**
 * Build slot mapping for a meme slide (music.meme.v1 or music.meme.v2).
 */
export function buildMemeSlotMapping(params: {
  template: TemplateSpec;
  compliance: ValidatedPostSubset;
  payload: { memeText: string };
}): SlotMapping {
  const { template, compliance, payload } = params;

  const hero = pickHeroAsset(compliance.images);
  const fallback = hero ?? compliance.images[0];
  if (!fallback) throw new Error("No images available for meme slide");
  const credits = resolveCredits(compliance, fallback);

  const mapping: SlotMapping = {
    memeText: { kind: "text", text: normalizeText(payload.memeText) },
    footerCredits: { kind: "text", text: normalizeText(credits.footerCredits) },
  };

  // artistImage slot (only in v1, which has a full-bleed image)
  const hasArtistImage = template.slots.some((s) => s.id === "artistImage");
  if (hasArtistImage && hero) {
    mapping.artistImage = {
      kind: "image",
      assetId: hero.assetId,
      localPath: hero.localPath,
      sourceUrl: hero.sourceUrl,
      role: hero.role,
    };
  }

  return mapping;
}

/**
 * Build slot mapping for an album cover slide (music.album.cover.v1).
 */
export function buildAlbumCoverSlotMapping(params: {
  template: TemplateSpec;
  compliance: ValidatedPostSubset;
  topic: TopicPackage;
  payload?: { artist?: string; releaseDate?: string };
}): SlotMapping {
  const { template, compliance, topic, payload } = params;

  const hero = pickHeroAsset(compliance.images);
  if (!hero) {
    throw new Error("No suitable hero asset for album cover");
  }

  const credits = resolveCredits(compliance, hero);

  const mapping: SlotMapping = {
    albumArt: {
      kind: "image",
      assetId: hero.assetId,
      localPath: hero.localPath,
      sourceUrl: hero.sourceUrl,
      role: hero.role,
    },
    title: { kind: "text", text: normalizeText(topic.title) },
    footerCredits: { kind: "text", text: normalizeText(credits.footerCredits) },
  };

  // Optional artist slot
  const hasArtist = template.slots.some((s) => s.id === "artist");
  if (hasArtist && payload?.artist) {
    mapping.artist = { kind: "text", text: normalizeText(payload.artist) };
  }

  // Optional releaseDate slot
  const hasReleaseDate = template.slots.some((s) => s.id === "releaseDate");
  if (hasReleaseDate && payload?.releaseDate) {
    mapping.releaseDate = { kind: "text", text: normalizeText(payload.releaseDate) };
  }

  return mapping;
}

/**
 * Build slot mapping for an album grid slide (music.grid.v1).
 */
export function buildGridSlotMapping(params: {
  template: TemplateSpec;
  compliance: ValidatedPostSubset;
  payload: { title: string; albumPaths?: string[] };
}): SlotMapping {
  const { compliance, payload } = params;

  const hero = pickHeroAsset(compliance.images);
  const fallback = hero ?? compliance.images[0];
  if (!fallback) throw new Error("No images available for grid slide");
  const credits = resolveCredits(compliance, fallback);

  const mapping: SlotMapping = {
    title: { kind: "text", text: normalizeText(payload.title) },
    footerCredits: { kind: "text", text: normalizeText(credits.footerCredits) },
  };

  // Fill album art slots from available images (or provided paths)
  const images = compliance.images;
  for (let i = 0; i < 4; i++) {
    const slotId = `albumArt${i + 1}`;
    const img = images[i];
    if (img) {
      mapping[slotId] = {
        kind: "image",
        assetId: img.assetId,
        localPath: img.localPath,
        sourceUrl: img.sourceUrl,
        role: img.role,
      };
    } else if (payload.albumPaths?.[i]) {
      const albumPath = payload.albumPaths[i];
      if (albumPath) {
        mapping[slotId] = {
          kind: "image",
          assetId: `grid-${i}`,
          localPath: albumPath,
          sourceUrl: "",
          role: "background_editable",
        };
      }
    }
  }

  return mapping;
}

/**
 * Build slot mapping for a concert info slide (music.concert.v1).
 */
export function buildConcertSlotMapping(params: {
  template: TemplateSpec;
  compliance: ValidatedPostSubset;
  payload: { venue: string; date: string; lineup?: string[] };
}): SlotMapping {
  const { compliance, payload } = params;

  const hero = pickHeroAsset(compliance.images);
  if (!hero) {
    throw new Error("No suitable poster image for concert template");
  }

  const credits = resolveCredits(compliance, hero);

  const mapping: SlotMapping = {
    posterImage: {
      kind: "image",
      assetId: hero.assetId,
      localPath: hero.localPath,
      sourceUrl: hero.sourceUrl,
      role: hero.role,
    },
    venue: { kind: "text", text: normalizeText(payload.venue) },
    date: { kind: "text", text: normalizeText(payload.date) },
    footerCredits: { kind: "text", text: normalizeText(credits.footerCredits) },
  };

  // Optional lineup slot
  if (payload.lineup && payload.lineup.length > 0) {
    mapping.lineup = {
      kind: "text",
      text: normalizeText(payload.lineup.join("\n")),
    };
  }

  return mapping;
}
