/**
 * Edit Interpreter Agent — converts critic feedback into design modifications.
 *
 * Two strategies based on design path:
 *   Path A (Template): Parse instructions → modify renderSpec → re-render template
 *   Path B (Generated): Send current HTML + instructions → LLM produces modified HTML
 *
 * Also handles user-initiated edits (natural language → structural changes).
 */

import { callGptJson, callGptSafe } from "@/lib/llm";
import { z } from "zod";
import type {
  DesignBrief,
  DesignEditAction,
  DesignEditRequest,
  SlideDesign,
  VisualDesignResult,
} from "./types";
import type { BrandKit } from "./brand-kit";
import { DEFAULT_BRAND_KIT } from "./brand-kit";
import { SATORI_UNSUPPORTED_CSS } from "./fonts";

// ── Zod schemas ─────────────────────────────────────────

const editActionSchema = z.object({
  slideIndex: z.number().int().min(0),
  target: z.string(),
  property: z.string(),
  action: z.string(),
  value: z.union([z.string(), z.number()]).optional(),
});

const parsedEditSchema = z.object({
  actions: z.array(editActionSchema),
  summary: z.string(),
});

type ParsedEditResponse = z.infer<typeof parsedEditSchema>;

// ── Template render helper ──────────────────────────────

async function resolveTemplateToHtml(
  templateId: string,
  renderSpec: Record<string, unknown>,
): Promise<string> {
  const { renderSlideHtml } = await import("@agents/shared/templates/index");
  return renderSlideHtml(
    templateId as Parameters<typeof renderSlideHtml>[0],
    renderSpec as unknown as Parameters<typeof renderSlideHtml>[1],
  );
}

// ── Stage 1: Parse instructions → structured actions ────

/**
 * Parse natural language edit instructions into structured DesignEditActions.
 * Uses gpt-4o-mini for cost efficiency.
 */
export async function parseEditInstructions(
  instructions: string,
  slides: SlideDesign[],
  opts?: { model?: string },
): Promise<DesignEditRequest> {
  const slideDescriptions = slides
    .map((s, i) => `  Slide ${i}: ${s.width}x${s.height} (${s.platform})${s.templateId ? ` [template: ${s.templateId}]` : " [generated]"}`)
    .join("\n");

  const prompt = `You are a design edit parser. Convert natural language edit instructions into structured actions.

=== CURRENT SLIDES ===
${slideDescriptions}

=== INSTRUCTIONS ===
${instructions}

=== TASK ===
Parse these instructions into specific, actionable changes. Each action targets a specific slide.

Available targets: "background", "title", "body", "footer", "accent", "layout", "spacing"
Available properties: "color", "fontSize", "fontWeight", "gradient", "padding", "margin", "opacity", "text", "position"
Available actions: "change", "increase", "decrease", "darken", "lighten", "remove", "add"

Return a JSON object:
{
  "actions": [
    {
      "slideIndex": 0,
      "target": "title",
      "property": "fontSize",
      "action": "increase",
      "value": 56
    }
  ],
  "summary": "Brief Korean summary of all changes"
}

Rules:
- If instructions say "전체" or "모든 슬라이드", create actions for every slide index
- Value should be concrete: hex colors, pixel sizes, weight numbers
- For color changes, always provide the hex value
- If the instruction is vague, make a reasonable professional design decision
- Return ONLY the JSON object.`;

  const result = await callGptJson<ParsedEditResponse>(prompt, {
    model: opts?.model ?? "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 1000,
    schema: parsedEditSchema,
  });

  return {
    naturalLanguage: instructions,
    actions: result.actions.map((a) => ({
      target: a.target,
      property: a.property,
      action: a.action,
      value: a.value,
    })),
  };
}

// ── Stage 2: Apply edits to slides ──────────────────────

export interface EditApplyOptions {
  model?: string;
  brief?: DesignBrief;
  brandKit?: BrandKit;
}

/**
 * Apply parsed edit actions to a visual design result.
 * Returns a new VisualDesignResult with modified slides.
 *
 * Strategy:
 *   - Template slides (with templateId + renderSpec): modify renderSpec, re-render
 *   - Generated slides (no templateId): send HTML + edits to LLM for modification
 */
export async function applyEdits(
  designResult: VisualDesignResult,
  instructions: string,
  parsedActions: DesignEditAction[],
  opts?: EditApplyOptions,
): Promise<VisualDesignResult> {
  const kit = opts?.brandKit ?? DEFAULT_BRAND_KIT;
  const modifiedSlides: SlideDesign[] = [...designResult.slides];

  // Group actions by slide index
  const actionsBySlide = new Map<number, DesignEditAction[]>();
  for (const action of parsedActions) {
    // Extract slide index from the action — use target if it contains slide ref
    const slideIdx = extractSlideIndex(action, modifiedSlides.length);
    if (slideIdx === -1) {
      // Apply to all slides
      for (let i = 0; i < modifiedSlides.length; i++) {
        const list = actionsBySlide.get(i) ?? [];
        list.push(action);
        actionsBySlide.set(i, list);
      }
    } else if (slideIdx < modifiedSlides.length) {
      const list = actionsBySlide.get(slideIdx) ?? [];
      list.push(action);
      actionsBySlide.set(slideIdx, list);
    }
  }

  // Apply edits per slide
  for (const [slideIdx, actions] of actionsBySlide) {
    const slide = modifiedSlides[slideIdx]!;

    try {
      if (slide.templateId && slide.renderSpec) {
        // Path A: Modify renderSpec and re-render
        modifiedSlides[slideIdx] = await applyTemplateEdits(slide, actions);
      } else {
        // Path B: LLM modifies HTML directly
        modifiedSlides[slideIdx] = await applyGeneratedEdits(
          slide, actions, instructions, kit, opts,
        );
      }
    } catch (err) {
      // If edit fails, keep original slide
      console.error(`Edit failed for slide ${slideIdx}:`, err);
    }
  }

  return {
    ...designResult,
    slides: modifiedSlides,
  };
}

