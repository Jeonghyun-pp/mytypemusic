"use client";

import { useState, useEffect, useRef } from "react";
import type { SlideSpec, SlideStyleOverrides, CanvasSize } from "@/lib/studio/designEditor/types";

interface SvgEffects {
  shadow?: { offsetX: number; offsetY: number; blur: number; color: string };
  blur?: number;
}

interface PreviewPanelProps {
  slide: SlideSpec;
  globalStyle?: SlideStyleOverrides;
  rawHtml?: string;
  fontMood?: string;
  canvasSize?: CanvasSize;
  effects?: SvgEffects;
}

const s = {
  wrapper: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    minHeight: 0,
    padding: "24px",
    background: "var(--bg-secondary)",
  } as const,
  imgContainer: {
    position: "relative" as const,
    width: "100%",
    maxWidth: "432px",
    background: "var(--bg-input)",
    borderRadius: "var(--radius-xl)",
    overflow: "hidden",
    boxShadow: "var(--shadow-hover)",
  } as const,
  img: {
    width: "100%",
    height: "100%",
    objectFit: "contain" as const,
    display: "block",
  } as const,
  loading: {
    position: "absolute" as const,
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.03)",
    fontSize: "13px",
    color: "var(--text-muted)",
  } as const,
  info: {
    fontSize: "12px",
    color: "var(--text-muted)",
  } as const,
};

export default function PreviewPanel({ slide, globalStyle, rawHtml, fontMood, canvasSize, effects }: PreviewPanelProps) {
  const [pngUri, setPngUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [renderTime, setRenderTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  const cw = canvasSize?.width ?? 1080;
  const ch = canvasSize?.height ?? 1350;

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Abort previous in-flight request
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      setError(null);

      // Layer mode: send layers array directly
      let payload: Record<string, unknown>;
      if (slide.layers && slide.layers.length > 0) {
        payload = {
          layers: slide.layers,
          background: globalStyle?.bgGradient ?? "#FFFFFF",
          fontMood,
          canvasSize,
        };
      } else {
        const basePayload = rawHtml
          ? { rawHtml, heroImageDataUri: slide.heroImageDataUri, fontMood, canvasSize }
          : { slide, globalStyle, fontMood, canvasSize };
        payload = {
          ...basePayload,
          ...(effects?.shadow ? { shadow: effects.shadow } : {}),
          ...(effects?.blur ? { blur: effects.blur } : {}),
        };
      }

      fetch("/api/design/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ac.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error((data as Record<string, string>).error ?? `HTTP ${String(res.status)}`);
          }
          return res.json() as Promise<{ png: string; renderTimeMs: number; cached?: boolean }>;
        })
        .then((data) => {
          setPngUri(data.png);
          setRenderTime(data.renderTimeMs);
          setCached(!!data.cached);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && (err as DOMException).name === "AbortError") return;
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          setLoading(false);
        });
    }, 300);
    return () => {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [slide, globalStyle, rawHtml, fontMood, canvasSize, effects]);

  return (
    <div style={s.wrapper}>
      <div style={{ ...s.imgContainer, aspectRatio: `${String(cw)} / ${String(ch)}` }}>
        {pngUri && (
          <img src={pngUri} alt="Preview" style={s.img} />
        )}
        {loading && (
          <div style={s.loading}>렌더링 중...</div>
        )}
        {error && !loading && (
          <div style={{ ...s.loading, color: "var(--red)" }}>{error}</div>
        )}
      </div>
      {renderTime !== null && !loading && (
        <span style={s.info}>{String(renderTime)}ms{cached ? " (cached)" : ""}</span>
      )}
    </div>
  );
}
