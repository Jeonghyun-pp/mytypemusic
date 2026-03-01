/**
 * Font Registry — re-exports from shared font module.
 *
 * All font logic now lives in agents/shared/fonts.ts.
 * This file exists for backward compatibility with existing Agent imports.
 */
export {
  type FontMood,
  type FontSpec,
  type FontSet,
  type SatoriFontEntry,
  getFontSet,
  getDefaultFontSet,
  loadFontsForMood,
  isValidFontMood,
  MOOD_CSS_STACKS,
} from "../../shared/fonts.js";
