"use client";

import { usePathname } from "next/navigation";
import { usePipeline } from "./PipelineProvider";
import { PIPELINE_STEPS } from "./PipelineStepConfig";

export default function PipelineStepHint() {
  const { isActive, currentStep } = usePipeline();
  const pathname = usePathname();

  if (!isActive || !currentStep) return null;

  // Only show hint on the page matching the current step
  // For step 6 (create), also show on sub-path pages
  const isOnStepPage =
    pathname === currentStep.route ||
    (currentStep.subPaths?.some((sp) => pathname.startsWith(sp.route)) ?? false);

  if (!isOnStepPage) return null;

  return (
    <div style={s.banner}>
      <div style={s.stepBadge}>
        Step {currentStep.index + 1}/{PIPELINE_STEPS.length}
      </div>
      <span style={s.text}>{currentStep.hint}</span>
    </div>
  );
}

const s = {
  banner: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 16px",
    marginBottom: 16,
    background: "linear-gradient(135deg, rgba(58,130,90,0.08), rgba(58,130,90,0.03))",
    borderLeft: "3px solid var(--accent)",
    borderRadius: "0 8px 8px 0",
    fontSize: 13,
    color: "var(--text)",
  } as const,
  stepBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 4,
    background: "var(--accent)",
    color: "#fff",
    flexShrink: 0,
  } as const,
  text: {
    lineHeight: 1.4,
  } as const,
};
