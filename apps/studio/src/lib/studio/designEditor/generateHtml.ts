import type { SlideSpec, SlideStyleOverrides } from "./types";
import { renderSlideHtml, TEMPLATES } from "./templates";

/**
 * Generate HTML from a SlideSpec + optional global style.
 * Pure string manipulation — safe for client-side use.
 */
export function generateHtmlFromSlide(
  slide: SlideSpec,
  globalStyle?: SlideStyleOverrides,
): string {
  const merged = { ...globalStyle, ...slide.styleOverrides };
  const tmpl = TEMPLATES[slide.templateId];
  return renderSlideHtml(slide.templateId, {
    title: slide.title,
    bodyText: slide.bodyText,
    footerText: slide.footerText,
    heroImageDataUri: slide.heroImageDataUri,
    slideIndex: slide.slideIndex,
    bgGradient: merged.bgGradient,
    textColor: merged.textColor,
    accentColor: merged.accentColor,
    footerColor: merged.footerColor,
    titleSizePx: merged.titleSizePx ?? tmpl.defaults.titleSizePx,
    bodySizePx: merged.bodySizePx ?? tmpl.defaults.bodySizePx,
    headlineSizePx: merged.headlineSizePx,
    titleWeight: merged.titleWeight ?? tmpl.defaults.titleWeight,
    bodyWeight: merged.bodyWeight ?? tmpl.defaults.bodyWeight,
    letterSpacing: merged.letterSpacing,
    scrimOpacity: merged.scrimOpacity,
    imageBrightness: merged.imageBrightness,
    cardRadius: merged.cardRadius,
  });
}
