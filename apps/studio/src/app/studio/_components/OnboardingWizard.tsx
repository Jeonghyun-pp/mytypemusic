"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SnsAccount {
  id: string;
  platform: string;
  displayName: string;
  isActive: boolean;
}

interface Persona {
  id: string;
  name: string;
  isDefault: boolean;
  styleFingerprint?: string;
}

type Step = "connect" | "analyzing" | "ready";

interface OnboardingWizardProps {
  onSkip?: () => void;
}

export default function OnboardingWizard({ onSkip }: OnboardingWizardProps) {
  const [accounts, setAccounts] = useState<SnsAccount[]>([]);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [step, setStep] = useState<Step>("connect");
  const [pollCount, setPollCount] = useState(0);

  // Check accounts and persona status
  useEffect(() => {
    async function check() {
      const [accRes, perRes] = await Promise.all([
        fetch("/api/sns/accounts"),
        fetch("/api/persona"),
      ]);
      const accs: SnsAccount[] = accRes.ok ? await accRes.json() : [];
      const personas: Persona[] = perRes.ok ? await perRes.json() : [];

      setAccounts(accs.filter((a) => a.isActive));
      const defaultPersona = personas.find((p) => p.isDefault) ?? personas[0] ?? null;
      setPersona(defaultPersona);

      if (accs.length === 0) {
        setStep("connect");
      } else if (!defaultPersona) {
        setStep("analyzing");
      } else {
        setStep("ready");
      }
    }
    check();
  }, [pollCount]);

  // Poll while analyzing (waiting for onboard job to complete)
  useEffect(() => {
    if (step !== "analyzing") return;
    const timer = setInterval(() => setPollCount((c) => c + 1), 5000);
    return () => clearInterval(timer);
  }, [step]);

  function handleSkip() {
    if (typeof window !== "undefined") {
      localStorage.setItem("onboarding-skipped", "1");
    }
    onSkip?.();
  }

  const steps = [
    { key: "connect", label: "1. 계정 연결", done: accounts.length > 0 },
    { key: "analyzing", label: "2. 스타일 분석", done: !!persona },
    { key: "ready", label: "3. 콘텐츠 생성", done: false },
  ];

  return (
    <div style={s.wrapper}>
      <div style={s.header}>
        <h2 style={s.title}>Studio 시작하기</h2>
        <p style={s.desc}>계정을 연결하면 AI가 자동으로 글쓰기 스타일을 분석하고 콘텐츠를 제안합니다.</p>
      </div>

      {/* Progress */}
      <div style={s.progress}>
        {steps.map((st, i) => (
          <div key={st.key} style={s.stepRow}>
            <div style={{
              ...s.stepDot,
              background: st.done ? "#22c55e" : step === st.key ? "var(--accent)" : "var(--border)",
            }} />
            <span style={{
              ...s.stepLabel,
              color: st.done ? "#22c55e" : step === st.key ? "var(--text)" : "var(--text-muted)",
              fontWeight: step === st.key ? 600 : 400,
            }}>
              {st.label}
            </span>
            {i < steps.length - 1 && <div style={s.stepLine} />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step === "connect" && (
        <div style={s.stepContent}>
          <p style={s.stepDesc}>SNS 계정을 연결하면 AI가 글쓰기 스타일을 자동 분석합니다.</p>
          <Link href="/studio/accounts" style={s.btnPrimary}>
            계정 연결하기
          </Link>

          <div style={s.divider}>
            <span style={s.dividerText}>또는</span>
          </div>

          <p style={s.stepHint}>
            계정 연결 없이도 디자인, 블로그, 콘텐츠 기획 기능을 바로 사용할 수 있습니다.
            완성된 콘텐츠는 직접 다운로드하여 업로드하세요.
          </p>
          <button onClick={handleSkip} style={s.btnOutline}>
            건너뛰고 바로 시작하기
          </button>
        </div>
      )}

      {step === "analyzing" && (
        <div style={s.stepContent}>
          <div style={s.spinner} />
          <p style={s.stepDesc}>
            {accounts[0]?.displayName}의 글쓰기 스타일을 분석 중입니다...
          </p>
          <p style={s.stepHint}>잠시만 기다려주세요. 보통 1-2분 소요됩니다.</p>
          <Link href="/studio/persona" style={s.btnOutline}>
            직접 페르소나 만들기
          </Link>
        </div>
      )}

      {step === "ready" && (
        <div style={s.stepContent}>
          <div style={s.personaCard}>
            <span style={s.personaBadge}>AI 분석 완료</span>
            <span style={s.personaName}>{persona?.name}</span>
            {persona?.styleFingerprint && (
              <p style={s.personaFingerprint}>
                {persona.styleFingerprint.slice(0, 150)}
                {(persona.styleFingerprint.length ?? 0) > 150 ? "..." : ""}
              </p>
            )}
          </div>
          <div style={s.readyActions}>
            <Link href="/studio/create" style={s.btnPrimary}>
              첫 콘텐츠 만들기
            </Link>
            <Link href="/studio/persona" style={s.btnOutline}>
              페르소나 수정
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
    padding: 32,
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    boxShadow: "var(--shadow-card)",
    maxWidth: 560,
    margin: "0 auto",
  },
  header: { textAlign: "center" as const },
  title: { fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 8 },
  desc: { fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 },

  progress: { display: "flex", justifyContent: "center", gap: 0, alignItems: "center" },
  stepRow: { display: "flex", alignItems: "center", gap: 8 },
  stepDot: { width: 10, height: 10, borderRadius: "50%" },
  stepLabel: { fontSize: 13 },
  stepLine: { width: 40, height: 1, background: "var(--border)", margin: "0 4px" },

  stepContent: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 16,
    padding: "20px 0",
  },
  stepDesc: { fontSize: 14, color: "var(--text)", textAlign: "center" as const, lineHeight: 1.5 },
  stepHint: { fontSize: 12, color: "var(--text-muted)" },

  spinner: {
    width: 32,
    height: 32,
    border: "3px solid var(--border)",
    borderTopColor: "var(--accent)",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },

  personaCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    padding: 16,
    borderRadius: 8,
    background: "var(--bg-input)",
    width: "100%",
  },
  personaBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: "#22c55e",
    background: "rgba(34,197,94,0.1)",
    padding: "2px 8px",
    borderRadius: 4,
    alignSelf: "flex-start" as const,
  },
  personaName: { fontSize: 15, fontWeight: 600, color: "var(--text)" },
  personaFingerprint: { fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 },

  readyActions: { display: "flex", gap: 8 },
  btnPrimary: {
    padding: "10px 24px",
    borderRadius: 8,
    background: "var(--accent)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    textAlign: "center" as const,
  },
  btnOutline: {
    padding: "10px 24px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    fontSize: 13,
    fontWeight: 500,
    textDecoration: "none",
    textAlign: "center" as const,
    cursor: "pointer",
  },

  divider: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    margin: "4px 0",
  },
  dividerText: {
    fontSize: 12,
    color: "var(--text-muted)",
    flexShrink: 0,
    padding: "0 8px",
    position: "relative" as const,
  },
};
