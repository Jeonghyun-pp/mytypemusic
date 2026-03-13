"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { Layer, TextLayer, ShapeLayer, ImageLayer } from "@/lib/studio/designEditor/layerTypes";
import TextToolbar from "./TextToolbar";

// ── Props ───────────────────────────────────────────────

interface LayerCanvasProps {
  layers: Layer[];
  canvasWidth: number;
  canvasHeight: number;
  background: string;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
  /** Multi-select support */
  selectedLayerIds?: string[];
  onSelectLayers?: (ids: string[]) => void;
  /** Delete selected layers */
  onDeleteLayers?: (ids: string[]) => void;
  /** Duplicate selected layers */
  onDuplicateLayers?: (ids: string[]) => void;
}

type DragMode =
  | "move"
  | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se"
  | "resize-n" | "resize-s" | "resize-e" | "resize-w"
  | "rotate"
  | "marquee"
  | "crop-pan";

interface DragState {
  mode: DragMode;
  layerId: string; // "" for marquee
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  origRotation: number;
  shiftKey?: boolean;
  /** Original positions of all selected layers (for multi-move) */
  origPositions?: Map<string, { x: number; y: number }>;
}

// ── Snap Guide Types ────────────────────────────────────

interface SnapGuide {
  axis: "x" | "y";
  position: number; // canvas coordinate
}

const SNAP_THRESHOLD = 5;
const HANDLE_SIZE = 8;

// ── Snap Calculation ────────────────────────────────────

function computeSnap(
  movingRect: { x: number; y: number; w: number; h: number },
  otherLayers: Layer[],
  canvasW: number,
  canvasH: number,
  dragLayerIds: Set<string>,
): { dx: number; dy: number; guides: SnapGuide[] } {
  const candidates: { axis: "x" | "y"; target: number; source: number }[] = [];

  const mx = movingRect.x;
  const my = movingRect.y;
  const mw = movingRect.w;
  const mh = movingRect.h;
  const mcx = mx + mw / 2;
  const mcy = my + mh / 2;
  const mr = mx + mw;
  const mb = my + mh;

  // Canvas edge + center snaps
  const xTargets = [0, canvasW / 2, canvasW];
  const yTargets = [0, canvasH / 2, canvasH];

  for (const xt of xTargets) {
    candidates.push({ axis: "x", target: xt, source: mx });
    candidates.push({ axis: "x", target: xt, source: mcx });
    candidates.push({ axis: "x", target: xt, source: mr });
  }
  for (const yt of yTargets) {
    candidates.push({ axis: "y", target: yt, source: my });
    candidates.push({ axis: "y", target: yt, source: mcy });
    candidates.push({ axis: "y", target: yt, source: mb });
  }

  // Other layer edges + centers
  for (const layer of otherLayers) {
    if (dragLayerIds.has(layer.id) || !layer.visible) continue;
    const lx = layer.x;
    const ly = layer.y;
    const lw = layer.width;
    const lh = layer.height;
    const lcx = lx + lw / 2;
    const lcy = ly + lh / 2;

    for (const xt of [lx, lcx, lx + lw]) {
      candidates.push({ axis: "x", target: xt, source: mx });
      candidates.push({ axis: "x", target: xt, source: mcx });
      candidates.push({ axis: "x", target: xt, source: mr });
    }
    for (const yt of [ly, lcy, ly + lh]) {
      candidates.push({ axis: "y", target: yt, source: my });
      candidates.push({ axis: "y", target: yt, source: mcy });
      candidates.push({ axis: "y", target: yt, source: mb });
    }
  }

  // Find best snap for each axis
  let bestX: { delta: number; guide: number } | null = null;
  let bestY: { delta: number; guide: number } | null = null;

  for (const c of candidates) {
    const delta = c.target - c.source;
    if (Math.abs(delta) > SNAP_THRESHOLD) continue;
    if (c.axis === "x") {
      if (!bestX || Math.abs(delta) < Math.abs(bestX.delta)) {
        bestX = { delta, guide: c.target };
      }
    } else {
      if (!bestY || Math.abs(delta) < Math.abs(bestY.delta)) {
        bestY = { delta, guide: c.target };
      }
    }
  }

  const guides: SnapGuide[] = [];
  if (bestX) guides.push({ axis: "x", position: bestX.guide });
  if (bestY) guides.push({ axis: "y", position: bestY.guide });

  return {
    dx: bestX?.delta ?? 0,
    dy: bestY?.delta ?? 0,
    guides,
  };
}

