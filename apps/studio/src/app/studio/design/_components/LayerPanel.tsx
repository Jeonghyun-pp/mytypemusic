"use client";

import { useState, useCallback, useMemo } from "react";
import type { Layer, TextLayer, ImageLayer, ShapeLayer, LayerKind } from "@/lib/studio/designEditor/layerTypes";
import { generateCurvePath, CURVE_PRESETS } from "@agents/shared/curvedText";
import type { CurvePreset } from "@agents/shared/curvedText";
import ColorPickerPopover from "./ColorPickerPopover";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface LayerPanelProps {
  layers: Layer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
  onAddLayer: (kind: LayerKind) => void;
  onRemoveLayer: (id: string) => void;
  onReorderLayer: (id: string, direction: "up" | "down") => void;
  onBulkReorderLayers?: (orderedIds: string[]) => void;
}

const s = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    flex: 1,
    overflow: "hidden",
  } as const,
  toolbar: {
    display: "flex",
    gap: "4px",
    padding: "8px 0",
    borderBottom: "1px solid var(--border-light)",
    flexShrink: 0,
  } as const,
  toolBtn: {
    padding: "5px 8px",
    borderRadius: "6px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    cursor: "pointer",
    fontSize: "11px",
    color: "var(--text-muted)",
    transition: "all var(--transition)",
  } as const,
  list: {
    flex: 1,
    overflowY: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
    padding: "4px 0",
  } as const,
  item: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 6px",
    borderRadius: "8px",
    border: "1px solid transparent",
    cursor: "pointer",
    fontSize: "12px",
    transition: "all var(--transition)",
  } as const,
  itemSelected: {
    border: "1px solid var(--accent)",
    background: "var(--accent-light)",
  } as const,
  itemName: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as const,
  kindBadge: {
    fontSize: "9px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    padding: "2px 5px",
    borderRadius: "4px",
    background: "var(--bg-input)",
    color: "var(--text-muted)",
    flexShrink: 0,
  } as const,
  iconBtn: {
    width: "22px",
    height: "22px",
    border: "none",
    background: "none",
    cursor: "pointer",
    fontSize: "13px",
    color: "var(--text-muted)",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
    transition: "all var(--transition)",
  } as const,
  section: {
    marginTop: "12px",
    borderTop: "1px solid var(--border-light)",
    paddingTop: "12px",
    flexShrink: 0,
  } as const,
  label: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    marginBottom: "6px",
    display: "block",
  } as const,
  propRow: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    marginBottom: "6px",
  } as const,
  propLabel: {
    fontSize: "11px",
    width: "50px",
    flexShrink: 0,
    color: "var(--text-muted)",
  } as const,
  propInput: {
    flex: 1,
    padding: "5px 8px",
    borderRadius: "6px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "12px",
    outline: "none",
  } as const,
  slider: {
    flex: 1,
    accentColor: "var(--accent)",
  } as const,
  sliderVal: {
    fontSize: "11px",
    color: "var(--text-muted)",
    width: "36px",
    textAlign: "right" as const,
    flexShrink: 0,
  } as const,
};

const KIND_LABELS: Record<LayerKind, string> = {
  text: "T",
  image: "I",
  shape: "S",
  "svg-path": "P",
};

function SortableLayerItem({
  layer,
  isSelected,
  onSelect,
  onToggleVisible,
  onToggleLocked,
}: {
  layer: Layer;
  isSelected: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id });

  const style: React.CSSProperties = {
    ...s.item,
    ...(isSelected ? s.itemSelected : {}),
    opacity: isDragging ? 0.5 : layer.visible ? 1 : 0.4,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} onClick={onSelect}>
      <span
        {...attributes}
        {...listeners}
        style={{
          cursor: "grab",
          fontSize: "11px",
          color: "var(--text-muted)",
          padding: "0 2px",
          flexShrink: 0,
          userSelect: "none",
        }}
        title="드래그하여 순서 변경"
      >
        ⠿
      </span>
      <span style={s.kindBadge}>{KIND_LABELS[layer.kind]}</span>
      <span style={s.itemName}>{layer.name}</span>
      <button
        type="button"
        style={s.iconBtn}
        title={layer.visible ? "숨기기" : "보이기"}
        onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}
      >
        {layer.visible ? "o" : "-"}
      </button>
      <button
        type="button"
        style={s.iconBtn}
        title={layer.locked ? "잠금 해제" : "잠금"}
        onClick={(e) => { e.stopPropagation(); onToggleLocked(); }}
      >
        {layer.locked ? "L" : "U"}
      </button>
    </div>
  );
}

