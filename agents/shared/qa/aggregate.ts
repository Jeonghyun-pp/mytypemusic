/**
 * QA Aggregator — runs all QA modules and produces a unified report.
 *
 * Usage (CLI):
 *   npx tsx agents/shared/qa/cli.ts --runDir <outputsDir> --topicId <id>
 *
 * Usage (programmatic):
 *   import { runFullQa } from "./aggregate.js";
 *   const report = await runFullQa({ slides, caption, ... });
 */
import { runTechnicalQa, type TechnicalQaResult, type TechnicalQaInput } from "./technical";
import { runCopyQa, type CopyQaResult, type CopyQaInput } from "./copy";
import { runLegalQa, type LegalQaResult, type LegalQaInput } from "./legal";

// ============================================================================
// Types
// ============================================================================

export interface QaReport {
  timestamp: string;
  technical: TechnicalQaResult;
  copy: CopyQaResult;
  legal: LegalQaResult;
  overall: {
    passed: boolean;
    blocked: boolean;
    errorCount: number;
    warningCount: number;
  };
}

export interface FullQaInput {
  slides: Array<{
    slideIndex: number;
    title: string;
    bodyText: string;
    kind: string;
  }>;
  caption: string;
  hashtags: string[];
  pngPaths: string[];
  /** Path to validated-post.json */
  validatedPostPath?: string;
  /** Path to topic-intel.json */
  topicIntelPath?: string;
}

// ============================================================================
// Aggregator
// ============================================================================

export function aggregateQa(params: {
  technical: TechnicalQaResult;
  copy: CopyQaResult;
  legal: LegalQaResult;
}): QaReport {
  const { technical, copy, legal } = params;

  let errorCount = 0;
  let warningCount = 0;

  // Count technical issues
  for (const issue of technical.issues) {
    if (issue.severity === "error") errorCount++;
    else warningCount++;
  }

  // Count copy issues
  for (const issue of copy.issues) {
    if (issue.severity === "error") errorCount++;
    else warningCount++;
  }

  // Count legal issues
  for (const issue of legal.issues) {
    if (issue.severity === "block") errorCount++;
    else warningCount++;
  }

  return {
    timestamp: new Date().toISOString(),
    technical,
    copy,
    legal,
    overall: {
      passed: technical.passed && copy.passed && !legal.blocked,
      blocked: legal.blocked,
      errorCount,
      warningCount,
    },
  };
}

// ============================================================================
// Full QA runner
// ============================================================================

export async function runFullQa(input: FullQaInput): Promise<QaReport> {
  // Build inputs for each module
  const technicalInput: TechnicalQaInput = {
    captionText: input.caption,
    hashtags: input.hashtags,
    pngPaths: input.pngPaths,
    slides: input.slides.map((s) => ({
      slideIndex: s.slideIndex,
      title: s.title,
      bodyText: s.bodyText,
    })),
  };

  const copyInput: CopyQaInput = {
    slides: input.slides.map((s) => ({
      slideIndex: s.slideIndex,
      title: s.title,
      bodyText: s.bodyText,
      kind: s.kind,
    })),
    caption: input.caption,
    topicIntelPath: input.topicIntelPath,
  };

  const legalInput: LegalQaInput = {
    slides: input.slides.map((s) => ({
      slideIndex: s.slideIndex,
      title: s.title,
      bodyText: s.bodyText,
    })),
    caption: input.caption,
    validatedPostPath: input.validatedPostPath,
    topicIntelPath: input.topicIntelPath,
  };

  // Run all QA modules (technical is sync, copy & legal are async)
  const [technical, copy, legal] = await Promise.all([
    runTechnicalQa(technicalInput),
    runCopyQa(copyInput),
    runLegalQa(legalInput),
  ]);

  return aggregateQa({ technical, copy, legal });
}
