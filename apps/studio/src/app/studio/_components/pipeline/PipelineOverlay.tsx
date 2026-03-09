"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePipeline } from "./PipelineProvider";
import { usePipelineAutoComplete } from "./usePipelineStatus";
import { PIPELINE_STEPS } from "./PipelineStepConfig";

export default function PipelineOverlay() {
  const {
    session,
    isActive,
    currentStep,
    endPipeline,
    completeCurrentStep,
    skipCurrentStep,
    goToStep,
  } = usePipeline();
  const router = useRouter();
  const [subPathOpen, setSubPathOpen] = useState(false);

  // Enable auto-completion polling for setup steps
  usePipelineAutoComplete();

  if (!isActive || !session || !currentStep) return null;

  const stepIdx = session.currentStep;
  const isAutoStep = currentStep.completionCheck === "auto";
  const hasSubPaths = (currentStep.subPaths?.length ?? 0) > 0;
  const isLastStep = stepIdx === PIPELINE_STEPS.length - 1;

  function handleNext() {
    if (hasSubPaths && !subPathOpen) {
      setSubPathOpen(true);
      return;
    }
    setSubPathOpen(false);
    completeCurrentStep();
  }

  function handleSubPath(route: string) {
    setSubPathOpen(false);
    router.push(route);
  }

  function handleFinish() {
    endPipeline();
    router.push("/studio");
  }

  return (
    <>
      {/* Sub-path selector popup */}
      {subPathOpen && currentStep.subPaths && (
        <div style={s.subPathOverlay} onClick={() => setSubPathOpen(false)}>
          <div style={s.subPathMenu} onClick={(e) => e.stopPropagation()}>
            <div style={s.subPathTitle}>어떤 포맷으로 제작하시겠습니까?</div>
            {currentStep.subPaths.map((sp) => (
              <button
                key={sp.id}
                style={s.subPathBtn}
                onClick={() => handleSubPath(sp.route)}
              >
                {sp.label}
              </button>
            ))}
            <button
              style={s.subPathSkip}
              onClick={() => {
                setSubPathOpen(false);
                completeCurrentStep();
              }}
            >
              건너뛰기
            </button>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div style={s.bar}>
        {/* Progress dots */}
        <div style={s.dots}>
          {PIPELINE_STEPS.map((step, i) => (
            <button
              key={step.id}
              title={step.label}
              onClick={() => goToStep(i)}
              style={{
                ...s.dot,
                background:
                  session.stepsCompleted[i]
                    ? "#22c55e"
                    : i === stepIdx
                      ? "var(--accent)"
                      : "var(--border)",
                cursor: "pointer",
              }}
            />
          ))}
        </div>

        {/* Current step info */}
        <div style={s.info}>
          <span style={s.stepLabel}>
            {stepIdx + 1}. {currentStep.label}
          </span>
          <span style={s.stepDesc}>{currentStep.description}</span>
        </div>

        {/* Actions */}
        <div style={s.actions}>
          {isAutoStep ? (
            <>
              <span style={s.autoLabel}>자동 감지 중...</span>
              {currentStep.skippable && (
                <button style={s.btnSkip} onClick={skipCurrentStep}>
                  건너뛰기
                </button>
              )}
            </>
          ) : isLastStep ? (
            <button style={s.btnNext} onClick={handleFinish}>
              완료
            </button>
          ) : (
            <>
              {currentStep.skippable && (
                <button style={s.btnSkip} onClick={skipCurrentStep}>
                  건너뛰기
                </button>
              )}
              <button style={s.btnNext} onClick={handleNext}>
                {hasSubPaths ? "포맷 선택" : "다음 단계"}
              </button>
            </>
          )}
          <button style={s.btnClose} onClick={endPipeline} title="파이프라인 종료">
            ✕
          </button>
        </div>
      </div>
    </>
  );
}

// ── Styles ───────────────────────────────────────────

const s = {
  bar: {
    position: "fixed" as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    background: "var(--bg-card)",
    borderTop: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    padding: "0 20px",
    gap: 16,
    zIndex: 350,
    boxShadow: "0 -2px 12px rgba(0,0,0,0.08)",
  } as const,

  dots: {
    display: "flex",
    gap: 6,
    flexShrink: 0,
  } as const,

  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    border: "none",
    padding: 0,
    transition: "background 0.2s",
  } as const,

  info: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  } as const,

  stepLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
  } as const,

  stepDesc: {
    fontSize: 11,
    color: "var(--text-muted)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
  } as const,

  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  } as const,

  autoLabel: {
    fontSize: 12,
    color: "var(--accent)",
    fontWeight: 500,
  } as const,

  btnSkip: {
    padding: "6px 14px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
  } as const,

  btnNext: {
    padding: "6px 16px",
    borderRadius: 6,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  } as const,

  btnClose: {
    padding: "4px 8px",
    borderRadius: 4,
    border: "none",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: 14,
    cursor: "pointer",
    marginLeft: 4,
  } as const,

  // Sub-path overlay
  subPathOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.3)",
    zIndex: 360,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingBottom: 72,
  } as const,

  subPathMenu: {
    background: "var(--bg-card)",
    borderRadius: 12,
    padding: 20,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    minWidth: 280,
    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
  } as const,

  subPathTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 4,
  } as const,

  subPathBtn: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all 0.15s",
  } as const,

  subPathSkip: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: 12,
    cursor: "pointer",
    marginTop: 4,
  } as const,
};