// ── Path A: Template-based edits ────────────────────────

async function applyTemplateEdits(
  slide: SlideDesign,
  actions: DesignEditAction[],
): Promise<SlideDesign> {
  const spec = { ...slide.renderSpec! };

  for (const action of actions) {
    applyActionToRenderSpec(spec, action);
  }

  // Re-render with modified spec
  const html = await resolveTemplateToHtml(slide.templateId!, spec);

  return {
    ...slide,
    jsxCode: html,
    renderSpec: spec,
  };
}

/** Map a DesignEditAction to a renderSpec property change */
function applyActionToRenderSpec(
  spec: Record<string, unknown>,
  action: DesignEditAction,
): void {
  const { target, property, action: act, value } = action;

  // Direct property mapping
  const specKeyMap: Record<string, Record<string, string>> = {
    background: { color: "bgGradient", gradient: "bgGradient" },
    title: { fontSize: "titleSizePx", fontWeight: "titleWeight", color: "textColor" },
    body: { fontSize: "bodySizePx", fontWeight: "bodyWeight", color: "textColor" },
    footer: { color: "footerColor", text: "footerText" },
    accent: { color: "accentColor" },
  };

  const specKey = specKeyMap[target]?.[property];
  if (!specKey) return;

  if (act === "change" && value !== undefined) {
    spec[specKey] = value;
  } else if (act === "increase" && typeof value === "number") {
    const current = typeof spec[specKey] === "number" ? (spec[specKey] as number) : 0;
    spec[specKey] = current > 0 ? Math.round(current * (value > 10 ? value / current : value)) : value;
  } else if (act === "decrease" && typeof value === "number") {
    const current = typeof spec[specKey] === "number" ? (spec[specKey] as number) : 0;
    spec[specKey] = current > 0 ? Math.round(current * (value < 1 ? value : value / current)) : value;
  } else if (value !== undefined) {
    spec[specKey] = value;
  }
}

// ── Path B: LLM-based HTML edits ────────────────────────

async function applyGeneratedEdits(
  slide: SlideDesign,
  actions: DesignEditAction[],
  instructions: string,
  kit: BrandKit,
  opts?: EditApplyOptions,
): Promise<SlideDesign> {
  const actionDescriptions = actions
    .map((a) => `- ${a.target}.${a.property}: ${a.action}${a.value !== undefined ? ` → ${String(a.value)}` : ""}`)
    .join("\n");

  const prompt = `You are a design editor. Modify the following Satori-compatible HTML based on the edit instructions.

=== CURRENT HTML ===
${slide.jsxCode}

=== CANVAS ===
Width: ${slide.width}px, Height: ${slide.height}px

=== EDIT INSTRUCTIONS ===
${instructions}

=== PARSED ACTIONS ===
${actionDescriptions}

=== SATORI CONSTRAINTS (MUST FOLLOW) ===
- Every element MUST have display:flex
- Use inline styles only (style="...")
- Use px values (not rem/em)
- Root div must have exact width:${slide.width}px;height:${slide.height}px
- FORBIDDEN: ${SATORI_UNSUPPORTED_CSS.join(", ")}
- No <br>, <hr>, no class names, no <style> tags

=== OUTPUT ===
Return ONLY the modified HTML string. No markdown fences, no explanation.
Preserve the overall structure — only change what the instructions specify.
Start with <div style="display:flex; and end with </div>.`;

  const raw = await callGptSafe(prompt, {
    model: opts?.model ?? "gpt-4o-mini",
    temperature: 0.5,
    maxTokens: 2500,
  });

  const modifiedHtml = raw.replace(/```html?\n?/g, "").replace(/```/g, "").trim();

  // Validate: must start with <div and contain style=
  if (!modifiedHtml.startsWith("<div") || !modifiedHtml.includes("style=")) {
    throw new Error("LLM returned invalid HTML — does not start with <div or missing styles");
  }

  return {
    ...slide,
    jsxCode: modifiedHtml,
    templateId: undefined,   // no longer template-based after LLM edit
    renderSpec: undefined,
  };
}

// ── Helpers ─────────────────────────────────────────────

/** Extract slide index from action target (e.g., "slide_3" → 3) */
function extractSlideIndex(action: DesignEditAction, totalSlides: number): number {
  // Check if target contains slide reference
  const match = action.target.match(/slide[_\s]*(\d+)/i);
  if (match) return parseInt(match[1]!, 10);

  // "all" or "전체" targets apply to all slides
  if (action.target === "all" || action.target.includes("전체")) return -1;

  // Default: apply to first slide for single-slide targets
  return totalSlides === 1 ? 0 : -1;
}

/**
 * Convenience: parse + apply in one call.
 * Combines parseEditInstructions and applyEdits.
 */
export async function interpretAndApply(
  designResult: VisualDesignResult,
  instructions: string,
  opts?: EditApplyOptions & { model?: string },
): Promise<{ result: VisualDesignResult; editRequest: DesignEditRequest }> {
  const editRequest = await parseEditInstructions(
    instructions,
    designResult.slides,
    opts,
  );

  const result = await applyEdits(
    designResult,
    instructions,
    editRequest.actions,
    opts,
  );

  return { result, editRequest };
}
