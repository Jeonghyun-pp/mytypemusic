"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// ── Route → Guide Data ──────────────────────────────

interface GuideItem {
  title: string;
  desc: string;
  tips?: string[];
}

const GUIDES: Record<string, GuideItem> = {
  "/studio": {
    title: "홈 대시보드",
    desc: "오늘 할 일, AI 제안, 이번 주 일정을 한눈에 확인하세요.",
    tips: [
      "AI 오늘의 제안에서 카드뉴스/블로그/빠른 발행을 바로 시작할 수 있습니다",
      "파이프라인 상태 칩을 클릭하면 해당 관리 페이지로 이동합니다",
      "우측 하단 + 버튼으로 어디서든 빠르게 포스트를 작성할 수 있습니다",
    ],
  },
  "/studio/create": {
    title: "Create Hub",
    desc: "주제 하나를 입력하면 SNS 포스트, 블로그 글, 카드뉴스 3가지 포맷을 동시에 생성합니다.",
    tips: [
      "페르소나를 선택하면 해당 스타일로 콘텐츠가 생성됩니다",
      "결과 카드에서 원하는 포맷을 선택하여 편집/발행으로 이동하세요",
    ],
  },
  "/studio/design": {
    title: "Design Editor",
    desc: "카드뉴스 에디터입니다. 최대 10장의 슬라이드를 편집하고 PNG 다운로드 또는 SNS 발행할 수 있습니다.",
    tips: [
      "프리셋으로 원클릭 스타일 적용 (news, beauty, tech, music 등)",
      "레이어 시스템으로 텍스트/이미지/도형/SVG를 자유롭게 배치",
      "Ctrl+Z / Ctrl+Shift+Z 로 실행 취소/다시 실행 (최대 50단계)",
      "코드 모드에서 직접 HTML을 입력할 수 있습니다",
    ],
  },
  "/studio/reels": {
    title: "Reels Editor",
    desc: "세로형(1080x1920) 숏폼 영상을 편집합니다.",
    tips: [
      "영상을 드래그 앤 드롭으로 업로드하세요",
      "타임라인에서 시작/종료 지점을 조정하여 트리밍",
      "텍스트 오버레이를 추가하고 위치/타이밍을 설정할 수 있습니다",
    ],
  },
  "/studio/blog": {
    title: "AI 블로그",
    desc: "AI 에디토리얼 파이프라인을 통해 2000자 이상의 블로그 글을 자동 생성합니다.",
    tips: [
      "주제 입력 후 생성까지 1~2분 소요됩니다",
      "SEO 제목(60자), 메타 설명(160자)을 편집하세요",
      "생성된 글에서 바로 SNS 발행도 가능합니다",
    ],
  },
  "/studio/import": {
    title: "Import",
    desc: "웹 URL을 붙여넣으면 내용을 추출하여 SNS 포스트로 변환합니다.",
    tips: [
      "여러 URL을 줄 단위로 입력할 수 있습니다",
      "추가 지시사항으로 톤, 타겟, 스타일을 지정하세요",
      "플랫폼별(Threads, Instagram, X, LinkedIn) 포스트를 생성합니다",
    ],
  },
  "/studio/calendar": {
    title: "캘린더",
    desc: "월간 캘린더에서 콘텐츠 일정을 관리합니다.",
    tips: [
      "날짜를 클릭하면 빠른 제작 버튼이 나타납니다",
      "빠른 포스트는 해당 날짜 오후 6시로 예약이 자동 세팅됩니다",
      "이벤트 칩의 색상으로 콘텐츠 타입을 구분할 수 있습니다",
    ],
  },
  "/studio/plan": {
    title: "AI 콘텐츠 기획",
    desc: "AI가 기간별 콘텐츠 발행 계획을 생성합니다. 기간, 빈도, 타입 비율을 설정하세요.",
    tips: [
      "고급 설정에서 타입 비율과 집중/제외 카테고리를 조정할 수 있습니다",
      "생성된 계획을 캘린더에 일괄 추가하거나 ICS로 내보낼 수 있습니다",
      "개별 항목의 날짜, 제목, 설명을 자유롭게 편집하세요",
    ],
  },
  "/studio/research": {
    title: "레퍼런스 분석",
    desc: "SNS 게시물이나 디자인 스크린샷을 업로드하면 AI가 스타일을 분석합니다.",
    tips: [
      "스크린샷을 드래그 앤 드롭으로 최대 10장까지 업로드",
      "소스 URL이나 핸들을 함께 입력하면 더 정확한 분석이 가능합니다",
    ],
  },
  "/studio/database": {
    title: "디자인 레퍼런스 DB",
    desc: "디자인 레퍼런스를 수집하고 관리하는 라이브러리입니다.",
    tips: [
      "References: 카테고리별 디자인 레퍼런스 업로드/관리",
      "Mood Search: 무드 키워드로 비주얼 레퍼런스 검색",
      "Spotify: 음악/아티스트 검색으로 앨범 커버 등 뮤직 레퍼런스 탐색",
    ],
  },
  "/studio/publish": {
    title: "발행 관리",
    desc: "SNS 발행물을 작성하고 관리합니다. 즉시 발행, 예약 발행, 드래프트를 지원합니다.",
    tips: [
      "계정 선택 시 과거 참여율 기반 최적 시간대가 표시됩니다",
      "추천 시간을 클릭하면 예약 시간에 자동 반영됩니다",
      "상태별 필터로 발행물을 관리하세요 (대기/예약/완료/실패)",
    ],
  },
  "/studio/autopilot": {
    title: "Autopilot",
    desc: "AI가 자동으로 트렌드 기반 콘텐츠를 생성하고 발행합니다.",
    tips: [
      "수동 승인 모드를 추천합니다 - AI 제안을 검토 후 승인/거절",
      "주제 키워드를 설정하면 해당 분야의 콘텐츠를 생성합니다",
      "일일 발행 수를 1~5개로 조절할 수 있습니다",
    ],
  },
  "/studio/inbox": {
    title: "메시지 수신함",
    desc: "연결된 SNS 계정의 댓글과 DM을 한 곳에서 관리합니다.",
    tips: [
      "필터: 전체, 미읽음, 질문, 칭찬, 불만, 스팸",
      "AI 추천 답변을 활용하여 빠르게 답장할 수 있습니다",
      "자동 답장 규칙을 설정하면 특정 유형의 메시지에 자동 응답합니다",
    ],
  },
  "/studio/campaigns": {
    title: "캠페인",
    desc: "키워드 기반 자동 댓글 캠페인을 관리합니다.",
    tips: [
      "키워드를 설정하면 관련 게시물에 자동으로 댓글을 남깁니다",
      "일일 한도를 적절히 설정하세요 (플랫폼 이용약관 준수)",
      "댓글 로그에서 실행 결과를 확인할 수 있습니다",
    ],
  },
  "/studio/analytics": {
    title: "성과 분석",
    desc: "SNS 계정의 팔로워, 도달, 참여율 등 성과를 분석합니다.",
    tips: [
      "계정별 팔로워/도달/참여율 차트를 확인하세요",
      "인기 주제에서 바로 해당 주제로 콘텐츠를 제작할 수 있습니다",
      "AI 인사이트 탭에서 챗봇에게 성과를 질문할 수 있습니다",
    ],
  },
  "/studio/persona": {
    title: "글쓰기 페르소나",
    desc: "AI가 콘텐츠 작성 시 사용하는 글쓰기 스타일을 정의합니다.",
    tips: [
      "기존 글 2개 이상을 붙여넣으면 AI가 스타일을 자동 추출합니다",
      "4종 프리셋: 프로 마케터, 캐주얼 크리에이터, 교육 전문가, 오피니언 리더",
      "테스트 기능으로 페르소나 스타일의 샘플 텍스트를 미리 확인하세요",
    ],
  },
  "/studio/accounts": {
    title: "SNS 계정 관리",
    desc: "SNS 플랫폼 계정을 연결하고 관리합니다.",
    tips: [
      "지원: Threads, Instagram, X, YouTube, TikTok, LinkedIn, WordPress",
      "플랫폼 버튼 클릭 후 OAuth 인증으로 자동 연결됩니다",
      "토큰 만료 상태를 확인하고 필요 시 재연결하세요",
    ],
  },
};

