"use client";

import { useState, useRef, useCallback } from "react";

/** Canvas coordinates (px) for the 1080x1350 Instagram canvas */
export interface CanvasRegion {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  imageDataUri: string;
  region: CanvasRegion | null;
  onRegionChange: (region: CanvasRegion | null) => void;
}

const CANVAS_W = 1080;
const CANVAS_H = 1350;

/**
 * 이미지 위에서 드래그하여 배경 사진(hero) 영역을 지정하는 컴포넌트.
 * 좌표는 1080x1350 캔버스 기준 px로 변환되어 반환된다.
 */
export default function HeroRegionSelector({ imageDataUri, region, onRegionChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  // Normalized 0-1 coordinates during drag
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCur, setDragCur] = useState<{ x: number; y: number } | null>(null);

  /** Convert a mouse event to normalized (0-1) coordinates within the container */
  const toNorm = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }, []);

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const p = toNorm(e);
    setDragStart(p);
    setDragCur(p);
    setDragging(true);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    setDragCur(toNorm(e));
  }

  function handleMouseUp() {
    if (!dragging || !dragStart || !dragCur) return;
    setDragging(false);

    const x1 = Math.min(dragStart.x, dragCur.x);
    const y1 = Math.min(dragStart.y, dragCur.y);
    const x2 = Math.max(dragStart.x, dragCur.x);
    const y2 = Math.max(dragStart.y, dragCur.y);
    const w = x2 - x1;
    const h = y2 - y1;

    // 너무 작은 선택은 무시 (실수 클릭)
    if (w < 0.03 || h < 0.03) return;

    onRegionChange({
      left: Math.round(x1 * CANVAS_W),
      top: Math.round(y1 * CANVAS_H),
      width: Math.round(w * CANVAS_W),
      height: Math.round(h * CANVAS_H),
    });

    setDragStart(null);
    setDragCur(null);
  }

  function handleSelectAll() {
    onRegionChange({ top: 0, left: 0, width: CANVAS_W, height: CANVAS_H });
    setDragStart(null);
    setDragCur(null);
  }

  function handleClear() {
    onRegionChange(null);
    setDragStart(null);
    setDragCur(null);
  }

  // ── Selection rectangle (normalized 0-1) ──────────────
  let sel: { x: number; y: number; w: number; h: number } | null = null;

  if (dragging && dragStart && dragCur) {
    // Live drag
    const x1 = Math.min(dragStart.x, dragCur.x);
    const y1 = Math.min(dragStart.y, dragCur.y);
    sel = {
      x: x1,
      y: y1,
      w: Math.max(dragStart.x, dragCur.x) - x1,
      h: Math.max(dragStart.y, dragCur.y) - y1,
    };
  } else if (region) {
    // Committed region → normalize
    sel = {
      x: region.left / CANVAS_W,
      y: region.top / CANVAS_H,
      w: region.width / CANVAS_W,
      h: region.height / CANVAS_H,
    };
  }

  return (
    <div style={st.wrapper}>
      <p style={st.hint}>사진 영역을 드래그하세요</p>
      <div
        ref={containerRef}
        style={st.container}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageDataUri} alt="region select" style={st.img} draggable={false} />

        {/* Dim overlay + selection hole */}
        {sel && sel.w > 0 && sel.h > 0 && (
          <>
            {/* Top */}
            <div style={{
              ...st.dim,
              top: 0, left: 0, right: 0,
              height: `${sel.y * 100}%`,
            }} />
            {/* Left */}
            <div style={{
              ...st.dim,
              top: `${sel.y * 100}%`, left: 0,
              width: `${sel.x * 100}%`,
              height: `${sel.h * 100}%`,
            }} />
            {/* Right */}
            <div style={{
              ...st.dim,
              top: `${sel.y * 100}%`,
              left: `${(sel.x + sel.w) * 100}%`,
              right: 0,
              height: `${sel.h * 100}%`,
            }} />
            {/* Bottom */}
            <div style={{
              ...st.dim,
              left: 0, right: 0,
              top: `${(sel.y + sel.h) * 100}%`,
              bottom: 0,
            }} />
            {/* Selection border */}
            <div style={{
              position: "absolute",
              top: `${sel.y * 100}%`,
              left: `${sel.x * 100}%`,
              width: `${sel.w * 100}%`,
              height: `${sel.h * 100}%`,
              border: "2px solid var(--accent)",
              borderRadius: "2px",
              pointerEvents: "none",
              boxSizing: "border-box",
            }} />
          </>
        )}
      </div>

      <div style={st.btnRow}>
        <button type="button" style={st.btn} onClick={handleSelectAll}>전체 선택</button>
        <button type="button" style={st.btn} onClick={handleClear}>초기화</button>
        {region && (
          <span style={st.info}>
            {region.left},{region.top} — {region.width}x{region.height}px
          </span>
        )}
      </div>
    </div>
  );
}

const st = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  } as React.CSSProperties,

  hint: {
    fontSize: "11px",
    color: "var(--text-muted)",
    margin: 0,
  } as React.CSSProperties,

  container: {
    position: "relative" as const,
    width: "100%",
    aspectRatio: "4 / 5",
    borderRadius: "8px",
    overflow: "hidden",
    cursor: "crosshair",
    background: "var(--bg-secondary)",
    userSelect: "none" as const,
  } as React.CSSProperties,

  img: {
    width: "100%",
    height: "100%",
    objectFit: "contain" as const,
    display: "block",
    pointerEvents: "none" as const,
  } as React.CSSProperties,

  dim: {
    position: "absolute" as const,
    background: "rgba(0,0,0,0.45)",
    pointerEvents: "none" as const,
  } as React.CSSProperties,

  btnRow: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
  } as React.CSSProperties,

  btn: {
    padding: "4px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text-muted)",
    fontSize: "11px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  info: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    marginLeft: "auto",
  } as React.CSSProperties,
};
