"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";

// ── Types ────────────────────────────────────────────────

interface BrandKitData {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: { dark: string; light: string };
    text: { primary: string; secondary: string; onDark: string; onLight: string };
    gradients: string[];
  };
  typography: {
    heading: { fontFamily: string; weights: number[]; fontMood: string };
    body: { fontFamily: string; weights: number[]; fontMood: string };
    accent: { fontFamily: string; weights: number[]; fontMood: string };
    sizes: Record<string, number>;
  };
  assets: { logoUrl?: string; logoSmallUrl?: string; watermarkUrl?: string };
  layout: {
    safeMargin: number;
    cornerRadius: number;
    maxTextPerSlide: number;
    maxTitleLength: number;
    slideGap: number;
  };
}

// ── Constants ────────────────────────────────────────────

const FONT_OPTIONS = [
  "Pretendard",
  "Noto Sans KR",
  "Noto Serif KR",
  "Montserrat",
  "Playfair Display",
  "Inter",
  "Poppins",
  "Roboto",
];

const FONT_MOODS = [
  { value: "bold-display", label: "볼드 디스플레이" },
  { value: "clean-sans", label: "클린 산세리프" },
  { value: "editorial", label: "에디토리얼" },
  { value: "playful", label: "플레이풀" },
  { value: "minimal", label: "미니멀" },
  { value: "impact", label: "임팩트" },
];

// ── Styles ───────────────────────────────────────────────

const s = {
  page: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "24px",
  } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "28px",
  } satisfies CSSProperties,
  title: {
    fontSize: "22px",
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
  } satisfies CSSProperties,
  subtitle: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    margin: "4px 0 0",
  } satisfies CSSProperties,
  saveBtn: {
    padding: "10px 24px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #6C5CE7 0%, #A29BFE 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  } satisfies CSSProperties,
  section: {
    marginBottom: "28px",
    padding: "20px",
    borderRadius: "12px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
  } satisfies CSSProperties,
  sectionTitle: {
    fontSize: "15px",
    fontWeight: 600,
    color: "var(--text)",
    margin: "0 0 16px",
  } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  } satisfies CSSProperties,
  label: {
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--text-secondary)",
    width: "120px",
    flexShrink: 0,
  } satisfies CSSProperties,
  input: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "13px",
    color: "var(--text)",
    outline: "none",
  } satisfies CSSProperties,
  colorInput: {
    width: "42px",
    height: "36px",
    padding: "2px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "none",
    cursor: "pointer",
  } satisfies CSSProperties,
  colorRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  } satisfies CSSProperties,
  select: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "13px",
    color: "var(--text)",
    outline: "none",
    cursor: "pointer",
  } satisfies CSSProperties,
  numberInput: {
    width: "80px",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "13px",
    color: "var(--text)",
    outline: "none",
    textAlign: "right" as const,
  } satisfies CSSProperties,
  previewCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
    padding: "16px",
    borderRadius: "12px",
    marginTop: "16px",
  } satisfies CSSProperties,
  previewTitle: {
    fontSize: "28px",
    fontWeight: 700,
    margin: 0,
  } satisfies CSSProperties,
  previewBody: {
    fontSize: "16px",
    fontWeight: 400,
    margin: 0,
    lineHeight: 1.6,
  } satisfies CSSProperties,
  previewAccent: {
    fontSize: "12px",
    fontWeight: 600,
    margin: 0,
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
  } satisfies CSSProperties,
  toast: {
    position: "fixed" as const,
    bottom: "24px",
    right: "24px",
    padding: "12px 20px",
    borderRadius: "10px",
    background: "#059669",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: 9999,
    transition: "opacity 0.3s",
  } satisfies CSSProperties,
};

// ── Component ────────────────────────────────────────────

