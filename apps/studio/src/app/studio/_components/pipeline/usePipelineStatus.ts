"use client";

import { useEffect, useRef } from "react";
import { usePipeline } from "./PipelineProvider";

/**
 * Polls completion status for auto-check steps (accounts, persona, keywords).
 * Automatically advances when the condition is met.
 */
export function usePipelineAutoComplete() {
  const { session, currentStep, completeCurrentStep } = usePipeline();
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!session || !currentStep || currentStep.completionCheck !== "auto") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    async function check() {
      if (!currentStep) return;
      try {
        let isComplete = false;
        switch (currentStep.id) {
          case "accounts": {
            const res = await fetch("/api/sns/accounts");
            const data: unknown[] = res.ok ? await res.json() : [];
            isComplete = data.length > 0;
            break;
          }
          case "persona": {
            const res = await fetch("/api/persona");
            const data: unknown[] = res.ok ? await res.json() : [];
            isComplete = data.length > 0;
            break;
          }
          case "keywords": {
            const res = await fetch("/api/content/suggestions/keywords");
            const data = res.ok
              ? (await res.json()) as { keywords: string[] }
              : { keywords: [] };
            isComplete = (data.keywords ?? []).length > 0;
            break;
          }
        }
        if (isComplete) {
          completeCurrentStep();
        }
      } catch {
        // Ignore errors, will retry on next poll
      }
    }

    // Check immediately
    check();

    // Then poll every 3 seconds
    timerRef.current = setInterval(check, 3000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- completeCurrentStep changes on every session update, which would cause infinite re-renders. We only want to re-run when the step actually changes.
  }, [session?.currentStep, currentStep?.id]);
}
