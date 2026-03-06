"use client";

import { useEffect, useState, useCallback } from "react";

/* ─── types ─── */
interface Persona {
  id: string;
  name: string;
  creationMethod: string;
  styleFingerprint: string;
  tone: Record<string, string> | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

type Tab = "list" | "manual" | "template" | "analyze";

const TEMPLATES = [
  {
    name: "프로페셔널 마케터",
    tone: { formality: "professional", humor: "subtle", emotion: "empathetic", energy: "moderate" },
    fingerprint:
      "데이터 기반의 논리적인 글쓰기를 선호합니다. 전문 용어를 적절히 사용하되, 누구나 이해할 수 있도록 풀어씁니다. 핵심 인사이트를 먼저 제시하고, 근거를 뒤에 붙이는 역피라미드 구조를 사용합니다. 결론에는 항상 실행 가능한 액션 아이템을 포함합니다.",
  },
  {
    name: "캐주얼 크리에이터",
    tone: { formality: "casual", humor: "frequent", emotion: "passionate", energy: "energetic" },
    fingerprint:
      "친구에게 말하듯 편안한 톤으로 글을 씁니다. 이모지와 줄임말을 자연스럽게 사용하고, 짧은 문장을 선호합니다. 개인적인 경험과 솔직한 감상을 많이 녹여내며, 독자와의 소통을 중시합니다. 질문형 끝맺음으로 댓글을 유도합니다.",
  },
  {
    name: "교육적 전문가",
    tone: { formality: "formal", humor: "none", emotion: "neutral", energy: "calm" },
    fingerprint:
      "복잡한 개념을 단계별로 쉽게 설명하는 스타일입니다. '첫째, 둘째' 같은 번호 매기기를 자주 사용하고, 비유와 예시를 통해 이해를 돕습니다. 정확한 출처와 데이터를 중시하며, 객관적이고 신뢰감 있는 어조를 유지합니다.",
  },
  {
    name: "도발적 오피니언 리더",
    tone: { formality: "conversational", humor: "sarcastic", emotion: "provocative", energy: "intense" },
    fingerprint:
      "통념에 도전하는 강렬한 첫 문장으로 시작합니다. 과감한 주장과 날카로운 분석이 특징이며, 독자의 기존 생각에 균열을 내는 것을 목표로 합니다. 짧고 강한 문장을 사용하고, 수사적 질문을 자주 던집니다. 결론은 행동을 촉구하는 형태입니다.",
  },
];

/* ─── styles ─── */
const s = {
  page: { display: "flex", flexDirection: "column" as const, gap: 24 },
  section: { display: "flex", flexDirection: "column" as const, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 600, color: "var(--text)" },
  desc: { fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 },
  tabs: { display: "flex", gap: 4, background: "var(--bg-input)", borderRadius: "var(--radius-sm)", padding: 4 },
  tab: { padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" },
  tabActive: { color: "var(--text)", background: "var(--bg-card)", boxShadow: "var(--shadow-card)", fontWeight: 600 },
  input: { width: "100%", padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: 13 },
  textarea: { width: "100%", minHeight: 100, padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: 13, fontFamily: "inherit", resize: "vertical" as const, lineHeight: 1.6 },
  btn: { padding: "10px 24px", borderRadius: "var(--radius-sm)", border: "none", background: "var(--text)", color: "var(--bg)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnOutline: { padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: 12, fontWeight: 500, cursor: "pointer" },
  btnDanger: { padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid #e553", background: "transparent", color: "#e55", fontSize: 12, cursor: "pointer" },
  card: { padding: 16, borderRadius: "var(--radius-sm)", background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" as const, gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: 600, color: "var(--text)" },
  cardMeta: { fontSize: 12, color: "var(--text-muted)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 },
  row: { display: "flex", gap: 8, alignItems: "center" },
  badge: (active: boolean) => ({ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: active ? "#22c55e20" : "#f5920020", color: active ? "#22c55e" : "#f59200" }),
  testBox: { padding: 12, borderRadius: "var(--radius-sm)", background: "var(--bg-input)", fontSize: 13, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" as const },
};

/* ─── component ─── */
export default function PersonaView() {
  const [tab, setTab] = useState<Tab>("list");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual creation
  const [manualName, setManualName] = useState("");
  const [manualFingerprint, setManualFingerprint] = useState("");

  // Analyze
  const [analyzeSamples, setAnalyzeSamples] = useState("");
  const [analyzeName, setAnalyzeName] = useState("");
  const [analyzeResult, setAnalyzeResult] = useState<Record<string, unknown> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Test
  const [testPersonaId, setTestPersonaId] = useState("");
  const [testTopic, setTestTopic] = useState("");
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/persona");
      if (res.ok) setPersonas(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createManual() {
    if (!manualName.trim() || !manualFingerprint.trim()) return;
    await fetch("/api/persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: manualName, creationMethod: "manual", styleFingerprint: manualFingerprint }),
    });
    setManualName("");
    setManualFingerprint("");
    setTab("list");
    load();
  }

  async function createFromTemplate(tpl: (typeof TEMPLATES)[0]) {
    await fetch("/api/persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tpl.name, creationMethod: "template", tone: tpl.tone, styleFingerprint: tpl.fingerprint }),
    });
    setTab("list");
    load();
  }

  async function analyzeTexts() {
    const texts = analyzeSamples.split("\n---\n").filter((t) => t.trim().length > 20);
    if (texts.length < 2) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/persona/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
      });
      const data = await res.json();
      setAnalyzeResult(data);
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveAnalyzed() {
    if (!analyzeResult || !analyzeName.trim()) return;
    await fetch("/api/persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: analyzeName,
        creationMethod: "analyze",
        tone: analyzeResult.tone,
        vocabulary: analyzeResult.vocabulary,
        structure: analyzeResult.structure,
        styleFingerprint: analyzeResult.styleFingerprint,
      }),
    });
    setAnalyzeSamples("");
    setAnalyzeName("");
    setAnalyzeResult(null);
    setTab("list");
    load();
  }

  async function deletePersona(id: string) {
    if (!confirm("이 페르소나를 삭제하시겠습니까?")) return;
    await fetch(`/api/persona/${id}`, { method: "DELETE" });
    load();
  }

  async function testPersona() {
    if (!testPersonaId || !testTopic.trim()) return;
    setTesting(true);
    try {
      const res = await fetch("/api/persona/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId: testPersonaId, topic: testTopic }),
      });
      const data = await res.json();
      setTestResult(data.generatedText ?? "");
    } finally {
      setTesting(false);
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "list", label: "목록" },
    { id: "manual", label: "직접 만들기" },
    { id: "template", label: "템플릿" },
    { id: "analyze", label: "텍스트 분석" },
  ];

  return (
    <div style={s.page}>
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Writing Persona</h2>
        <p style={s.desc}>AI 콘텐츠의 글쓰기 스타일을 정의합니다. 페르소나를 설정하면 모든 생성 콘텐츠에 일관된 톤앤매너가 적용됩니다.</p>
      </div>

      <div style={s.tabs}>
        {TABS.map((t) => (
          <button key={t.id} style={{ ...s.tab, ...(tab === t.id ? s.tabActive : {}) }} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {tab === "list" && (
        <div style={s.section}>
          {loading ? (
            <p style={s.desc}>불러오는 중...</p>
          ) : personas.length === 0 ? (
            <p style={s.desc}>아직 페르소나가 없습니다. 템플릿에서 시작하거나 직접 만들어보세요.</p>
          ) : (
            <>
              <div style={s.grid}>
                {personas.map((p) => (
                  <div key={p.id} style={s.card}>
                    <div style={s.row}>
                      <span style={s.cardTitle}>{p.name}</span>
                      <span style={s.badge(p.isActive)}>{p.isActive ? "활성" : "비활성"}</span>
                    </div>
                    <div style={s.cardMeta}>{p.creationMethod} ・ {new Date(p.createdAt).toLocaleDateString("ko")}</div>
                    {p.tone && (
                      <div style={s.cardMeta}>
                        {Object.entries(p.tone).map(([k, v]) => `${k}: ${v}`).join(" ・ ")}
                      </div>
                    )}
                    {p.styleFingerprint && (
                      <div style={{ ...s.desc, fontSize: 12 }}>{p.styleFingerprint.slice(0, 150)}...</div>
                    )}
                    <div style={s.row}>
                      <button style={s.btnOutline} onClick={() => { setTestPersonaId(p.id); setTab("list"); }}>
                        테스트
                      </button>
                      <button style={s.btnDanger} onClick={() => deletePersona(p.id)}>삭제</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick test */}
              <div style={{ ...s.card, marginTop: 8 }}>
                <div style={s.cardTitle}>페르소나 테스트</div>
                <div style={s.row}>
                  <select style={s.input} value={testPersonaId} onChange={(e) => setTestPersonaId(e.target.value)}>
                    <option value="">페르소나 선택</option>
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input style={s.input} placeholder="주제를 입력하세요" value={testTopic} onChange={(e) => setTestTopic(e.target.value)} />
                  <button style={s.btn} onClick={testPersona} disabled={testing}>
                    {testing ? "생성 중..." : "생성"}
                  </button>
                </div>
                {testResult && <div style={s.testBox}>{testResult}</div>}
              </div>
            </>
          )}
        </div>
      )}

      {/* Manual */}
      {tab === "manual" && (
        <div style={s.section}>
          <input style={s.input} placeholder="페르소나 이름 (예: 뮤직 매거진 에디터)" value={manualName} onChange={(e) => setManualName(e.target.value)} />
          <textarea
            style={s.textarea}
            placeholder="스타일 설명을 입력하세요. 글쓰기 톤, 선호하는 표현, 구조 패턴 등을 자세히 적어주세요."
            value={manualFingerprint}
            onChange={(e) => setManualFingerprint(e.target.value)}
          />
          <button style={s.btn} onClick={createManual}>페르소나 생성</button>
        </div>
      )}

      {/* Template */}
      {tab === "template" && (
        <div style={s.grid}>
          {TEMPLATES.map((tpl) => (
            <div key={tpl.name} style={s.card}>
              <div style={s.cardTitle}>{tpl.name}</div>
              <div style={s.cardMeta}>
                {Object.entries(tpl.tone).map(([k, v]) => `${k}: ${v}`).join(" ・ ")}
              </div>
              <div style={s.desc}>{tpl.fingerprint}</div>
              <button style={s.btnOutline} onClick={() => createFromTemplate(tpl)}>이 템플릿 사용</button>
            </div>
          ))}
        </div>
      )}

      {/* Analyze */}
      {tab === "analyze" && (
        <div style={s.section}>
          <p style={s.desc}>기존에 작성한 텍스트 샘플을 붙여넣으면 AI가 스타일을 분석합니다. 샘플 사이를 --- (하이픈 3개)로 구분하세요. 최소 2개 이상의 샘플이 필요합니다.</p>
          <textarea
            style={{ ...s.textarea, minHeight: 200 }}
            placeholder={"첫 번째 샘플 텍스트를 여기에 붙여넣으세요...\n---\n두 번째 샘플 텍스트...\n---\n세 번째 샘플 텍스트..."}
            value={analyzeSamples}
            onChange={(e) => setAnalyzeSamples(e.target.value)}
          />
          <button style={s.btn} onClick={analyzeTexts} disabled={analyzing}>
            {analyzing ? "분석 중..." : "스타일 분석"}
          </button>

          {analyzeResult && (
            <div style={s.card}>
              <div style={s.cardTitle}>분석 결과</div>
              {analyzeResult.tone != null && (
                <div style={s.cardMeta}>
                  {"톤: " + Object.entries(analyzeResult.tone as Record<string, string>).map(([k, v]: [string, string]) => `${k}: ${v}`).join(" ・ ")}
                </div>
              )}
              {analyzeResult.styleFingerprint != null && (
                <div style={{ ...s.desc, whiteSpace: "pre-wrap" as const }}>{String(analyzeResult.styleFingerprint)}</div>
              )}
              <div style={s.row}>
                <input style={s.input} placeholder="페르소나 이름" value={analyzeName} onChange={(e) => setAnalyzeName(e.target.value)} />
                <button style={s.btn} onClick={saveAnalyzed}>저장</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
