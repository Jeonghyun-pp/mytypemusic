"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { Layer, TextLayer, ShapeLayer, ImageLayer } from "@/lib/studio/designEditor/layerTypes";

interface LayerCanvasProps {
  layers: Layer[];
  canvasWidth: number;
  canvasHeight: number;
  background: string;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
}

type DragMode = "move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se" | "resize-n" | "resize-s" | "resize-e" | "resize-w" | "rotate";

interface DragState {
  mode: DragMode;
  layerId: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  origRotation: number;
}

const HANDLE_SIZE = 8;

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
    // Select all text
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
        // Stop propagation to prevent undo/redo shortcuts while editing
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {text}
    </div>
  );
}

function getLayerDisplayStyle(layer: Layer): React.CSSProperties {
  const base: React.CSSProperties = {
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

  return base;
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
              width: "100%",
              height: "100%",
              fontFamily: tl.fontFamily ?? "Pretendard, sans-serif",
              fontSize: tl.fontSize,
              fontWeight: tl.fontWeight,
              color: tl.color,
              textAlign: tl.textAlign,
              lineHeight: tl.lineHeight,
              letterSpacing: `${String(tl.letterSpacing)}px`,
              wordBreak: "keep-all",
              overflow: "hidden",
              outline: "none",
              cursor: "text",
            }}
            onCommit={onEditCommit!}
          />
        );
      }
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            fontFamily: tl.fontFamily ?? "Pretendard, sans-serif",
            fontSize: tl.fontSize,
            fontWeight: tl.fontWeight,
            color: tl.color,
            textAlign: tl.textAlign,
            lineHeight: tl.lineHeight,
            letterSpacing: `${String(tl.letterSpacing)}px`,
            wordBreak: "keep-all",
            overflow: "hidden",
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
      return (
        <img
          src={il.src}
          alt=""
          style={{
            width: "100%", height: "100%",
            objectFit: il.objectFit,
            borderRadius: il.borderRadius,
            display: "block",
            userSelect: "none",
            pointerEvents: "none",
          }}
          draggable={false}
        />
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

export default function LayerCanvas({
  layers,
  canvasWidth,
  canvasHeight,
  background,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
}: LayerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewScale, setViewScale] = useState(1);
  const [drag, setDrag] = useState<DragState | null>(null);
  const didDragRef = useRef(false);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);

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

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, layerId: string, mode: DragMode) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const layer = layers.find((l) => l.id === layerId);
      if (!layer || layer.locked) return;

      onSelectLayer(layerId);
      didDragRef.current = true;

      const pos = toCanvasCoords(e.clientX, e.clientY);
      setDrag({
        mode,
        layerId,
        startX: pos.x,
        startY: pos.y,
        origX: layer.x,
        origY: layer.y,
        origW: layer.width,
        origH: layer.height,
        origRotation: layer.rotation,
      });
    },
    [layers, toCanvasCoords, onSelectLayer],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const pos = toCanvasCoords(e.clientX, e.clientY);
      const dx = pos.x - drag.startX;
      const dy = pos.y - drag.startY;

      switch (drag.mode) {
        case "move":
          onUpdateLayer(drag.layerId, {
            x: Math.round(drag.origX + dx),
            y: Math.round(drag.origY + dy),
          } as Partial<Layer>);
          break;

        case "resize-se":
          onUpdateLayer(drag.layerId, {
            width: Math.max(20, Math.round(drag.origW + dx)),
            height: Math.max(20, Math.round(drag.origH + dy)),
          } as Partial<Layer>);
          break;

        case "resize-nw":
          onUpdateLayer(drag.layerId, {
            x: Math.round(drag.origX + dx),
            y: Math.round(drag.origY + dy),
            width: Math.max(20, Math.round(drag.origW - dx)),
            height: Math.max(20, Math.round(drag.origH - dy)),
          } as Partial<Layer>);
          break;

        case "resize-ne":
          onUpdateLayer(drag.layerId, {
            y: Math.round(drag.origY + dy),
            width: Math.max(20, Math.round(drag.origW + dx)),
            height: Math.max(20, Math.round(drag.origH - dy)),
          } as Partial<Layer>);
          break;

        case "resize-sw":
          onUpdateLayer(drag.layerId, {
            x: Math.round(drag.origX + dx),
            width: Math.max(20, Math.round(drag.origW - dx)),
            height: Math.max(20, Math.round(drag.origH + dy)),
          } as Partial<Layer>);
          break;

        case "resize-n":
          onUpdateLayer(drag.layerId, {
            y: Math.round(drag.origY + dy),
            height: Math.max(20, Math.round(drag.origH - dy)),
          } as Partial<Layer>);
          break;

        case "resize-s":
          onUpdateLayer(drag.layerId, {
            height: Math.max(20, Math.round(drag.origH + dy)),
          } as Partial<Layer>);
          break;

        case "resize-e":
          onUpdateLayer(drag.layerId, {
            width: Math.max(20, Math.round(drag.origW + dx)),
          } as Partial<Layer>);
          break;

        case "resize-w":
          onUpdateLayer(drag.layerId, {
            x: Math.round(drag.origX + dx),
            width: Math.max(20, Math.round(drag.origW - dx)),
          } as Partial<Layer>);
          break;

        case "rotate": {
          const layer = layers.find((l) => l.id === drag.layerId);
          if (!layer) break;
          const cx = layer.x + layer.width / 2;
          const cy = layer.y + layer.height / 2;
          const angle = Math.atan2(pos.y - cy, pos.x - cx) * (180 / Math.PI);
          const startAngle = Math.atan2(drag.startY - cy, drag.startX - cx) * (180 / Math.PI);
          onUpdateLayer(drag.layerId, {
            rotation: Math.round(drag.origRotation + angle - startAngle),
          } as Partial<Layer>);
          break;
        }
      }
    },
    [drag, toCanvasCoords, onUpdateLayer, layers],
  );

  const handlePointerUp = useCallback(() => {
    setDrag(null);
    // Reset didDragRef after a microtask so the click handler can read it
    requestAnimationFrame(() => { didDragRef.current = false; });
  }, []);

  const sorted = useMemo(
    () => [...layers].filter((l) => l.visible).sort((a, b) => a.zIndex - b.zIndex),
    [layers],
  );

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

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
        cursor: drag ? "grabbing" : "default",
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={() => { if (!drag && !didDragRef.current) { onSelectLayer(null); setEditingLayerId(null); } }}
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
      >
        {/* Layers */}
        {sorted.map((layer) => {
          const isEditing = editingLayerId === layer.id;
          return (
            <div
              key={layer.id}
              style={getLayerDisplayStyle(layer)}
              onPointerDown={(e) => {
                if (isEditing) return; // Don't drag while editing
                handlePointerDown(e, layer.id, "move");
              }}
              onClick={(e) => { e.stopPropagation(); if (!isEditing) onSelectLayer(layer.id); }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (layer.kind === "text" && !layer.locked) {
                  setEditingLayerId(layer.id);
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

        {/* Selection handles — wrapped in rotation-aware container */}
        {selectedLayer && !selectedLayer.locked && !editingLayerId && (
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
            <div
              style={{
                position: "absolute",
                inset: -1,
                border: "1px solid var(--accent)",
                pointerEvents: "none",
              }}
            />
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
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                    background: "#fff",
                    border: "1.5px solid var(--accent)",
                    borderRadius: "2px",
                    cursor: `${corner}-resize`,
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
                    position: "absolute",
                    left,
                    top,
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                    background: "#fff",
                    border: "1.5px solid var(--accent)",
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
                left: selectedLayer.width / 2 - 6,
                top: -30,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "var(--accent)",
                border: "2px solid #fff",
                cursor: "grab",
                pointerEvents: "auto",
              }}
              onPointerDown={(e) => handlePointerDown(e, selectedLayer.id, "rotate")}
            />
            {/* Line connecting rotation handle */}
            <div
              style={{
                position: "absolute",
                left: selectedLayer.width / 2 - 0.5,
                top: -18,
                width: 1,
                height: 18,
                background: "var(--accent)",
                pointerEvents: "none",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