export default function LayerPanel({
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onAddLayer,
  onRemoveLayer,
  onReorderLayer,
  onBulkReorderLayers,
}: LayerPanelProps) {
  const sorted = useMemo(
    () => [...layers].sort((a, b) => b.zIndex - a.zIndex),
    [layers],
  );
  const sortedIds = useMemo(() => sorted.map((l) => l.id), [sorted]);
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedIds.indexOf(active.id as string);
      const newIndex = sortedIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      // Build new order (sorted descending by visual position = descending zIndex)
      const newOrder = [...sortedIds];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, active.id as string);

      if (onBulkReorderLayers) {
        onBulkReorderLayers(newOrder);
      } else {
        // Fallback: assign zIndex values (highest first)
        const maxZ = newOrder.length;
        newOrder.forEach((id, i) => {
          onUpdateLayer(id, { zIndex: maxZ - i } as Partial<Layer>);
        });
      }
    },
    [sortedIds, onBulkReorderLayers, onUpdateLayer],
  );

  return (
    <div style={s.wrapper}>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <button type="button" style={s.toolBtn} onClick={() => onAddLayer("text")} title="텍스트 추가">
          T+
        </button>
        <button type="button" style={s.toolBtn} onClick={() => onAddLayer("shape")} title="도형 추가">
          +
        </button>
        <button type="button" style={s.toolBtn} onClick={() => onAddLayer("image")} title="이미지 추가">
          I+
        </button>
        {selectedLayerId && (
          <>
            <button type="button" style={s.toolBtn} onClick={() => onReorderLayer(selectedLayerId, "up")} title="위로">
              ^
            </button>
            <button type="button" style={s.toolBtn} onClick={() => onReorderLayer(selectedLayerId, "down")} title="아래로">
              v
            </button>
            <button
              type="button"
              style={{ ...s.toolBtn, color: "var(--red)", marginLeft: "auto" }}
              onClick={() => { onRemoveLayer(selectedLayerId); onSelectLayer(null); }}
            >
              x
            </button>
          </>
        )}
      </div>

      {/* Layer list */}
      <div style={s.list}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
            {sorted.map((layer) => (
              <SortableLayerItem
                key={layer.id}
                layer={layer}
                isSelected={selectedLayerId === layer.id}
                onSelect={() => onSelectLayer(layer.id)}
                onToggleVisible={() => onUpdateLayer(layer.id, { visible: !layer.visible } as Partial<Layer>)}
                onToggleLocked={() => onUpdateLayer(layer.id, { locked: !layer.locked } as Partial<Layer>)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {layers.length === 0 && (
          <div style={{ padding: "20px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
            레이어가 없습니다. 위 버튼으로 추가하세요.
          </div>
        )}
      </div>

      {/* Property Inspector (inline) */}
      {selectedLayer && (
        <div style={s.section}>
          <label style={s.label}>속성</label>

          {/* Name */}
          <div style={s.propRow}>
            <span style={s.propLabel}>이름</span>
            <input
              style={s.propInput}
              value={selectedLayer.name}
              onChange={(e) => onUpdateLayer(selectedLayer.id, { name: e.target.value } as Partial<Layer>)}
            />
          </div>

          {/* Position & Size */}
          <div style={s.propRow}>
            <span style={s.propLabel}>X</span>
            <input style={{ ...s.propInput, width: "50px", flex: "none" }} type="number" value={selectedLayer.x} onChange={(e) => onUpdateLayer(selectedLayer.id, { x: Number(e.target.value) } as Partial<Layer>)} />
            <span style={s.propLabel}>Y</span>
            <input style={{ ...s.propInput, width: "50px", flex: "none" }} type="number" value={selectedLayer.y} onChange={(e) => onUpdateLayer(selectedLayer.id, { y: Number(e.target.value) } as Partial<Layer>)} />
          </div>
          <div style={s.propRow}>
            <span style={s.propLabel}>W</span>
            <input style={{ ...s.propInput, width: "50px", flex: "none" }} type="number" value={selectedLayer.width} onChange={(e) => onUpdateLayer(selectedLayer.id, { width: Number(e.target.value) } as Partial<Layer>)} />
            <span style={s.propLabel}>H</span>
            <input style={{ ...s.propInput, width: "50px", flex: "none" }} type="number" value={selectedLayer.height} onChange={(e) => onUpdateLayer(selectedLayer.id, { height: Number(e.target.value) } as Partial<Layer>)} />
          </div>

          {/* Rotation & Scale */}
          <div style={s.propRow}>
            <span style={s.propLabel}>회전</span>
            <input type="range" min={-180} max={180} style={s.slider} value={selectedLayer.rotation} onChange={(e) => onUpdateLayer(selectedLayer.id, { rotation: Number(e.target.value) } as Partial<Layer>)} />
            <span style={s.sliderVal}>{String(selectedLayer.rotation)}</span>
          </div>

          {/* Opacity */}
          <div style={s.propRow}>
            <span style={s.propLabel}>투명도</span>
            <input type="range" min={0} max={1} step={0.05} style={s.slider} value={selectedLayer.opacity} onChange={(e) => onUpdateLayer(selectedLayer.id, { opacity: Number(e.target.value) } as Partial<Layer>)} />
            <span style={s.sliderVal}>{String(Math.round(selectedLayer.opacity * 100))}%</span>
          </div>

          {/* Kind-specific properties */}
          {selectedLayer.kind === "text" && (
            <>
              <div style={s.propRow}>
                <span style={s.propLabel}>텍스트</span>
                <textarea
                  style={{ ...s.propInput, minHeight: "40px", resize: "vertical" }}
                  value={(selectedLayer as TextLayer).text}
                  onChange={(e) => onUpdateLayer(selectedLayer.id, { text: e.target.value } as Partial<Layer>)}
                />
              </div>
              <div style={s.propRow}>
                <span style={s.propLabel}>크기</span>
                <input type="number" style={{ ...s.propInput, width: "50px", flex: "none" }} value={(selectedLayer as TextLayer).fontSize} onChange={(e) => onUpdateLayer(selectedLayer.id, { fontSize: Number(e.target.value) } as Partial<Layer>)} />
                <span style={s.propLabel}>굵기</span>
                <input type="number" style={{ ...s.propInput, width: "50px", flex: "none" }} step={100} min={100} max={900} value={(selectedLayer as TextLayer).fontWeight} onChange={(e) => onUpdateLayer(selectedLayer.id, { fontWeight: Number(e.target.value) } as Partial<Layer>)} />
              </div>
              <div style={s.propRow}>
                <span style={s.propLabel}>색상</span>
                <ColorPickerPopover
                  color={(selectedLayer as TextLayer).color}
                  onChange={(c) => onUpdateLayer(selectedLayer.id, { color: c } as Partial<Layer>)}
                />
              </div>
              {/* Curved text */}
              <div style={s.propRow}>
                <span style={s.propLabel}>곡선</span>
                <select
                  style={s.propInput}
                  value={(() => {
                    const tl = selectedLayer as TextLayer;
                    if (!tl.curvedPath) return "none";
                    // Match current path against presets
                    for (const p of CURVE_PRESETS) {
                      if (generateCurvePath(p.id, tl.width, tl.height) === tl.curvedPath) return p.id;
                    }
                    return "none";
                  })()}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "none") {
                      onUpdateLayer(selectedLayer.id, { curvedPath: undefined } as Partial<Layer>);
                    } else {
                      const path = generateCurvePath(val as CurvePreset, selectedLayer.width, selectedLayer.height);
                      onUpdateLayer(selectedLayer.id, { curvedPath: path } as Partial<Layer>);
                    }
                  }}
                >
                  <option value="none">없음</option>
                  {CURVE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {selectedLayer.kind === "shape" && (
            <>
              <div style={s.propRow}>
                <span style={s.propLabel}>모양</span>
                <select style={s.propInput} value={(selectedLayer as ShapeLayer).shapeType} onChange={(e) => onUpdateLayer(selectedLayer.id, { shapeType: e.target.value } as Partial<Layer>)}>
                  <option value="rect">사각형</option>
                  <option value="circle">원</option>
                  <option value="polygon">삼각형</option>
                  <option value="line">선</option>
                </select>
              </div>
              <div style={s.propRow}>
                <span style={s.propLabel}>채우기</span>
                <ColorPickerPopover
                  color={(selectedLayer as ShapeLayer).fill}
                  onChange={(c) => onUpdateLayer(selectedLayer.id, { fill: c } as Partial<Layer>)}
                />
              </div>
              <div style={s.propRow}>
                <span style={s.propLabel}>테두리</span>
                <ColorPickerPopover
                  color={(selectedLayer as ShapeLayer).stroke ?? "#000000"}
                  onChange={(c) => onUpdateLayer(selectedLayer.id, { stroke: c } as Partial<Layer>)}
                />
                <input type="number" style={{ ...s.propInput, width: "40px", flex: "none" }} min={0} value={(selectedLayer as ShapeLayer).strokeWidth} onChange={(e) => onUpdateLayer(selectedLayer.id, { strokeWidth: Number(e.target.value) } as Partial<Layer>)} />
              </div>
            </>
          )}

          {selectedLayer.kind === "image" && (
            <div style={s.propRow}>
              <span style={s.propLabel}>둥글기</span>
              <input type="range" min={0} max={100} style={s.slider} value={(selectedLayer as ImageLayer).borderRadius} onChange={(e) => onUpdateLayer(selectedLayer.id, { borderRadius: Number(e.target.value) } as Partial<Layer>)} />
              <span style={s.sliderVal}>{String((selectedLayer as ImageLayer).borderRadius)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
