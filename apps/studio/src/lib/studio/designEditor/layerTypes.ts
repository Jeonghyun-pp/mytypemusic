/**
 * Layer system types for the multi-layer compositor.
 *
 * Each layer is an independent element positioned on the canvas
 * with its own transform, opacity, blend mode, and effects.
 */
import { z } from "zod";

// ── Layer kind ─────────────────────────────────────────

export const LayerKindSchema = z.enum(["text", "image", "shape", "svg-path"]);
export type LayerKind = z.infer<typeof LayerKindSchema>;

// ── Shape types ────────────────────────────────────────

export const ShapeTypeSchema = z.enum(["rect", "circle", "line", "polygon"]);
export type ShapeType = z.infer<typeof ShapeTypeSchema>;

// ── Blend modes ────────────────────────────────────────

export const BlendModeSchema = z.enum([
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
]);
export type BlendMode = z.infer<typeof BlendModeSchema>;

// ── Shadow (per-layer) ─────────────────────────────────

export const LayerShadowSchema = z.object({
  offsetX: z.number().min(-50).max(50),
  offsetY: z.number().min(-50).max(50),
  blur: z.number().min(0).max(50),
  color: z.string(),
});
export type LayerShadow = z.infer<typeof LayerShadowSchema>;

// ── Base layer ─────────────────────────────────────────

export const LayerBaseSchema = z.object({
  id: z.string(),
  kind: LayerKindSchema,
  name: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().min(1),
  height: z.number().min(1),
  rotation: z.number().default(0),
  scale: z.number().min(0.01).default(1),
  opacity: z.number().min(0).max(1).default(1),
  blendMode: BlendModeSchema.default("normal"),
  zIndex: z.number().int(),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  shadow: LayerShadowSchema.optional(),
  blur: z.number().min(0).max(30).optional(),
});

// ── Text layer ─────────────────────────────────────────

export const TextLayerSchema = LayerBaseSchema.extend({
  kind: z.literal("text"),
  text: z.string(),
  fontFamily: z.string().optional(),
  fontSize: z.number().min(8).max(200).default(32),
  fontWeight: z.number().int().min(100).max(900).default(400),
  color: z.string().default("#000000"),
  textAlign: z.enum(["left", "center", "right"]).default("left"),
  lineHeight: z.number().min(0.5).max(3).default(1.4),
  letterSpacing: z.number().default(0),
  curvedPath: z.string().optional(),
});
export type TextLayer = z.infer<typeof TextLayerSchema>;

// ── Image layer ────────────────────────────────────────

export const ImageLayerSchema = LayerBaseSchema.extend({
  kind: z.literal("image"),
  src: z.string(),
  objectFit: z.enum(["cover", "contain", "fill"]).default("cover"),
  borderRadius: z.number().min(0).default(0),
});
export type ImageLayer = z.infer<typeof ImageLayerSchema>;

// ── Shape layer ────────────────────────────────────────

export const ShapeLayerSchema = LayerBaseSchema.extend({
  kind: z.literal("shape"),
  shapeType: ShapeTypeSchema,
  fill: z.string().default("#cccccc"),
  stroke: z.string().optional(),
  strokeWidth: z.number().min(0).default(0),
  borderRadius: z.number().min(0).default(0),
});
export type ShapeLayer = z.infer<typeof ShapeLayerSchema>;

// ── SVG path layer ─────────────────────────────────────

export const SvgPathLayerSchema = LayerBaseSchema.extend({
  kind: z.literal("svg-path"),
  pathData: z.string(),
  fill: z.string().default("none"),
  stroke: z.string().default("#000000"),
  strokeWidth: z.number().min(0).default(2),
});
export type SvgPathLayer = z.infer<typeof SvgPathLayerSchema>;

// ── Union type ─────────────────────────────────────────

export const LayerSchema = z.discriminatedUnion("kind", [
  TextLayerSchema,
  ImageLayerSchema,
  ShapeLayerSchema,
  SvgPathLayerSchema,
]);
export type Layer = z.infer<typeof LayerSchema>;
