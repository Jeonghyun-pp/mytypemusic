"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { PIPELINE_STEPS, type PipelineStep } from "./PipelineStepConfig";

// ── State shape ──────────────────────────────────────

interface PipelineSession {
  currentStep: number;
  stepsCompleted: boolean[];
  startedAt: string;
}

interface PipelineContextValue {
  session: PipelineSession | null;
  isActive: boolean;
  currentStep: PipelineStep | null;
  startPipeline: () => void;
  endPipeline: () => void;
  goToStep: (index: number) => void;
  completeCurrentStep: () => void;
  skipCurrentStep: () => void;
}

const PipelineContext = createContext<PipelineContextValue>({
  session: null,
  isActive: false,
  currentStep: null,
  startPipeline: () => {},
  endPipeline: () => {},
  goToStep: () => {},
  completeCurrentStep: () => {},
  skipCurrentStep: () => {},
});

export function usePipeline() {
  return useContext(PipelineContext);
}

// ── localStorage helpers ─────────────────────────────

const STORAGE_KEY = "pipeline-session";

function loadSession(): PipelineSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PipelineSession) : null;
  } catch {
    return null;
  }
}

function saveSession(session: PipelineSession | null) {
  if (typeof window === "undefined") return;
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// ── Provider ─────────────────────────────────────────

export default function PipelineProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<PipelineSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setSession(loadSession());
    setLoaded(true);
  }, []);

  // Persist to localStorage on change (only after initial load)
  useEffect(() => {
    if (!loaded) return;
    saveSession(session);
  }, [session, loaded]);

  const isActive = session !== null;
  const currentStep = isActive ? PIPELINE_STEPS[session.currentStep] ?? null : null;

  const startPipeline = useCallback(async () => {
    const newSession: PipelineSession = {
      currentStep: 0,
      stepsCompleted: PIPELINE_STEPS.map(() => false),
      startedAt: new Date().toISOString(),
    };
    setSession(newSession);
    saveSession(newSession);

    // Check setup steps and skip already-completed ones
    try {
      const [accRes, perRes, kwRes] = await Promise.all([
        fetch("/api/sns/accounts").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/persona").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/content/suggestions/keywords").then((r) => (r.ok ? r.json() : { keywords: [] })),
      ]);

      const completed = [...newSession.stepsCompleted];
      if ((accRes as unknown[]).length > 0) completed[0] = true;
      if ((perRes as unknown[]).length > 0) completed[1] = true;
      if (((kwRes as { keywords: string[] }).keywords ?? []).length > 0) completed[2] = true;

      // Find first incomplete step among setup steps (0-2),
      // or start at step 3 if all setup is done
      let firstIncomplete = 3; // default: skip to step 4 (discover)
      for (let i = 0; i < 3; i++) {
        if (!completed[i]) {
          firstIncomplete = i;
          break;
        }
      }

      const updated = { ...newSession, stepsCompleted: completed, currentStep: firstIncomplete };
      setSession(updated);
      saveSession(updated);

      const step = PIPELINE_STEPS[firstIncomplete];
      if (step && pathname !== step.route) {
        router.push(step.route);
      }
    } catch {
      const step = PIPELINE_STEPS[0];
      if (step && pathname !== step.route) router.push(step.route);
    }
  }, [pathname, router]);

  const endPipeline = useCallback(() => {
    setSession(null);
    saveSession(null);
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      if (!session) return;
      const step = PIPELINE_STEPS[index];
      if (!step) return;
      const updated = { ...session, currentStep: index };
      setSession(updated);
      saveSession(updated);
      if (pathname !== step.route) router.push(step.route);
    },
    [session, pathname, router],
  );

  const advanceToNext = useCallback(
    (sess: PipelineSession) => {
      const next = sess.currentStep + 1;
      if (next >= PIPELINE_STEPS.length) {
        // Pipeline complete — end or restart
        setSession(null);
        saveSession(null);
        return;
      }
      const step = PIPELINE_STEPS[next]!;
      const updated = { ...sess, currentStep: next };
      setSession(updated);
      saveSession(updated);
      if (pathname !== step.route) router.push(step.route);
    },
    [pathname, router],
  );

  const completeCurrentStep = useCallback(() => {
    if (!session) return;
    const completed = [...session.stepsCompleted];
    completed[session.currentStep] = true;
    const updated = { ...session, stepsCompleted: completed };
    advanceToNext(updated);
  }, [session, advanceToNext]);

  const skipCurrentStep = useCallback(() => {
    if (!session) return;
    advanceToNext(session);
  }, [session, advanceToNext]);

  return (
    <PipelineContext.Provider
      value={{
        session,
        isActive,
        currentStep,
        startPipeline,
        endPipeline,
        goToStep,
        completeCurrentStep,
        skipCurrentStep,
      }}
    >
      {children}
    </PipelineContext.Provider>
  );
}
