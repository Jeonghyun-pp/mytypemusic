// ============================================================================
// Agent2: Card-News Composition — Type Definitions
// ============================================================================

import type {
  ValidatedAsset,
  PostComplianceResult,
  AttributionBundle,
  AttributionLine,
  PostChannel,
  AssetRole,
} from "../safe-image-acquisition/types.js";

// Re-export Agent1 types used by Agent2 consumers
export type {
  ValidatedAsset,
  PostComplianceResult,
  AttributionBundle,
  AttributionLine,
  PostChannel,
  AssetRole,
};

// ============================================================================
// Constants
// ============================================================================

/** Instagram card-news output dimensions (px) */
export const INSTAGRAM_WIDTH = 1080;
export const INSTAGRAM_HEIGHT = 1350;

// ============================================================================
// Topic (CLI input)
// ============================================================================

/** Topic configuration — the editorial content for a post (minimal) */
export interface TopicConfig {
  title: string;
  subtitle?: string;
  bodyText?: string;
  hashtags?: string[];
}

/** Content category for routing and template selection */
export type TopicCategory = "celebrity" | "fashion" | "music" | "issue" | "lifestyle";

/** Full topic package — TopicConfig + category/keyFacts for slot mapping */
export interface TopicPackage extends TopicConfig {
  category: TopicCategory;
  keyFacts?: string[];
}

// ============================================================================
// Template System
// ============================================================================

/** Slot types supported in templates */
export type SlotType = "image" | "text";

/** CSS-like style properties for text slots */
export interface SlotStyle {
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  textShadow?: string;
  textAlign?: string;
  lineHeight?: number;
}

/** Safe area insets (px from each edge) */
export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Text constraints for a slot (used by text-fit) */
export interface SlotConstraints {
  maxChars?: number;
  maxLines?: number;
}

/** A single slot in a template */
export interface TemplateSlot {
  id: string;
  type: SlotType;
  x: number;
  y: number;
  width: number;
  height: number;
  fit?: string;
  style?: SlotStyle;
  constraints?: SlotConstraints;
  /** When true, this slot MUST contain attribution text — omission is a hard error */
  attributionRequired?: boolean;
}

/** Template specification loaded from JSON */
export interface TemplateSpec {
  templateId: string;
  family: string;
  safeArea: SafeArea;
  slots: TemplateSlot[];
}

// ============================================================================
// Slot Bindings (template + data → renderable)
// ============================================================================

/** Binding value for a single slot */
export type SlotBinding =
  | { type: "image"; src: string; alt?: string }
  | { type: "text"; content: string };

/** All bindings for one slide */
export interface SlideBindings {
  templateId: string;
  bindings: Record<string, SlotBinding>;
}

// ============================================================================
// Composition Output
// ============================================================================

/** Result for a single rendered slide */
export interface RenderedSlide {
  slideIndex: number;
  htmlPath: string;
  pngPath: string;
}

/** Overall composition result returned by compose() */
export interface CompositionResult {
  postId: string;
  slides: RenderedSlide[];
  captionText: string;
  layoutManifest: LayoutManifest;
}

/** Layout manifest saved alongside outputs */
export interface LayoutManifest {
  postId: string;
  templateId: string;
  slidesCount: number;
  slides: Array<{
    index: number;
    htmlFile: string;
    pngFile: string;
    template: string;
  }>;
  attribution: {
    footerRendered: boolean;
    captionAppendix: string;
  };
  generatedAt: string;
}