// ── Editable Text ───────────────────────────────────────

function EditableTextContent({
  text,
  style,
  onCommit,
}: {
  text: string;
  style: React.CSSProperties;
  onCommit: (text: string) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  const commit = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    onCommit(el.innerText);
  }, [onCommit]);

  return (
    <div
      ref={elRef}
      contentEditable
      suppressContentEditableWarning
      style={style}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          commit();
        }
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {text}
    </div>
  );
}

// ── Layer Rendering ─────────────────────────────────────

function getLayerDisplayStyle(layer: Layer): React.CSSProperties {
  return {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    opacity: layer.opacity,
    transformOrigin: "center center",
    transform: `rotate(${String(layer.rotation)}deg) scale(${String(layer.scale)})`,
    mixBlendMode: layer.blendMode as React.CSSProperties["mixBlendMode"],
    pointerEvents: layer.locked ? "none" : "auto",
    cursor: layer.locked ? "default" : "move",
  };
}

function getLayerContent(layer: Layer, isEditing?: boolean, onEditCommit?: (text: string) => void): React.ReactNode {
  switch (layer.kind) {
    case "text": {
      const tl = layer as TextLayer;
      if (isEditing) {
        return (
          <EditableTextContent
            text={tl.text}
            style={{
              width: "100%", height: "100%",
              fontFamily: tl.fontFamily ?? "Pretendard, sans-serif",
              fontSize: tl.fontSize, fontWeight: tl.fontWeight,
              color: tl.color, textAlign: tl.textAlign,
              lineHeight: tl.lineHeight,
              letterSpacing: `${String(tl.letterSpacing)}px`,
              wordBreak: "keep-all", overflow: "hidden",
              outline: "none", cursor: "text",
            }}
            onCommit={onEditCommit!}
          />
        );
      }
      return (
        <div
          style={{
            width: "100%", height: "100%",
            fontFamily: tl.fontFamily ?? "Pretendard, sans-serif",
            fontSize: tl.fontSize, fontWeight: tl.fontWeight,
            color: tl.color, textAlign: tl.textAlign,
            lineHeight: tl.lineHeight,
            letterSpacing: `${String(tl.letterSpacing)}px`,
            wordBreak: "keep-all", overflow: "hidden",
            userSelect: "none",
          }}
        >
          {tl.text}
        </div>
      );
    }
    case "image": {
      const il = layer as ImageLayer;
      if (!il.src) {
        return (
          <div style={{
            width: "100%", height: "100%",
            background: "repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50%/20px 20px",
            borderRadius: il.borderRadius,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "12px", color: "#999",
          }}>
            Image
          </div>
        );
      }
      const zoom = il.cropZoom ?? 1;
      const cropX = il.cropX ?? 0;
      const cropY = il.cropY ?? 0;
      const flipTransform = [
        il.flipH ? "scaleX(-1)" : "",
        il.flipV ? "scaleY(-1)" : "",
      ].filter(Boolean).join(" ");
      return (
        <div style={{
          width: "100%", height: "100%",
          overflow: "hidden",
          borderRadius: il.borderRadius,
        }}>
          <img
            src={il.src}
            alt=""
            style={{
              width: `${String(zoom * 100)}%`,
              height: `${String(zoom * 100)}%`,
              objectFit: il.objectFit,
              objectPosition: `${String(-cropX)}px ${String(-cropY)}px`,
              display: "block",
              userSelect: "none",
              pointerEvents: "none",
              transform: flipTransform || undefined,
            }}
            draggable={false}
          />
        </div>
      );
    }
    case "shape": {
      const sl = layer as ShapeLayer;
      const borderStr = sl.stroke && sl.strokeWidth > 0
        ? `${String(sl.strokeWidth)}px solid ${sl.stroke}`
        : "none";
      if (sl.shapeType === "circle") {
        return <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: sl.fill, border: borderStr }} />;
      }
      return <div style={{ width: "100%", height: "100%", borderRadius: sl.borderRadius, background: sl.fill, border: borderStr }} />;
    }
    case "svg-path":
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${String(layer.width)} ${String(layer.height)}`}>
          <path d={layer.pathData} fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
        </svg>
      );
    default:
      return null;
  }
}

// ── Multi-select bounding box ───────────────────────────

function getMultiSelectBounds(layers: Layer[], ids: string[]): { x: number; y: number; w: number; h: number } | null {
  const selected = layers.filter((l) => ids.includes(l.id));
  if (selected.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const l of selected) {
    minX = Math.min(minX, l.x);
    minY = Math.min(minY, l.y);
    maxX = Math.max(maxX, l.x + l.width);
    maxY = Math.max(maxY, l.y + l.height);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ── Main Component ──────────────────────────────────────

export default function LayerCanvas({
  layers,
  canvasWidth,
  canvasHeight,
  background,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  selectedLayerIds: externalSelectedIds,
  onSelectLayers,
  onDeleteLayers,
  onDuplicateLayers,
}: LayerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewScale, setViewScale] = useState(1);
  const [drag, setDrag] = useState<DragState | null>(null);
  const didDragRef = useRef(false);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [cropLayerId, setCropLayerId] = useState<string | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Multi-select: use external state if provided, otherwise derive from single selectedLayerId
  const selectedIds = useMemo(() => {
    if (externalSelectedIds && externalSelectedIds.length > 0) return externalSelectedIds;
    return selectedLayerId ? [selectedLayerId] : [];
  }, [externalSelectedIds, selectedLayerId]);

  const setSelectedIds = useCallback((ids: string[]) => {
    if (onSelectLayers) {
      onSelectLayers(ids);
    }
    // Also update single selection for backwards compatibility
    if (ids.length === 1) {
      onSelectLayer(ids[0]!);
    } else if (ids.length === 0) {
      onSelectLayer(null);
    }
  }, [onSelectLayers, onSelectLayer]);

  // Calculate scale to fit canvas in container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const scaleX = (rect.width - 48) / canvasWidth;
      const scaleY = (rect.height - 48) / canvasHeight;
      setViewScale(Math.min(scaleX, scaleY, 1));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [canvasWidth, canvasHeight]);

  const toCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const offsetX = (rect.width - canvasWidth * viewScale) / 2;
      const offsetY = (rect.height - canvasHeight * viewScale) / 2;
      return {
        x: (clientX - rect.left - offsetX) / viewScale,
        y: (clientY - rect.top - offsetY) / viewScale,
      };
    },
    [canvasWidth, canvasHeight, viewScale],
  );

  // ── Keyboard shortcuts ──────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't handle shortcuts while editing text
      if (editingLayerId) return;

      const isCtrl = e.ctrlKey || e.metaKey;

      // Note: Undo/Redo (Ctrl+Z/Y) is handled by the parent DesignEditor

      // Delete
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) {
        e.preventDefault();
        onDeleteLayers?.(selectedIds);
        return;
      }

      // Duplicate
      if (isCtrl && e.key === "d" && selectedIds.length > 0) {
        e.preventDefault();
        onDuplicateLayers?.(selectedIds);
        return;
      }

      // Arrow nudge
      const nudge = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft" && selectedIds.length > 0) {
        e.preventDefault();
        for (const id of selectedIds) {
          const l = layers.find((la) => la.id === id);
          if (l && !l.locked) onUpdateLayer(id, { x: l.x - nudge } as Partial<Layer>);
        }
        return;
      }
      if (e.key === "ArrowRight" && selectedIds.length > 0) {
        e.preventDefault();
        for (const id of selectedIds) {
          const l = layers.find((la) => la.id === id);
          if (l && !l.locked) onUpdateLayer(id, { x: l.x + nudge } as Partial<Layer>);
        }
        return;
      }
      if (e.key === "ArrowUp" && selectedIds.length > 0) {
        e.preventDefault();
        for (const id of selectedIds) {
          const l = layers.find((la) => la.id === id);
          if (l && !l.locked) onUpdateLayer(id, { y: l.y - nudge } as Partial<Layer>);
        }
        return;
      }
      if (e.key === "ArrowDown" && selectedIds.length > 0) {
        e.preventDefault();
        for (const id of selectedIds) {
          const l = layers.find((la) => la.id === id);
          if (l && !l.locked) onUpdateLayer(id, { y: l.y + nudge } as Partial<Layer>);
        }
        return;
      }

      // Escape: exit crop mode first, then clear selection
      if (e.key === "Escape") {
        if (cropLayerId) {
          setCropLayerId(null);
          return;
        }
        setSelectedIds([]);
        setEditingLayerId(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingLayerId, cropLayerId, selectedIds, layers, onDeleteLayers, onDuplicateLayers, onUpdateLayer, setSelectedIds]);

  // ── Pointer handlers ────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, layerId: string, mode: DragMode) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const layer = layers.find((l) => l.id === layerId);
      if (!layer || layer.locked) return;

      // Multi-select with Shift
      if (e.shiftKey && mode === "move") {
        const newIds = selectedIds.includes(layerId)
          ? selectedIds.filter((id) => id !== layerId)
          : [...selectedIds, layerId];
        setSelectedIds(newIds);
        return;
      }

      // If clicking a non-selected layer, make it the sole selection
      if (!selectedIds.includes(layerId)) {
        setSelectedIds([layerId]);
        onSelectLayer(layerId);
      }

      didDragRef.current = true;

      const pos = toCanvasCoords(e.clientX, e.clientY);

      // Capture original positions for all currently selected layers
      const origPositions = new Map<string, { x: number; y: number }>();
      const activeIds = selectedIds.includes(layerId) ? selectedIds : [layerId];
      for (const id of activeIds) {
        const l = layers.find((la) => la.id === id);
        if (l) origPositions.set(id, { x: l.x, y: l.y });
      }

      // For crop-pan, store crop offsets instead of position
      const isCrop = mode === "crop-pan";
      const il = layer as ImageLayer;
      setDrag({
        mode,
        layerId,
        startX: pos.x,
        startY: pos.y,
        origX: isCrop ? (il.cropX ?? 0) : layer.x,
        origY: isCrop ? (il.cropY ?? 0) : layer.y,
        origW: layer.width,
        origH: layer.height,
        origRotation: layer.rotation,
        shiftKey: e.shiftKey,
        origPositions,
      });
    },
    [layers, toCanvasCoords, onSelectLayer, selectedIds, setSelectedIds],
  );

  // Start marquee selection on canvas background click
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.target !== e.currentTarget) return;
      const pos = toCanvasCoords(e.clientX, e.clientY);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDrag({
        mode: "marquee",
        layerId: "",
        startX: pos.x,
        startY: pos.y,
        origX: pos.x,
        origY: pos.y,
        origW: 0,
        origH: 0,
        origRotation: 0,
      });
      setMarqueeRect(null);
    },
    [toCanvasCoords],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const pos = toCanvasCoords(e.clientX, e.clientY);
      const dx = pos.x - drag.startX;
      const dy = pos.y - drag.startY;

      // Marquee selection
      if (drag.mode === "marquee") {
        const rx = Math.min(drag.startX, pos.x);
        const ry = Math.min(drag.startY, pos.y);
        const rw = Math.abs(pos.x - drag.startX);
        const rh = Math.abs(pos.y - drag.startY);
        setMarqueeRect({ x: rx, y: ry, w: rw, h: rh });
        return;
      }

      const dragIds = selectedIds.includes(drag.layerId) ? selectedIds : [drag.layerId];
      const dragIdSet = new Set(dragIds);

      switch (drag.mode) {
        case "move": {
          const proposedX = drag.origX + dx;
          const proposedY = drag.origY + dy;
          const primaryLayer = layers.find((l) => l.id === drag.layerId);
          if (!primaryLayer) break;

          const snap = computeSnap(
            { x: proposedX, y: proposedY, w: primaryLayer.width, h: primaryLayer.height },
            layers,
            canvasWidth,
            canvasHeight,
            dragIdSet,
          );

          setSnapGuides(snap.guides);

          const snappedDx = dx + snap.dx;
          const snappedDy = dy + snap.dy;

          // Move all selected layers by the same snapped delta
          for (const id of dragIds) {
            const l = layers.find((la) => la.id === id);
            if (!l || l.locked) continue;
            const orig = drag.origPositions?.get(id);
            if (orig) {
              onUpdateLayer(id, {
                x: Math.round(orig.x + snappedDx),
                y: Math.round(orig.y + snappedDy),
              } as Partial<Layer>);
            }
          }
          break;
        }

        case "resize-se":
        case "resize-nw":
        case "resize-ne":
        case "resize-sw":
        case "resize-n":
        case "resize-s":
        case "resize-e":
        case "resize-w": {
          const shiftHeld = e.shiftKey || drag.shiftKey;
          let newX = drag.origX;
          let newY = drag.origY;
          let newW = drag.origW;
          let newH = drag.origH;

          const mode = drag.mode;
          const isRight = mode.includes("e");
          const isBottom = mode.includes("s");
          const isLeft = mode.includes("w");
          const isTop = mode.includes("n");

          if (isRight) newW = Math.max(20, drag.origW + dx);
          if (isLeft) { newX = drag.origX + dx; newW = Math.max(20, drag.origW - dx); }
          if (isBottom) newH = Math.max(20, drag.origH + dy);
          if (isTop) { newY = drag.origY + dy; newH = Math.max(20, drag.origH - dy); }

          // Aspect ratio lock when Shift held (corner handles only)
          if (shiftHeld && (mode.length > 8)) { // corner handles have mode like "resize-se"
            const aspect = drag.origW / drag.origH;
            if (Math.abs(dx) > Math.abs(dy)) {
              newH = Math.round(newW / aspect);
              if (isTop) newY = drag.origY + drag.origH - newH;
            } else {
              newW = Math.round(newH * aspect);
              if (isLeft) newX = drag.origX + drag.origW - newW;
            }
          }

          setSnapGuides([]); // No snap during resize for simplicity

          onUpdateLayer(drag.layerId, {
            x: Math.round(newX),
            y: Math.round(newY),
            width: Math.round(newW),
            height: Math.round(newH),
          } as Partial<Layer>);
          break;
        }

        case "rotate": {
          const layer = layers.find((l) => l.id === drag.layerId);
          if (!layer) break;
          const cx = layer.x + layer.width / 2;
          const cy = layer.y + layer.height / 2;
          const angle = Math.atan2(pos.y - cy, pos.x - cx) * (180 / Math.PI);
          const startAngle = Math.atan2(drag.startY - cy, drag.startX - cx) * (180 / Math.PI);
          let newRotation = drag.origRotation + angle - startAngle;
          // Snap to 0/45/90/... when Shift held
          if (e.shiftKey) {
            newRotation = Math.round(newRotation / 45) * 45;
          }
          onUpdateLayer(drag.layerId, {
            rotation: Math.round(newRotation),
          } as Partial<Layer>);
          break;
        }

        case "crop-pan": {
          // Pan image within its crop frame
          const layer = layers.find((l) => l.id === drag.layerId) as ImageLayer | undefined;
          if (!layer) break;
          onUpdateLayer(drag.layerId, {
            cropX: Math.round(drag.origX - dx),
            cropY: Math.round(drag.origY - dy),
          } as Partial<Layer>);
          break;
        }
      }
    },
    [drag, toCanvasCoords, onUpdateLayer, layers, canvasWidth, canvasHeight, selectedIds],
  );

  const handlePointerUp = useCallback(() => {
    // Finalize marquee selection
    if (drag?.mode === "marquee" && marqueeRect) {
      const { x, y, w, h } = marqueeRect;
      if (w > 5 || h > 5) {
        const hit = layers
          .filter((l) => l.visible && !l.locked)
          .filter((l) =>
            l.x < x + w && l.x + l.width > x &&
            l.y < y + h && l.y + l.height > y,
          )
          .map((l) => l.id);
        setSelectedIds(hit);
      }
    }

    setDrag(null);
    setSnapGuides([]);
    setMarqueeRect(null);
    requestAnimationFrame(() => { didDragRef.current = false; });
  }, [drag, marqueeRect, layers, setSelectedIds]);

  const sorted = useMemo(
    () => [...layers].filter((l) => l.visible).sort((a, b) => a.zIndex - b.zIndex),
    [layers],
  );

  const selectedLayer = selectedIds.length === 1 ? layers.find((l) => l.id === selectedIds[0]) : null;
  const multiBounds = selectedIds.length > 1 ? getMultiSelectBounds(layers, selectedIds) : null;

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-secondary)",
        overflow: "hidden",
        position: "relative",
        cursor: drag ? (drag.mode === "marquee" ? "crosshair" : "grabbing") : "default",
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={() => {
        if (!drag && !didDragRef.current) {
          if (cropLayerId) {
            setCropLayerId(null);
            return;
          }
          setSelectedIds([]);
          onSelectLayer(null);
          setEditingLayerId(null);
        }
      }}
      onWheel={(e) => {
        // Scroll-to-zoom in crop mode
        if (!cropLayerId) return;
        e.preventDefault();
        const layer = layers.find((l) => l.id === cropLayerId) as ImageLayer | undefined;
        if (!layer) return;
        const currentZoom = layer.cropZoom ?? 1;
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(0.1, Math.min(10, currentZoom + delta));
        onUpdateLayer(cropLayerId, { cropZoom: Math.round(newZoom * 100) / 100 } as Partial<Layer>);
      }}
      tabIndex={0}
    >
      {/* Canvas */}
      <div
        style={{
          width: canvasWidth,
          height: canvasHeight,
          background,
          position: "relative",
          transform: `scale(${String(viewScale)})`,
          transformOrigin: "center center",
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}
        onPointerDown={handleCanvasPointerDown}
      >
        {/* Layers */}
        {sorted.map((layer) => {
          const isEditing = editingLayerId === layer.id;
          const isSelected = selectedIds.includes(layer.id);
          return (
            <div
              key={layer.id}
              style={{
                ...getLayerDisplayStyle(layer),
                outline: cropLayerId === layer.id
                  ? "2px dashed #f59e0b"
                  : isSelected && selectedIds.length > 1
                    ? "1px solid var(--accent)"
                    : "none",
                outlineOffset: -1,
                cursor: cropLayerId === layer.id ? "grab" : undefined,
              }}
              onPointerDown={(e) => {
                if (isEditing) return;
                if (cropLayerId === layer.id) {
                  // In crop mode: pan the image
                  handlePointerDown(e, layer.id, "crop-pan");
                  return;
                }
                handlePointerDown(e, layer.id, "move");
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!isEditing && !e.shiftKey) {
                  setSelectedIds([layer.id]);
                  onSelectLayer(layer.id);
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (layer.locked) return;
                if (layer.kind === "text") {
                  setEditingLayerId(layer.id);
                } else if (layer.kind === "image" && (layer as ImageLayer).src) {
                  setCropLayerId(layer.id);
                }
              }}
            >
              {getLayerContent(layer, isEditing, (newText) => {
                onUpdateLayer(layer.id, { text: newText } as Partial<Layer>);
                setEditingLayerId(null);
              })}
            </div>
          );
        })}

        {/* Snap guide lines */}
        {snapGuides.map((guide, i) => (
          <div
            key={`guide-${guide.axis}-${i}`}
            style={{
              position: "absolute",
              ...(guide.axis === "x"
                ? { left: guide.position, top: 0, width: 1, height: canvasHeight }
                : { left: 0, top: guide.position, width: canvasWidth, height: 1 }),
              background: "#f43f5e",
              opacity: 0.7,
              pointerEvents: "none",
              zIndex: 9999,
            }}
          />
        ))}

        {/* Marquee selection rect */}
        {marqueeRect && marqueeRect.w > 2 && (
          <div
            style={{
              position: "absolute",
              left: marqueeRect.x,
              top: marqueeRect.y,
              width: marqueeRect.w,
              height: marqueeRect.h,
              border: "1px dashed var(--accent)",
              background: "rgba(16, 185, 129, 0.08)",
              pointerEvents: "none",
              zIndex: 9999,
            }}
          />
        )}

        {/* Single selection handles */}
        {selectedLayer && !selectedLayer.locked && !editingLayerId && selectedIds.length === 1 && (
          <div
            style={{
              position: "absolute",
              left: selectedLayer.x,
              top: selectedLayer.y,
              width: selectedLayer.width,
              height: selectedLayer.height,
              transform: `rotate(${String(selectedLayer.rotation)}deg)`,
              transformOrigin: "center center",
              pointerEvents: "none",
              zIndex: 9998,
            }}
          >
            {/* Selection border */}
            <div style={{ position: "absolute", inset: -1, border: "1px solid var(--accent)", pointerEvents: "none" }} />
            {/* Corner handles */}
            {(["nw", "ne", "sw", "se"] as const).map((corner) => {
              const isRight = corner.includes("e");
              const isBottom = corner.includes("s");
              return (
                <div
                  key={corner}
                  style={{
                    position: "absolute",
                    left: (isRight ? selectedLayer.width : 0) - HANDLE_SIZE / 2,
                    top: (isBottom ? selectedLayer.height : 0) - HANDLE_SIZE / 2,
                    width: HANDLE_SIZE, height: HANDLE_SIZE,
                    background: "#fff", border: "1.5px solid var(--accent)",
                    borderRadius: "2px", cursor: `${corner}-resize`,
                    pointerEvents: "auto",
                  }}
                  onPointerDown={(e) => handlePointerDown(e, selectedLayer.id, `resize-${corner}` as DragMode)}
                />
              );
            })}
            {/* Edge handles */}
            {(["n", "s", "e", "w"] as const).map((edge) => {
              const isHoriz = edge === "n" || edge === "s";
              const left = edge === "w" ? -HANDLE_SIZE / 2
                : edge === "e" ? selectedLayer.width - HANDLE_SIZE / 2
                : selectedLayer.width / 2 - HANDLE_SIZE / 2;
              const top = edge === "n" ? -HANDLE_SIZE / 2
                : edge === "s" ? selectedLayer.height - HANDLE_SIZE / 2
                : selectedLayer.height / 2 - HANDLE_SIZE / 2;
              return (
                <div
                  key={edge}
                  style={{
                    position: "absolute", left, top,
                    width: HANDLE_SIZE, height: HANDLE_SIZE,
                    background: "#fff", border: "1.5px solid var(--accent)",
                    borderRadius: "2px",
                    cursor: isHoriz ? "ns-resize" : "ew-resize",
                    pointerEvents: "auto",
                  }}
                  onPointerDown={(e) => handlePointerDown(e, selectedLayer.id, `resize-${edge}` as DragMode)}
                />
              );
            })}
            {/* Rotation handle */}
            <div
              style={{
                position: "absolute",
                left: selectedLayer.width / 2 - 6, top: -30,
                width: 12, height: 12,
                borderRadius: "50%",
                background: "var(--accent)", border: "2px solid #fff",
                cursor: "grab", pointerEvents: "auto",
              }}
              onPointerDown={(e) => handlePointerDown(e, selectedLayer.id, "rotate")}
            />
            <div
              style={{
                position: "absolute",
                left: selectedLayer.width / 2 - 0.5, top: -18,
                width: 1, height: 18,
                background: "var(--accent)", pointerEvents: "none",
              }}
            />
          </div>
        )}

        {/* Multi-select bounding box */}
        {multiBounds && selectedIds.length > 1 && (
          <div
            style={{
              position: "absolute",
              left: multiBounds.x - 1,
              top: multiBounds.y - 1,
              width: multiBounds.w + 2,
              height: multiBounds.h + 2,
              border: "1px dashed var(--accent)",
              pointerEvents: "none",
              zIndex: 9998,
            }}
          />
        )}
      </div>

      {/* Text toolbar — floats above canvas when editing or selecting a text layer */}
      {selectedLayer && selectedLayer.kind === "text" && !cropLayerId && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10000,
          }}
        >
          <TextToolbar
            layer={selectedLayer as TextLayer}
            onUpdate={(patch) => onUpdateLayer(selectedLayer.id, patch)}
          />
        </div>
      )}
    </div>
  );
}
