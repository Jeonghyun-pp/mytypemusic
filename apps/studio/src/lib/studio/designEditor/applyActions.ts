import type { DesignSpec, AiDesignAction, SlideSpec, SlideStyleOverrides } from "./types";
import { TEMPLATES } from "./templates";

/**
 * Apply a list of AI design actions to a DesignSpec, returning a new copy.
 */
export function applyActions(
  spec: DesignSpec,
  actions: AiDesignAction[],
): DesignSpec {
  let result: DesignSpec = structuredClone(spec);

  for (const action of actions) {
    result = applyOne(result, action);
  }
  return result;
}

function applyOne(spec: DesignSpec, action: AiDesignAction): DesignSpec {
  switch (action.action) {
    case "update_text":
      return applyUpdateText(spec, action);
    case "update_style":
      return applyUpdateStyle(spec, action);
    case "change_template":
      return applyChangeTemplate(spec, action);
    case "change_kind":
      return applyChangeKind(spec, action);
    case "add_slide":
      return applyAddSlide(spec, action);
    case "remove_slide":
      return applyRemoveSlide(spec, action);
    case "apply_global_style":
      return applyGlobalStyle(spec, action);
    case "update_html":
      return applyUpdateHtml(spec, action);
    default:
      return spec;
  }
}

function getSlide(spec: DesignSpec, idx: number | undefined): SlideSpec | undefined {
  const i = idx ?? spec.currentSlideIndex;
  return spec.slides[i];
}

function applyUpdateText(spec: DesignSpec, action: AiDesignAction): DesignSpec {
  const idx = action.slideIndex ?? spec.currentSlideIndex;
  const slide = spec.slides[idx];
  if (!slide) return spec;

  const next = { ...spec, slides: [...spec.slides] };
  next.slides[idx] = {
    ...slide,
    ...(action.textChanges?.title !== undefined && { title: action.textChanges.title }),
    ...(action.textChanges?.bodyText !== undefined && { bodyText: action.textChanges.bodyText }),
    ...(action.textChanges?.footerText !== undefined && { footerText: action.textChanges.footerText }),
  };
  return next;
}

function applyUpdateStyle(spec: DesignSpec, action: AiDesignAction): DesignSpec {
  if (!action.styleChanges) return spec;
  const idx = action.slideIndex ?? spec.currentSlideIndex;
  const slide = spec.slides[idx];
  if (!slide) return spec;

  const next = { ...spec, slides: [...spec.slides] };
  next.slides[idx] = {
    ...slide,
    styleOverrides: mergeStyle(slide.styleOverrides, action.styleChanges),
  };
  return next;
}

function applyChangeTemplate(spec: DesignSpec, action: AiDesignAction): DesignSpec {
  if (!action.templateId) return spec;
  const idx = action.slideIndex ?? spec.currentSlideIndex;
  const slide = spec.slides[idx];
  if (!slide) return spec;

  const tmpl = TEMPLATES[action.templateId];
  const next = { ...spec, slides: [...spec.slides] };
  next.slides[idx] = { ...slide, templateId: action.templateId, kind: tmpl.kind };
  return next;
}

function applyChangeKind(spec: DesignSpec, action: AiDesignAction): DesignSpec {
  if (!action.kind) return spec;
  const idx = action.slideIndex ?? spec.currentSlideIndex;
  const slide = spec.slides[idx];
  if (!slide) return spec;

  const next = { ...spec, slides: [...spec.slides] };
  next.slides[idx] = { ...slide, kind: action.kind };
  return next;
}

function applyAddSlide(spec: DesignSpec, action: AiDesignAction): DesignSpec {
  if (spec.slides.length >= 10) return spec;
  const insertAt = (action.slideIndex ?? spec.currentSlideIndex) + 1;

  const newSlide: SlideSpec = {
    slideIndex: insertAt,
    kind: action.kind ?? "fact",
    templateId: action.templateId ?? "body.fact.v1",
    title: action.textChanges?.title ?? "새 슬라이드",
    bodyText: action.textChanges?.bodyText ?? "내용을 입력하세요.",
    footerText: action.textChanges?.footerText ?? spec.slides[0]?.footerText ?? "",
    styleOverrides: action.styleChanges,
  };

  const slides = [...spec.slides];
  slides.splice(insertAt, 0, newSlide);
  // Re-index
  for (let i = 0; i < slides.length; i++) slides[i] = { ...slides[i]!, slideIndex: i };

  return { ...spec, slides, currentSlideIndex: insertAt };
}

function applyRemoveSlide(spec: DesignSpec, action: AiDesignAction): DesignSpec {
  if (spec.slides.length <= 1) return spec;
  const idx = action.slideIndex ?? spec.currentSlideIndex;

  const slides = spec.slides.filter((_, i) => i !== idx);
  for (let i = 0; i < slides.length; i++) slides[i] = { ...slides[i]!, slideIndex: i };

  const newIdx = Math.min(spec.currentSlideIndex, slides.length - 1);
  return { ...spec, slides, currentSlideIndex: newIdx };
}

function applyGlobalStyle(spec: DesignSpec, action: AiDesignAction): DesignSpec {
  if (!action.styleChanges) return spec;
  return {
    ...spec,
    globalStyle: mergeStyle(spec.globalStyle, action.styleChanges),
  };
}

function applyUpdateHtml(spec: DesignSpec, action: AiDesignAction): DesignSpec {
  if (!action.html) return spec;
  const idx = action.slideIndex ?? spec.currentSlideIndex;
  const slide = spec.slides[idx];
  if (!slide) return spec;

  const next = { ...spec, slides: [...spec.slides] };
  next.slides[idx] = { ...slide, customHtml: action.html };
  return next;
}

function mergeStyle(
  existing: SlideStyleOverrides | undefined,
  changes: SlideStyleOverrides,
): SlideStyleOverrides {
  return { ...existing, ...changes };
}
