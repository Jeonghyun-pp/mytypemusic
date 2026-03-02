"use client";

import { useState, useEffect } from "react";
import {
  fetchReportDetail,
  type BenchmarkReportFull,
} from "./researchStore";

interface ReportDetailProps {
  reportId: string;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function ReportDetail({
  reportId,
  onDelete,
  onClose,
}: ReportDetailProps) {
  const [report, setReport] = useState<BenchmarkReportFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchReportDetail(reportId)
      .then(setReport)
      .finally(() => setLoading(false));
  }, [reportId]);

  if (loading) {
    return (
      <div style={s.panel}>
        <p style={s.loadingText}>로딩 중...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={s.panel}>
        <p style={s.loadingText}>리포트를 찾을 수 없습니다</p>
      </div>
    );
  }

  const screenshots = (report.screenshots ?? []) as Array<{
    dataUri: string;
    label: string;
  }>;

  const slideComp = report.slideComposition as Record<string, unknown> | null;
  const writing = report.writingStyle as Record<string, unknown> | null;
  const visual = report.visualDesign as Record<string, unknown> | null;
  const insights = report.insights as Record<string, unknown> | null;

  return (
    <div style={s.panel}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h3 style={s.title}>{report.title}</h3>
          {report.source && <p style={s.source}>{report.source}</p>}
        </div>
        <button type="button" style={s.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Screenshots gallery */}
      {screenshots.length > 0 && (
        <div style={s.gallery}>
          {screenshots.map((ss, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={ss.dataUri}
              alt={ss.label}
              style={s.galleryImg}
            />
          ))}
        </div>
      )}

      {/* Slide Composition */}
      {slideComp && (
        <Section title="슬라이드 구성">
          <KV label="평균 슬라이드 수" value={String(slideComp.estimatedAvgSlides ?? "")} />
          <KV label="진행 패턴" value={String(slideComp.slideProgression ?? "")} />
          <KV label="이미지:텍스트 비율" value={String(slideComp.imageToTextRatio ?? "")} />
          {slideComp.coverSlide != null && (
            <SubSection title="표지 슬라이드">
              <JsonBlock data={slideComp.coverSlide as Record<string, unknown>} />
            </SubSection>
          )}
          {slideComp.bodySlides != null && (
            <SubSection title="본문 슬라이드">
              <JsonBlock data={slideComp.bodySlides as Record<string, unknown>} />
            </SubSection>
          )}
          {slideComp.closingSlide != null && (
            <SubSection title="마무리 슬라이드">
              <JsonBlock data={slideComp.closingSlide as Record<string, unknown>} />
            </SubSection>
          )}
        </Section>
      )}

      {/* Writing Style */}
      {writing && (
        <Section title="글쓰기 스타일">
          <KV label="전체 톤" value={String(writing.overallTone ?? "")} />
          <KV label="톤 설명" value={String(writing.toneDescription ?? "")} />
          <KV label="존칭 수준" value={String(writing.formality ?? "")} />
          <KV label="인칭" value={String(writing.personPOV ?? "")} />
          {writing.hookStrategy != null && (
            <SubSection title="훅 전략">
              <JsonBlock data={writing.hookStrategy as Record<string, unknown>} />
            </SubSection>
          )}
          {writing.emojiUsage != null && (
            <SubSection title="이모지 사용">
              <JsonBlock data={writing.emojiUsage as Record<string, unknown>} />
            </SubSection>
          )}
          {writing.hashtagStrategy != null && (
            <SubSection title="해시태그 전략">
              <JsonBlock data={writing.hashtagStrategy as Record<string, unknown>} />
            </SubSection>
          )}
        </Section>
      )}

      {/* Visual Design */}
      {visual && (
        <Section title="시각 디자인">
          {Array.isArray(visual.dominantColors) && (
            <div style={s.paletteRow}>
              {(visual.dominantColors as string[]).map((c) => (
                <div
                  key={c}
                  style={{ ...s.colorSwatch, background: c }}
                  title={c}
                />
              ))}
            </div>
          )}
          <KV label="색상 전략" value={String(visual.colorStrategy ?? "")} />
          {visual.typographyStyle != null && (
            <SubSection title="타이포그래피">
              <JsonBlock data={visual.typographyStyle as Record<string, unknown>} />
            </SubSection>
          )}
          {visual.photoTreatment != null && (
            <SubSection title="사진 처리">
              <JsonBlock data={visual.photoTreatment as Record<string, unknown>} />
            </SubSection>
          )}
          {visual.brandElements != null && (
            <SubSection title="브랜드 요소">
              <JsonBlock data={visual.brandElements as Record<string, unknown>} />
            </SubSection>
          )}
        </Section>
      )}

      {/* Insights */}
      {insights && (
        <Section title="인사이트">
          {Array.isArray(insights.strengths) && (
            <SubSection title="강점">
              <ul style={s.list}>
                {(insights.strengths as string[]).map((s, i) => (
                  <li key={i} style={sItem.listItem}>
                    {s}
                  </li>
                ))}
              </ul>
            </SubSection>
          )}
          {Array.isArray(insights.weaknesses) && (
            <SubSection title="약점">
              <ul style={s.list}>
                {(insights.weaknesses as string[]).map((s, i) => (
                  <li key={i} style={sItem.listItem}>
                    {s}
                  </li>
                ))}
              </ul>
            </SubSection>
          )}
          {Array.isArray(insights.applicableIdeas) && (
            <SubSection title="적용 가능 아이디어">
              <ul style={s.list}>
                {(insights.applicableIdeas as string[]).map((s, i) => (
                  <li key={i} style={sItem.listItemAccent}>
                    {s}
                  </li>
                ))}
              </ul>
            </SubSection>
          )}
        </Section>
      )}

      {/* Delete */}
      <button
        type="button"
        style={s.deleteBtn}
        onClick={() => onDelete(report.id)}
      >
        리포트 삭제
      </button>
    </div>
  );
}

