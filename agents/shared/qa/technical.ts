/**
 * Technical QA Module — rule-based, deterministic checks.
 *
 * No LLM calls. Validates Instagram platform constraints,
 * file integrity, and content completeness.
 */
import { stat } from "node:fs/promises";

// ============================================================================
// Types
// ============================================================================

export interface TechnicalIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface TechnicalQaResult {
  passed: boolean;
  issues: TechnicalIssue[];
}

// ============================================================================
// Instagram platform limits
// ============================================================================

const INSTAGRAM_CAPTION_MAX = 2200;
const INSTAGRAM_HASHTAG_MAX = 30;
const INSTAGRAM_SLIDE_MAX = 20;
const PNG_SIZE_WARN_BYTES = 8 * 1024 * 1024; // 8MB

// ============================================================================
// Placeholder patterns
// ============================================================================

const PLACEHOLDER_PATTERNS = [
  /\[TODO\]/i,
  /\[TBD\]/i,
  /lorem\s+ipsum/i,
  /여기에\s*(입력|작성|텍스트)/,
  /placeholder/i,
  /\{\{.+\}\}/,
  /FIXME/i,
  /XXX/i,
];

// ============================================================================
// Input types
// ============================================================================

export interface TechnicalQaInput {
  captionText: string;
  hashtags: string[];
  pngPaths: string[];
  slides: Array<{
    slideIndex: number;
    title: string;
    bodyText: string;
  }>;
}

// ============================================================================
// Main QA function
// ============================================================================

export async function runTechnicalQa(input: TechnicalQaInput): Promise<TechnicalQaResult> {
  const issues: TechnicalIssue[] = [];

  // ── Caption length ────────────────────────────────────
  if (input.captionText.length > INSTAGRAM_CAPTION_MAX) {
    issues.push({
      severity: "error",
      code: "CAPTION_TOO_LONG",
      message: `캡션이 ${input.captionText.length}자로 Instagram 제한(${INSTAGRAM_CAPTION_MAX}자)을 초과합니다.`,
      details: { length: input.captionText.length, limit: INSTAGRAM_CAPTION_MAX },
    });
  }

  // ── Hashtag count ─────────────────────────────────────
  if (input.hashtags.length > INSTAGRAM_HASHTAG_MAX) {
    issues.push({
      severity: "error",
      code: "HASHTAG_TOO_MANY",
      message: `해시태그가 ${input.hashtags.length}개로 Instagram 제한(${INSTAGRAM_HASHTAG_MAX}개)을 초과합니다.`,
      details: { count: input.hashtags.length, limit: INSTAGRAM_HASHTAG_MAX },
    });
  }

  if (input.hashtags.length === 0) {
    issues.push({
      severity: "warning",
      code: "HASHTAG_MISSING",
      message: "해시태그가 없습니다. 도달률을 위해 해시태그 추가를 권장합니다.",
    });
  }

  // ── Slide count ───────────────────────────────────────
  if (input.slides.length === 0) {
    issues.push({
      severity: "error",
      code: "SLIDE_COUNT_INVALID",
      message: "슬라이드가 0개입니다.",
    });
  } else if (input.slides.length > INSTAGRAM_SLIDE_MAX) {
    issues.push({
      severity: "error",
      code: "SLIDE_COUNT_INVALID",
      message: `슬라이드가 ${input.slides.length}개로 Instagram 제한(${INSTAGRAM_SLIDE_MAX}개)을 초과합니다.`,
      details: { count: input.slides.length, limit: INSTAGRAM_SLIDE_MAX },
    });
  }

  // ── Empty slide text ──────────────────────────────────
  for (const slide of input.slides) {
    if (!slide.title.trim() && !slide.bodyText.trim()) {
      issues.push({
        severity: "error",
        code: "EMPTY_SLIDE_TEXT",
        message: `슬라이드 ${slide.slideIndex + 1}의 제목과 본문이 모두 비어있습니다.`,
        details: { slideIndex: slide.slideIndex },
      });
    }
  }

  // ── Placeholder text ──────────────────────────────────
  for (const slide of input.slides) {
    const combined = `${slide.title} ${slide.bodyText}`;
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(combined)) {
        issues.push({
          severity: "error",
          code: "PLACEHOLDER_TEXT",
          message: `슬라이드 ${slide.slideIndex + 1}에 플레이스홀더 텍스트가 남아있습니다: ${pattern.source}`,
          details: { slideIndex: slide.slideIndex, pattern: pattern.source },
        });
        break;
      }
    }
  }

  // Check caption for placeholders too
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(input.captionText)) {
      issues.push({
        severity: "error",
        code: "PLACEHOLDER_TEXT",
        message: `캡션에 플레이스홀더 텍스트가 남아있습니다: ${pattern.source}`,
        details: { location: "caption", pattern: pattern.source },
      });
      break;
    }
  }

  // ── PNG file size ─────────────────────────────────────
  for (const pngPath of input.pngPaths) {
    try {
      const info = await stat(pngPath);
      if (info.size > PNG_SIZE_WARN_BYTES) {
        issues.push({
          severity: "warning",
          code: "PNG_TOO_LARGE",
          message: `${pngPath} 파일 크기가 ${(info.size / 1024 / 1024).toFixed(1)}MB로 큽니다.`,
          details: { path: pngPath, sizeBytes: info.size },
        });
      }
    } catch {
      // File not found — may be expected in some flows
    }
  }

  return {
    passed: issues.every((i) => i.severity !== "error"),
    issues,
  };
}

// ============================================================================
// Caption length clamping utility (used by Agent 3's 12-D TODO)
// ============================================================================

/**
 * Clamp caption text to a maximum length, truncating at the last sentence boundary.
 */
export function clampCaptionLength(caption: string, maxLength: number = INSTAGRAM_CAPTION_MAX): string {
  if (caption.length <= maxLength) return caption;

  // Try to cut at last sentence boundary
  const truncated = caption.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf(".");
  const lastBang = truncated.lastIndexOf("!");
  const lastQuestion = truncated.lastIndexOf("?");
  const lastNewline = truncated.lastIndexOf("\n");

  const cutPoint = Math.max(lastPeriod, lastBang, lastQuestion, lastNewline);

  if (cutPoint > maxLength * 0.5) {
    return truncated.slice(0, cutPoint + 1).trimEnd();
  }

  // Fallback: hard cut at word boundary
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + "…";
  }

  return truncated.slice(0, maxLength - 1) + "…";
}
