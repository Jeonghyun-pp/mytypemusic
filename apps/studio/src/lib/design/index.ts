/**
 * Design Engine — public API.
 */

// Types
export type {
  DesignContentType,
  DesignPlatform,
  DesignFormat,
  LayoutStyle,
  TypographyMood,
  ColorMood,
  CriticVerdict,
  StyleToken,
  DesignOutput,
  DesignBrief,
  CriticDimensionScore,
  DesignCriticResult,
  DesignEditAction,
  DesignEditRequest,
  SlideDesign,
  VisualDesignResult,
  MotionDesignResult,
  ChartType,
  DataVizResult,
  DesignQualityRecord,
  DesignEngineInput,
  DesignEngineOutput,
} from "./types";

export { PLATFORM_SIZES } from "./types";

// Brand Kit
export type { BrandKit, BrandColors, BrandTypography, BrandAssets, BrandLayout, FontMood } from "./brand-kit";
export {
  DEFAULT_BRAND_KIT,
  getBrandFontStack,
  getFontMoodForContent,
  getSafeContainerStyle,
  pickGradient,
  mergeBrandKit,
} from "./brand-kit";

// Satori Sanitizer
export { sanitizeForSatori, validateForSatori } from "./satori-sanitizer";

// Fonts
export {
  selectFontMood,
  typographyMoodToFontMood,
  fontStyleProps,
  heroTitleStyle,
  SATORI_SUPPORTED_CSS,
  SATORI_UNSUPPORTED_CSS,
} from "./fonts";

// Design Director
export { generateDesignBrief } from "./design-director";
export type { DesignDirectorOptions } from "./design-director";

// Visual Designer
export { generateVisualDesign, designWithTemplate, designWithLLM } from "./visual-designer";
export type { VisualDesignInput, TemplatePathInput, GeneratedPathInput } from "./visual-designer";

// Design Critic
export { critiqueDesign, critiqueSingleSlide } from "./design-critic";
export type { CriticOptions } from "./design-critic";

// Benchmark
export { buildBenchmarkReport } from "./benchmark";
export type { BenchmarkReport } from "./types";

// Edit Interpreter
export { parseEditInstructions, applyEdits, interpretAndApply } from "./edit-interpreter";
export type { EditApplyOptions } from "./edit-interpreter";

// Refinement Loop
export { runRefinementLoop, quickRefine } from "./refinement-loop";
export type { RefinementOptions, RefinementResult, IterationRecord } from "./refinement-loop";

// Quality Store
export {
  saveQualityRecord,
  getQualityRecord,
  getQualityRecordAsync,
  getRecentRecords,
  getQualityStats,
  getQualityTrends,
  getQualityTrendsAsync,
  warmQualityCache,
  clearQualityRecords,
} from "./quality-store";
export type { QualityStats, QualityTrend } from "./quality-store";

// Motion Skills
export { MOTION_SKILLS, getMotionSkill, getSkillsForContentType } from "./motion-skills";
export type { MotionSkillMeta } from "./motion-skills";

// Motion Skill Detector
export { detectMotionSkill, detectMotionSkillRuleBased } from "./motion-skill-detector";
export type { MotionSkillDetection } from "./motion-skill-detector";

// Motion Designer
export { generateMotionDesign } from "./motion-designer";
export type { MotionDesignerOptions } from "./motion-designer";

// Motion Render Pipeline
export { runMotionPipeline, runMotionPipelineFromBrief } from "./motion-render-pipeline";
export type { MotionRenderOptions, MotionRenderResult } from "./motion-render-pipeline";

// Style Transfer Agent
export { extractStyleToken, extractStyleFromUrl, styleTokenToColorOverrides } from "./style-transfer";
export type { StyleTransferOptions } from "./style-transfer";

// Style Memory
export {
  saveStyleMemory,
  getStyleMemory,
  getStyleMemoryAsync,
  getStyleMemoryEntry,
  getArtistStyle,
  getArtistStyles,
  getRecentStyles,
  getStyleMemoryStats,
  warmStyleMemoryCache,
  clearStyleMemory,
  artistKey,
  albumKey,
} from "./style-memory";
export type { StyleMemoryEntry, StyleMemoryStats } from "./style-memory";

// Spotify Style Extractor
export {
  extractStyleFromAlbum,
  extractStyleFromArtist,
  extractStyleByArtistName,
  extractStylesFromArtistAlbums,
  mergeStyleTokens,
} from "./spotify-style-extractor";
export type { SpotifyStyleOptions } from "./spotify-style-extractor";

// Data Visualization Agent
export { generateDataViz, renderChartToHtml } from "./data-viz-agent";
export type { DataVizOptions } from "./data-viz-agent";

// Design → Publishing Bridge
export { prepareForPublishing, batchPrepareForPublishing } from "./publish-bridge";
export type { PublishReadyContent, DesignToPublishInput } from "./publish-bridge";

// Style Performance Tracker
export {
  recordDesignStyle,
  updateEngagement,
  getStyleInsights,
  getStyleRecommendation,
  getTopTemplates,
  getPerformanceRecords,
  getPerformanceSummary,
  warmPerformanceCache,
  clearPerformanceRecords,
} from "./style-performance";
export type {
  StylePerformanceRecord,
  StyleInsight,
  StyleRecommendation,
} from "./style-performance";