// ── Helper components ────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={s.section}>
      <h4 style={s.sectionTitle}>{title}</h4>
      <div style={s.sectionBody}>{children}</div>
    </div>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={s.subSection}>
      <span style={s.subSectionTitle}>{title}</span>
      {children}
    </div>
  );
}

function KV({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div style={s.kvRow}>
      <span style={s.kvLabel}>{label}</span>
      <span style={s.kvValue}>{String(value)}</span>
    </div>
  );
}

function JsonBlock({ data }: { data: Record<string, unknown> }) {
  return (
    <div style={s.jsonBlock}>
      {Object.entries(data).map(([key, val]) => {
        const display = Array.isArray(val)
          ? val.join(", ")
          : typeof val === "object" && val !== null
            ? JSON.stringify(val)
            : String(val ?? "");
        return (
          <div key={key} style={s.kvRow}>
            <span style={s.kvLabel}>{key}</span>
            <span style={s.kvValue}>{display}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────

const sItem = {
  listItem: {
    fontSize: "12px",
    color: "var(--text)",
    lineHeight: 1.5,
    marginBottom: "4px",
  } as React.CSSProperties,

  listItemAccent: {
    fontSize: "12px",
    color: "var(--accent)",
    lineHeight: 1.5,
    marginBottom: "4px",
    fontWeight: 500,
  } as React.CSSProperties,
};

const s = {
  panel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    padding: "20px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    boxShadow: "var(--shadow-card)",
    maxHeight: "calc(100vh - 160px)",
    overflowY: "auto" as const,
  } as React.CSSProperties,

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  } as React.CSSProperties,

  title: {
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
  } as React.CSSProperties,

  source: {
    fontSize: "12px",
    color: "var(--accent)",
    margin: "4px 0 0",
  } as React.CSSProperties,

  closeBtn: {
    width: "30px",
    height: "30px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as React.CSSProperties,

  loadingText: {
    fontSize: "13px",
    color: "var(--text-muted)",
    textAlign: "center" as const,
    padding: "40px 0",
  } as React.CSSProperties,

  gallery: {
    display: "flex",
    gap: "8px",
    overflowX: "auto" as const,
    paddingBottom: "4px",
  } as React.CSSProperties,

  galleryImg: {
    height: "100px",
    borderRadius: "8px",
    objectFit: "cover" as const,
    flexShrink: 0,
  } as React.CSSProperties,

  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
    padding: "14px",
    background: "var(--bg-input)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border-light)",
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
  } as React.CSSProperties,

  sectionBody: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  } as React.CSSProperties,

  subSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
    paddingLeft: "8px",
    borderLeft: "2px solid var(--border-light)",
    marginTop: "4px",
  } as React.CSSProperties,

  subSectionTitle: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  } as React.CSSProperties,

  kvRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  } as React.CSSProperties,

  kvLabel: {
    fontSize: "11px",
    color: "var(--text-muted)",
    fontWeight: 500,
    flexShrink: 0,
  } as React.CSSProperties,

  kvValue: {
    fontSize: "11px",
    color: "var(--text)",
    fontWeight: 600,
    textAlign: "right" as const,
    wordBreak: "break-word" as const,
  } as React.CSSProperties,

  jsonBlock: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  } as React.CSSProperties,

  paletteRow: {
    display: "flex",
    gap: "6px",
    marginBottom: "4px",
  } as React.CSSProperties,

  colorSwatch: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: "2px solid var(--border-light)",
  } as React.CSSProperties,

  list: {
    margin: 0,
    paddingLeft: "16px",
  } as React.CSSProperties,

  deleteBtn: {
    padding: "9px 0",
    borderRadius: "10px",
    border: "1px solid var(--red)",
    background: "transparent",
    color: "var(--red)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as React.CSSProperties,
};
