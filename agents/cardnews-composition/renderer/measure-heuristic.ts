/**
 * Heuristic text overflow estimation without browser DOM.
 *
 * Replaces Playwright-based measureOverflow() which used scrollHeight.
 * Uses character-width estimation tuned for Korean (CJK) text.
 */

export interface OverflowEstimate {
  overflows: boolean;
  estimatedLines: number;
  maxLines: number;
}

/**
 * Estimate whether text overflows a container.
 *
 * Korean (CJK) characters are roughly square: width ≈ fontSize.
 * Latin characters are narrower: width ≈ fontSize * 0.55.
 * We use a blended average of fontSize * 0.75 for Korean-heavy text.
 */
export function estimateOverflow(params: {
  text: string;
  containerWidthPx: number;
  containerHeightPx: number;
  fontSizePx: number;
  lineHeight: number; // e.g. 1.18, 1.35
}): OverflowEstimate {
  const { text, containerWidthPx, containerHeightPx, fontSizePx, lineHeight } =
    params;

  if (!text || fontSizePx <= 0) {
    return { overflows: false, estimatedLines: 0, maxLines: 0 };
  }

  // Estimate average character width based on CJK ratio in text
  const cjkCount = (text.match(/[\u3000-\u9FFF\uAC00-\uD7AF]/g) || []).length;
  const totalChars = text.length;
  const cjkRatio = totalChars > 0 ? cjkCount / totalChars : 0.5;

  // CJK char width ≈ fontSize, Latin ≈ fontSize * 0.55
  const avgCharWidth =
    fontSizePx * (cjkRatio * 1.0 + (1 - cjkRatio) * 0.55);

  const charsPerLine = Math.max(1, Math.floor(containerWidthPx / avgCharWidth));
  const lineHeightPx = fontSizePx * lineHeight;
  const maxLines = Math.max(1, Math.floor(containerHeightPx / lineHeightPx));

  // Split by newlines first, then estimate wrapping per line
  const lines = text.split("\n");
  let estimatedLines = 0;
  for (const line of lines) {
    if (line.length === 0) {
      estimatedLines += 1;
    } else {
      estimatedLines += Math.ceil(line.length / charsPerLine);
    }
  }

  return {
    overflows: estimatedLines > maxLines,
    estimatedLines,
    maxLines,
  };
}

/**
 * Re-export compatible types for compose.ts integration.
 */
export interface OverflowResult {
  titleOverflow: boolean;
  subtitleOverflow: boolean;
}

/**
 * Estimate overflow for cover slide title and subtitle.
 *
 * Drop-in replacement for measureOverflow() from measure.ts.
 */
export function estimateCoverOverflow(params: {
  titleText: string;
  titleWidthPx: number;
  titleHeightPx: number;
  titleFontSizePx: number;
  titleLineHeight: number;
  subtitleText?: string;
  subtitleWidthPx?: number;
  subtitleHeightPx?: number;
  subtitleFontSizePx?: number;
  subtitleLineHeight?: number;
}): OverflowResult {
  const titleOv = estimateOverflow({
    text: params.titleText,
    containerWidthPx: params.titleWidthPx,
    containerHeightPx: params.titleHeightPx,
    fontSizePx: params.titleFontSizePx,
    lineHeight: params.titleLineHeight,
  });

  let subtitleOv = { overflows: false };
  if (
    params.subtitleText &&
    params.subtitleWidthPx &&
    params.subtitleHeightPx &&
    params.subtitleFontSizePx &&
    params.subtitleLineHeight
  ) {
    subtitleOv = estimateOverflow({
      text: params.subtitleText,
      containerWidthPx: params.subtitleWidthPx,
      containerHeightPx: params.subtitleHeightPx,
      fontSizePx: params.subtitleFontSizePx,
      lineHeight: params.subtitleLineHeight,
    });
  }

  return {
    titleOverflow: titleOv.overflows,
    subtitleOverflow: subtitleOv.overflows,
  };
}
