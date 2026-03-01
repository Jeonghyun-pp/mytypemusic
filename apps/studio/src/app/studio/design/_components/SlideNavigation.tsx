"use client";

import type { DesignSpec } from "@/lib/studio/designEditor/types";

interface SlideNavigationProps {
  spec: DesignSpec;
  onSelectSlide: (idx: number) => void;
  onAddSlide: () => void;
  onRemoveSlide: (idx: number) => void;
}

const s = {
  bar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 20px",
    borderTop: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    overflowX: "auto" as const,
    flexShrink: 0,
  } as const,
  thumb: {
    width: "48px",
    height: "60px",
    borderRadius: "10px",
    borderWidth: "2px",
    borderStyle: "solid",
    borderColor: "transparent",
    background: "var(--bg-input)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-muted)",
    flexShrink: 0,
    transition: "all var(--transition)",
  } as const,
  thumbActive: {
    borderColor: "var(--accent)",
    color: "var(--accent)",
    background: "var(--accent-light)",
  } as const,
  label: {
    fontSize: "11px",
    color: "var(--text-muted)",
    marginRight: "8px",
    flexShrink: 0,
  } as const,
  arrows: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    marginLeft: "auto",
    flexShrink: 0,
  } as const,
  arrowBtn: {
    width: "34px",
    height: "34px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    color: "var(--text)",
    transition: "all var(--transition)",
  } as const,
  addBtn: {
    width: "48px",
    height: "60px",
    borderRadius: "10px",
    border: "2px dashed var(--border-light)",
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    color: "var(--text-muted)",
    flexShrink: 0,
    transition: "all var(--transition)",
  } as const,
  removeBtn: {
    position: "absolute" as const,
    top: "-6px",
    right: "-6px",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    border: "none",
    background: "var(--red)",
    color: "#fff",
    fontSize: "10px",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0,
    transition: "opacity var(--transition)",
  } as const,
  thumbWrap: {
    position: "relative" as const,
    flexShrink: 0,
  } as const,
};

export default function SlideNavigation({ spec, onSelectSlide, onAddSlide, onRemoveSlide }: SlideNavigationProps) {
  const { slides, currentSlideIndex } = spec;
  const canPrev = currentSlideIndex > 0;
  const canNext = currentSlideIndex < slides.length - 1;
  const canAdd = slides.length < 10;
  const canRemove = slides.length > 1;

  return (
    <div style={s.bar}>
      <span style={s.label}>Slides</span>
      {slides.map((slide, i) => (
        <div
          key={i}
          style={s.thumbWrap}
          onMouseEnter={(e) => {
            const rmBtn = e.currentTarget.querySelector("[data-rm]") as HTMLElement | null;
            if (rmBtn) rmBtn.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            const rmBtn = e.currentTarget.querySelector("[data-rm]") as HTMLElement | null;
            if (rmBtn) rmBtn.style.opacity = "0";
          }}
        >
          <button
            type="button"
            style={{ ...s.thumb, ...(i === currentSlideIndex ? s.thumbActive : {}) }}
            onClick={() => onSelectSlide(i)}
            title={`Slide ${String(i + 1)} (${slide.kind})`}
          >
            {String(i + 1)}
          </button>
          {canRemove && (
            <button
              type="button"
              data-rm=""
              style={s.removeBtn}
              onClick={(e) => {
                e.stopPropagation();
                onRemoveSlide(i);
              }}
              title={`Slide ${String(i + 1)} 삭제`}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {canAdd && (
        <button
          type="button"
          style={s.addBtn}
          onClick={onAddSlide}
          title="슬라이드 추가"
        >
          +
        </button>
      )}
      <div style={s.arrows}>
        <button
          type="button"
          style={{ ...s.arrowBtn, opacity: canPrev ? 1 : 0.3 }}
          disabled={!canPrev}
          onClick={() => canPrev && onSelectSlide(currentSlideIndex - 1)}
        >
          ‹
        </button>
        <button
          type="button"
          style={{ ...s.arrowBtn, opacity: canNext ? 1 : 0.3 }}
          disabled={!canNext}
          onClick={() => canNext && onSelectSlide(currentSlideIndex + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
