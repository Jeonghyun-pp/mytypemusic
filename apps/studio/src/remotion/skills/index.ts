/**
 * Motion Skills — index barrel export.
 */

// TextReveal
export { TextRevealComp, textRevealSchema, calculateTextRevealDuration } from "./TextRevealComp";
export type { TextRevealProps } from "./TextRevealComp";

// ChartAnimation
export { ChartAnimationComp, chartAnimationSchema, calculateChartDuration } from "./ChartAnimationComp";
export type { ChartAnimationProps } from "./ChartAnimationComp";

// DataCounter
export { DataCounterComp, dataCounterSchema, calculateDataCounterDuration } from "./DataCounterComp";
export type { DataCounterProps } from "./DataCounterComp";

// Slideshow
export { SlideshowComp, slideshowSchema, calculateSlideshowDuration } from "./SlideshowComp";
export type { SlideshowProps } from "./SlideshowComp";

// SplitScreen
export { SplitScreenComp, splitScreenSchema, calculateSplitScreenDuration } from "./SplitScreenComp";
export type { SplitScreenProps } from "./SplitScreenComp";

// KineticTypography
export { KineticTypographyComp, kineticTypographySchema, calculateKineticDuration } from "./KineticTypographyComp";
export type { KineticTypographyProps } from "./KineticTypographyComp";

// ParticleEffect
export { ParticleEffectComp, particleEffectSchema, calculateParticleDuration } from "./ParticleEffectComp";
export type { ParticleEffectProps } from "./ParticleEffectComp";

// Shared
export { FPS, CLAMP, hexToRgba } from "./types";

/** All skill IDs for registration and lookup. */
export const MOTION_SKILL_IDS = [
  "TextReveal",
  "ChartAnimation",
  "DataCounter",
  "Slideshow",
  "SplitScreen",
  "KineticTypography",
  "ParticleEffect",
] as const;

export type MotionSkillId = (typeof MOTION_SKILL_IDS)[number];