// ── Component ────────────────────────────────────────

export default function FeatureGuide() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Find matching guide (exact match or longest prefix match)
  const guide = GUIDES[pathname] ?? null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!guide) return null;

  return (
    <div ref={ref} style={s.container}>
      {/* ? Button */}
      <button
        className="guide-trigger"
        style={s.trigger}
        onClick={() => setOpen(!open)}
        title="이 페이지 도움말"
      >
        ?
      </button>

      {/* Bubble */}
      {open && (
        <div style={s.bubble}>
          {/* Arrow */}
          <div style={s.arrow} />

          <div style={s.bubbleHeader}>
            <span style={s.bubbleTitle}>{guide.title}</span>
            <button style={s.closeBtn} onClick={() => setOpen(false)}>
              &times;
            </button>
          </div>

          <p style={s.bubbleDesc}>{guide.desc}</p>

          {guide.tips && guide.tips.length > 0 && (
            <ul style={s.tipList}>
              {guide.tips.map((tip, i) => (
                <li key={i} style={s.tipItem}>{tip}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    zIndex: 50,
  },
  trigger: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "1.5px solid var(--border)",
    background: "var(--bg-card)",
    color: "var(--text-muted)",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
    flexShrink: 0,
  },
  bubble: {
    position: "absolute",
    top: "calc(100% + 12px)",
    right: 0,
    width: 320,
    padding: "16px 18px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    boxShadow: "0 8px 30px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)",
    animation: "bubbleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
    zIndex: 100,
  },
  arrow: {
    position: "absolute",
    top: -6,
    right: 10,
    width: 12,
    height: 12,
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRight: "none",
    borderBottom: "none",
    transform: "rotate(45deg)",
  },
  bubbleHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  bubbleTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "var(--accent)",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    fontSize: 18,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  },
  bubbleDesc: {
    fontSize: 13,
    color: "var(--text)",
    lineHeight: 1.6,
    margin: 0,
    marginBottom: 10,
  },
  tipList: {
    margin: 0,
    paddingLeft: 16,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  tipItem: {
    fontSize: 12,
    color: "var(--text-muted)",
    lineHeight: 1.5,
  },
};
