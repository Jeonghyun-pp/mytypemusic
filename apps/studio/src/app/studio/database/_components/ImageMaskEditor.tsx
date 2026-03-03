"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const CW = 1080;
const CH = 1350;

type Tool = "brush" | "rect" | "eraser";

interface Props {
  imageDataUri: string;
  /** 마스크가 변경될 때 호출. 마스크된 이미지(이미지 영역이 회색) URI 또는 null */
  onMaskChange: (maskedImageUri: string | null) => void;
}

/**
 * 이미지 위에서 브러시/사각형/지우개로 "이미지 영역"을 칠하는 마스킹 에디터.
 *
 * - 칠한 부분(파란색) = 이미지 영역 (나중에 다른 사진으로 교체 가능한 투명 슬롯)
 * - 안 칠한 부분 = 디자인 영역 (코드로 변환될 부분)
 *
 * 출력: 디자인 영역만 보이고 이미지 영역은 회색(#808080)으로 채워진 이미지 data URI.
 * GPT에게 "회색 부분은 사진 자리이니 무시하고, 나머지 디자인만 HTML로 만들어"라고 보냄.
 */
export default function ImageMaskEditor({ imageDataUri, onMaskChange }: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(60);
  const [isDrawing, setIsDrawing] = useState(false);
  const prevPos = useRef<{ x: number; y: number } | null>(null);
  const rectStart = useRef<{ x: number; y: number } | null>(null);

  // ── Init offscreen mask canvas ──────────────────────────
  useEffect(() => {
    if (!maskRef.current) {
      const c = document.createElement("canvas");
      c.width = CW;
      c.height = CH;
      maskRef.current = c;
    }
  }, []);

  // ── Load image ──────────────────────────────────────────
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      redraw();
    };
    img.src = imageDataUri;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDataUri]);

  // ── Coordinate conversion ───────────────────────────────
  const toCanvas = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const rect = displayRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CW,
      y: ((e.clientY - rect.top) / rect.height) * CH,
    };
  }, []);

  // ── Redraw display canvas ──────────────────────────────
  const redraw = useCallback(() => {
    const display = displayRef.current;
    const mask = maskRef.current;
    const img = imgRef.current;
    if (!display || !mask || !img) return;

    const ctx = display.getContext("2d")!;
    ctx.clearRect(0, 0, CW, CH);
    ctx.drawImage(img, 0, 0, CW, CH);

    // 마스크 오버레이 (반투명 파란색)
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.drawImage(mask, 0, 0);
    ctx.restore();
  }, []);

  // ── Generate masked image for API ──────────────────────
  const emitMaskChange = useCallback(() => {
    const mask = maskRef.current;
    const img = imgRef.current;
    if (!mask || !img) { onMaskChange(null); return; }

    // 마스크에 칠해진 픽셀이 있는지 빠르게 체크
    const mCtx = mask.getContext("2d")!;
    const data = mCtx.getImageData(0, 0, CW, CH).data;
    let hasPaint = false;
    for (let i = 3; i < data.length; i += 16) { // 4px 간격으로 샘플링 (속도)
      if (data[i]! > 0) { hasPaint = true; break; }
    }
    if (!hasPaint) { onMaskChange(null); return; }

    // 원본 이미지 + 마스크 영역을 회색으로 덮기
    const out = document.createElement("canvas");
    out.width = CW;
    out.height = CH;
    const oCtx = out.getContext("2d")!;
    oCtx.drawImage(img, 0, 0, CW, CH);

    const gray = document.createElement("canvas");
    gray.width = CW;
    gray.height = CH;
    const gCtx = gray.getContext("2d")!;
    gCtx.drawImage(mask, 0, 0);
    gCtx.globalCompositeOperation = "source-in";
    gCtx.fillStyle = "#808080";
    gCtx.fillRect(0, 0, CW, CH);

    oCtx.drawImage(gray, 0, 0);
    onMaskChange(out.toDataURL("image/png"));
  }, [onMaskChange]);

  // ── Paint helpers ───────────────────────────────────────
  function paintStroke(x1: number, y1: number, x2: number, y2: number) {
    const ctx = maskRef.current!.getContext("2d")!;
    const isEraser = tool === "eraser";

    ctx.lineWidth = brushSize * 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (isEraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(59,130,246,1)";
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  function paintDot(x: number, y: number) {
    const ctx = maskRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.fillStyle = "rgba(59,130,246,1)";
      ctx.fill();
    }
  }

  // ── Mouse handlers ──────────────────────────────────────
  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const pos = toCanvas(e);
    setIsDrawing(true);
    prevPos.current = pos;

    if (tool === "rect") {
      rectStart.current = pos;
      return;
    }
    paintDot(pos.x, pos.y);
    redraw();
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDrawing) return;
    const pos = toCanvas(e);

    if (tool === "rect") {
      // 사각형 미리보기
      redraw();
      if (rectStart.current) {
        const ctx = displayRef.current!.getContext("2d")!;
        const rx = Math.min(rectStart.current.x, pos.x);
        const ry = Math.min(rectStart.current.y, pos.y);
        const rw = Math.abs(pos.x - rectStart.current.x);
        const rh = Math.abs(pos.y - rectStart.current.y);
        ctx.strokeStyle = "#5B7CF7";
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.setLineDash([]);
        // 반투명 채우기 미리보기
        ctx.fillStyle = "rgba(59,130,246,0.25)";
        ctx.fillRect(rx, ry, rw, rh);
      }
      return;
    }

    if (prevPos.current) {
      paintStroke(prevPos.current.x, prevPos.current.y, pos.x, pos.y);
    }
    prevPos.current = pos;
    redraw();
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === "rect" && rectStart.current) {
      const pos = toCanvas(e);
      const rx = Math.min(rectStart.current.x, pos.x);
      const ry = Math.min(rectStart.current.y, pos.y);
      const rw = Math.abs(pos.x - rectStart.current.x);
      const rh = Math.abs(pos.y - rectStart.current.y);

      if (rw > 10 && rh > 10) {
        const ctx = maskRef.current!.getContext("2d")!;
        ctx.fillStyle = "rgba(59,130,246,1)";
        ctx.fillRect(rx, ry, rw, rh);
      }
      rectStart.current = null;
      redraw();
    }

    prevPos.current = null;
    emitMaskChange();
  }

  function handleMouseLeave() {
    if (!isDrawing) return;
    setIsDrawing(false);
    prevPos.current = null;
    rectStart.current = null;
    redraw();
    emitMaskChange();
  }

  function handleSelectAll() {
    const ctx = maskRef.current!.getContext("2d")!;
    ctx.fillStyle = "rgba(59,130,246,1)";
    ctx.fillRect(0, 0, CW, CH);
    redraw();
    emitMaskChange();
  }

  function handleClear() {
    const ctx = maskRef.current!.getContext("2d")!;
    ctx.clearRect(0, 0, CW, CH);
    redraw();
    emitMaskChange();
  }

  return (
    <div style={st.wrapper}>
      {/* Toolbar */}
      <div style={st.toolBar}>
        {(["brush", "rect", "eraser"] as Tool[]).map((t) => (
          <button
            key={t}
            type="button"
            style={tool === t ? st.toolActive : st.toolBtn}
            onClick={() => setTool(t)}
          >
            {t === "brush" ? "브러시" : t === "rect" ? "사각형" : "지우개"}
          </button>
        ))}
      </div>

      {/* Brush size (brush/eraser only) */}
      {tool !== "rect" && (
        <div style={st.sizeRow}>
          <span style={st.sizeLabel}>크기</span>
          <input
            type="range"
            min={15}
            max={200}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={st.slider}
          />
          <span style={st.sizeValue}>{brushSize}</span>
        </div>
      )}

      {/* Canvas */}
      <div style={st.canvasWrap}>
        <canvas
          ref={displayRef}
          width={CW}
          height={CH}
          style={st.canvas}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {/* Action buttons */}
      <div style={st.actionRow}>
        <button type="button" style={st.actionBtn} onClick={handleSelectAll}>전체 선택</button>
        <button type="button" style={st.actionBtn} onClick={handleClear}>초기화</button>
      </div>

      {/* Legend */}
      <div style={st.legend}>
        <span style={st.legendItem}>
          <span style={{ ...st.dot, background: "rgba(59,130,246,0.5)" }} />
          이미지 영역 (교체 가능)
        </span>
        <span style={st.legendItem}>
          <span style={{ ...st.dot, border: "1px solid var(--border-light)" }} />
          디자인 영역 (코드 변환)
        </span>
      </div>
    </div>
  );
}

