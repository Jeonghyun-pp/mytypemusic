"use client";

import { useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import GenerateInputForm from "./GenerateInputForm";
import GenerationProgress from "./GenerationProgress";
import ResultGallery from "./ResultGallery";

import type {
  DesignPlatform,
  DesignFormat,
  DesignBrief,
  ColorMood,
} from "@/lib/design/types";

// ── Types ────────────────────────────────────────────────

export interface GenerateInput {
  topic: string;
  content: string;
  platform: DesignPlatform;
  mood: ColorMood;
  slideCount: number;
  imageDataUri?: string;
}

export interface GeneratedSlide {
  index: number;
  jsxCode: string;
  width: number;
  height: number;
  png?: string;
}

export interface GenerateResultItem {
  format: DesignFormat;
  platform: DesignPlatform;
  slides: GeneratedSlide[];
  designPath: "template" | "generated";
}

export interface CritiqueResult {
  scores: { dimension: string; score: number; feedback: string }[];
  averageScore: number;
  verdict: "pass" | "refine" | "regenerate";
  refinementInstructions?: string;
  overallFeedback?: string;
}

type WizardStep = "input" | "generating" | "results";

// ── Component ────────────────────────────────────────────

export default function DesignGenerateWizard() {
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get("topic") ?? "";

  const [step, setStep] = useState<WizardStep>("input");
  const [brief, setBrief] = useState<DesignBrief | null>(null);
  const [results, setResults] = useState<GenerateResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [generationTimeMs, setGenerationTimeMs] = useState(0);
  const [critique, setCritique] = useState<CritiqueResult | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // ── Generate ───────────────────────────────────────────

  const handleGenerate = useCallback(async (input: GenerateInput) => {
    setStep("generating");
    setError(null);
    setBrief(null);
    setResults([]);
    setCritique(null);
    setProgressMsg("Design Brief 생성 중...");

    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      // 1. Call generate API
      const genRes = await fetch("/api/design/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          topic: input.topic,
          content: input.content,
          platforms: [input.platform],
        }),
      });

      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Generate failed (${genRes.status})`);
      }

      const genData = await genRes.json() as {
        brief: DesignBrief;
        results: GenerateResultItem[];
        generationTimeMs: number;
      };

      setBrief(genData.brief);
      setGenerationTimeMs(genData.generationTimeMs);

      // 2. Render each slide to PNG
      const allResults: GenerateResultItem[] = [];

      for (const result of genData.results) {
        setProgressMsg(
          `${result.format} 렌더링 중... (0/${result.slides.length})`,
        );

        const renderedSlides: GeneratedSlide[] = [];

        for (let i = 0; i < result.slides.length; i++) {
          if (signal.aborted) return;

          setProgressMsg(
            `${result.format} 렌더링 중... (${i + 1}/${result.slides.length})`,
          );

          const slide = result.slides[i]!;

          try {
            const renderRes = await fetch("/api/design/render", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal,
              body: JSON.stringify({
                rawHtml: slide.jsxCode,
                canvasSize: { width: slide.width, height: slide.height },
              }),
            });

            if (renderRes.ok) {
              const renderData = await renderRes.json() as { png: string };
              renderedSlides.push({ ...slide, png: renderData.png });
            } else {
              renderedSlides.push(slide);
            }
          } catch {
            renderedSlides.push(slide);
          }
        }

        allResults.push({ ...result, slides: renderedSlides });
      }

      setResults(allResults);
      setStep("results");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message ?? "알 수 없는 오류");
      setStep("input");
    }
  }, []);

  // ── Critique ───────────────────────────────────────────

  const handleCritique = useCallback(async () => {
    const pngs = results
      .flatMap((r) => r.slides)
      .map((s) => s.png)
      .filter(Boolean) as string[];

    if (pngs.length === 0) return;

    try {
      const res = await fetch("/api/design/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: pngs.slice(0, 5),
          context: brief
            ? {
                contentType: brief.contentType,
                platform: results[0]?.platform,
                mood: brief.mood,
                keyMessage: brief.keyMessage,
              }
            : undefined,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as CritiqueResult;
        setCritique(data);
      }
    } catch {
      /* ignore */
    }
  }, [results, brief]);

  // ── Cancel ─────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setStep("input");
  }, []);

  // ── Reset ──────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setStep("input");
    setBrief(null);
    setResults([]);
    setError(null);
    setCritique(null);
  }, []);

  // ── Render ─────────────────────────────────────────────

  return (
    <div style={s.outer}>
      <div style={s.header}>
        <h2 style={s.title}>AI Design Generate</h2>
        {step !== "input" && (
          <button type="button" style={s.backBtn} onClick={handleReset}>
            ← 새로 만들기
          </button>
        )}
      </div>

      {error && (
        <div style={s.error}>
          {error}
        </div>
      )}

      {step === "input" && (
        <GenerateInputForm
          initialTopic={initialTopic}
          onGenerate={handleGenerate}
        />
      )}

      {step === "generating" && (
        <GenerationProgress
          message={progressMsg}
          brief={brief}
          onCancel={handleCancel}
        />
      )}

      {step === "results" && (
        <ResultGallery
          brief={brief}
          results={results}
          critique={critique}
          generationTimeMs={generationTimeMs}
          onCritique={handleCritique}
          onRegenerate={handleReset}
        />
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────

const s = {
  outer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
    maxWidth: "960px",
    margin: "0 auto",
    padding: "0",
  } as React.CSSProperties,

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  } as React.CSSProperties,

  title: {
    fontSize: "18px",
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
  } as React.CSSProperties,

  backBtn: {
    padding: "6px 14px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
  } as React.CSSProperties,

  error: {
    padding: "12px 16px",
    borderRadius: "10px",
    background: "#FEF2F2",
    color: "#DC2626",
    fontSize: "13px",
    border: "1px solid #FECACA",
  } as React.CSSProperties,
};