export default function BrandKitPage() {
  const [kit, setKit] = useState<BrandKitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Load brand kit
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/design/brand-kit");
        if (res.ok) {
          const data = (await res.json()) as BrandKitData;
          setKit(data);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!kit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/design/brand-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "default", kit }),
      });
      if (res.ok) {
        setToast("브랜드 킷이 저장되었습니다");
        setTimeout(() => setToast(null), 2500);
      }
    } finally {
      setSaving(false);
    }
  }, [kit]);

  // Patch helpers
  const patchKit = useCallback((patch: Partial<BrandKitData>) => {
    setKit((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const patchColors = useCallback((patch: Partial<BrandKitData["colors"]>) => {
    setKit((prev) => {
      if (!prev) return prev;
      return { ...prev, colors: { ...prev.colors, ...patch } };
    });
  }, []);

  const patchTypo = useCallback(
    (role: "heading" | "body" | "accent", patch: Partial<BrandKitData["typography"]["heading"]>) => {
      setKit((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          typography: {
            ...prev.typography,
            [role]: { ...prev.typography[role], ...patch },
          },
        };
      });
    },
    [],
  );

  const patchLayout = useCallback((patch: Partial<BrandKitData["layout"]>) => {
    setKit((prev) => {
      if (!prev) return prev;
      return { ...prev, layout: { ...prev.layout, ...patch } };
    });
  }, []);

  if (loading || !kit) {
    return (
      <div style={s.page}>
        <p style={{ color: "var(--text-secondary)" }}>브랜드 킷을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>브랜드 킷</h1>
          <p style={s.subtitle}>디자인 전체에 적용되는 브랜드 아이덴티티를 설정합니다.</p>
        </div>
        <button
          type="button"
          style={{ ...s.saveBtn, opacity: saving ? 0.6 : 1 }}
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      {/* Kit Name */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>기본 정보</h2>
        <div style={s.row}>
          <span style={s.label}>킷 이름</span>
          <input
            style={s.input}
            value={kit.name}
            onChange={(e) => patchKit({ name: e.target.value })}
          />
        </div>
      </div>

      {/* Colors */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>컬러</h2>

        {([
          ["primary", "메인 컬러", kit.colors.primary],
          ["secondary", "보조 컬러", kit.colors.secondary],
          ["accent", "강조 컬러", kit.colors.accent],
        ] as const).map(([key, label, value]) => (
          <div key={key} style={s.row}>
            <span style={s.label}>{label}</span>
            <div style={s.colorRow}>
              <input
                type="color"
                style={s.colorInput}
                value={value}
                onChange={(e) => patchColors({ [key]: e.target.value })}
              />
              <input
                style={{ ...s.input, width: "100px", flex: "none" }}
                value={value}
                onChange={(e) => patchColors({ [key]: e.target.value })}
              />
            </div>
          </div>
        ))}

        <div style={s.row}>
          <span style={s.label}>배경 (다크)</span>
          <div style={s.colorRow}>
            <input
              type="color"
              style={s.colorInput}
              value={kit.colors.background.dark}
              onChange={(e) =>
                patchColors({ background: { ...kit.colors.background, dark: e.target.value } })
              }
            />
            <input
              style={{ ...s.input, width: "100px", flex: "none" }}
              value={kit.colors.background.dark}
              onChange={(e) =>
                patchColors({ background: { ...kit.colors.background, dark: e.target.value } })
              }
            />
          </div>
        </div>
        <div style={s.row}>
          <span style={s.label}>배경 (라이트)</span>
          <div style={s.colorRow}>
            <input
              type="color"
              style={s.colorInput}
              value={kit.colors.background.light}
              onChange={(e) =>
                patchColors({ background: { ...kit.colors.background, light: e.target.value } })
              }
            />
            <input
              style={{ ...s.input, width: "100px", flex: "none" }}
              value={kit.colors.background.light}
              onChange={(e) =>
                patchColors({ background: { ...kit.colors.background, light: e.target.value } })
              }
            />
          </div>
        </div>
        <div style={s.row}>
          <span style={s.label}>텍스트 메인</span>
          <div style={s.colorRow}>
            <input
              type="color"
              style={s.colorInput}
              value={kit.colors.text.primary}
              onChange={(e) =>
                patchColors({ text: { ...kit.colors.text, primary: e.target.value } })
              }
            />
            <input
              style={{ ...s.input, width: "100px", flex: "none" }}
              value={kit.colors.text.primary}
              onChange={(e) =>
                patchColors({ text: { ...kit.colors.text, primary: e.target.value } })
              }
            />
          </div>
        </div>

        {/* Live preview */}
        <div
          style={{
            ...s.previewCard,
            background: kit.colors.background.dark,
          }}
        >
          <p style={{ ...s.previewAccent, color: kit.colors.accent }}>PREVIEW</p>
          <p style={{ ...s.previewTitle, color: kit.colors.text.onDark, fontFamily: kit.typography.heading.fontFamily }}>
            헤드라인 미리보기
          </p>
          <p style={{ ...s.previewBody, color: kit.colors.text.onDark, fontFamily: kit.typography.body.fontFamily }}>
            본문 텍스트가 여기에 표시됩니다. 실제 디자인에서 이 폰트와 컬러가 적용됩니다.
          </p>
        </div>
      </div>

      {/* Typography */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>타이포그래피</h2>

        {(["heading", "body", "accent"] as const).map((role) => {
          const roleLabel = { heading: "제목", body: "본문", accent: "강조" }[role];
          const typo = kit.typography[role];
          return (
            <div key={role} style={{ marginBottom: "16px" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", margin: "0 0 8px" }}>
                {roleLabel}
              </p>
              <div style={s.row}>
                <span style={s.label}>폰트</span>
                <select
                  style={s.select}
                  value={typo.fontFamily}
                  onChange={(e) => patchTypo(role, { fontFamily: e.target.value })}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div style={s.row}>
                <span style={s.label}>폰트 무드</span>
                <select
                  style={s.select}
                  value={typo.fontMood}
                  onChange={(e) => patchTypo(role, { fontMood: e.target.value })}
                >
                  {FONT_MOODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {/* Layout */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>레이아웃</h2>
        {([
          ["safeMargin", "안전 여백 (px)", 20, 120],
          ["cornerRadius", "모서리 반경 (px)", 0, 40],
          ["maxTextPerSlide", "슬라이드당 최대 글자", 40, 200],
          ["maxTitleLength", "제목 최대 글자", 10, 50],
          ["slideGap", "요소 간격 (px)", 8, 48],
        ] as const).map(([key, label, min, max]) => (
          <div key={key} style={s.row}>
            <span style={s.label}>{label}</span>
            <input
              type="range"
              min={min}
              max={max}
              value={kit.layout[key]}
              onChange={(e) => patchLayout({ [key]: Number(e.target.value) })}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              style={s.numberInput}
              value={kit.layout[key]}
              onChange={(e) => patchLayout({ [key]: Number(e.target.value) })}
            />
          </div>
        ))}
      </div>

      {/* Assets */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>에셋</h2>
        {([
          ["logoUrl", "로고 URL"],
          ["logoSmallUrl", "로고마크 URL"],
          ["watermarkUrl", "워터마크 URL"],
        ] as const).map(([key, label]) => (
          <div key={key} style={s.row}>
            <span style={s.label}>{label}</span>
            <input
              style={s.input}
              value={kit.assets[key] ?? ""}
              placeholder="https://..."
              onChange={(e) =>
                setKit((prev) =>
                  prev ? { ...prev, assets: { ...prev.assets, [key]: e.target.value || undefined } } : prev,
                )
              }
            />
          </div>
        ))}
      </div>

      {/* Toast */}
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}