const st = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  } as React.CSSProperties,

  toolBar: {
    display: "flex",
    gap: "4px",
  } as React.CSSProperties,

  toolBtn: {
    padding: "5px 14px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text-muted)",
    fontSize: "11px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  toolActive: {
    padding: "5px 14px",
    borderRadius: "8px",
    border: "1px solid var(--accent)",
    background: "var(--accent-light, rgba(91,124,247,0.1))",
    color: "var(--accent)",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,

  sizeRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  } as React.CSSProperties,

  sizeLabel: {
    fontSize: "11px",
    color: "var(--text-muted)",
    fontWeight: 500,
    flexShrink: 0,
  } as React.CSSProperties,

  slider: {
    flex: 1,
    height: "4px",
    accentColor: "var(--accent)",
  } as React.CSSProperties,

  sizeValue: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    minWidth: "28px",
    textAlign: "right" as const,
  } as React.CSSProperties,

  canvasWrap: {
    borderRadius: "8px",
    overflow: "hidden",
    border: "1px solid var(--border-light)",
    background: "var(--bg-secondary)",
    lineHeight: 0,
  } as React.CSSProperties,

  canvas: {
    width: "100%",
    height: "auto",
    display: "block",
    cursor: "crosshair",
  } as React.CSSProperties,

  actionRow: {
    display: "flex",
    gap: "6px",
  } as React.CSSProperties,

  actionBtn: {
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

  legend: {
    display: "flex",
    gap: "14px",
  } as React.CSSProperties,

  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "10px",
    color: "var(--text-muted)",
  } as React.CSSProperties,

  dot: {
    width: "10px",
    height: "10px",
    borderRadius: "3px",
    flexShrink: 0,
  } as React.CSSProperties,
};
