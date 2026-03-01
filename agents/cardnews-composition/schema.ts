import { z } from "zod";

// ============================================================================
// Topic Config Schema
// ============================================================================

export const TopicConfigSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  bodyText: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
});

// ============================================================================
// Template Schemas
// ============================================================================

export const SlotStyleSchema = z.object({
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  color: z.string().optional(),
  textShadow: z.string().optional(),
  textAlign: z.string().optional(),
  lineHeight: z.number().optional(),
});

export const SlotConstraintsSchema = z.object({
  maxChars: z.number().int().positive().optional(),
  maxLines: z.number().int().positive().optional(),
});

export const TemplateSlotSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["image", "text"]),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  fit: z.string().optional(),
  style: SlotStyleSchema.optional(),
  constraints: SlotConstraintsSchema.optional(),
  attributionRequired: z.boolean().optional(),
});

export const TemplateSpecSchema = z.object({
  templateId: z.string().min(1),
  family: z.string().min(1),
  safeArea: z.object({
    top: z.number(),
    right: z.number(),
    bottom: z.number(),
    left: z.number(),
  }),
  slots: z.array(TemplateSlotSchema).min(1),
});
