/** 콘텐츠 카테고리 체계 — Design / Reels / Calendar 공통 */

export interface ContentCategory {
  id: string;
  label: string;
  description: string;
}

export const CONTENT_CATEGORIES: ContentCategory[] = [
  {
    id: "scene-news",
    label: "[1] 씬 뉴스 & 기록",
    description: "주간 밴드 뉴스, 신보 정리, 내한 소식, 페스티벌 라인업",
  },
  {
    id: "live-experience",
    label: "[2] 공연 & 현장 체험",
    description: "라이브 후기, 락페 체험기, 티켓팅 후기, 셋리스트 분석",
  },
  {
    id: "artist-deep-dive",
    label: "[3] 아티스트 심층 & 비하인드",
    description: "가수/밴드 소개, 세계관 정리, 숨은 뒷이야기",
  },
  {
    id: "playlist",
    label: "[4] 감성 플레이리스트",
    description: "비오는 날, 월요일 전투력, 이별, 여행, MBTI",
  },
  {
    id: "nerd-analysis",
    label: "[5] 덕후 분석 & 갈드컵",
    description: "기타 갈드컵, 리프 모음, 톤 비교, 장비 분석",
  },
  {
    id: "culture-crossover",
    label: "[6] 문화 연결형",
    description: "애니 주제가, 게임/롤드컵 음악, 밴드 밈, OST",
  },
  {
    id: "seasonal-special",
    label: "[7] 시즌/테마 특집",
    description: "월간 특집, 연도별 인디 명반, 계절 특집, 페스티벌 프리뷰",
  },
  {
    id: "song-spotlight",
    label: "[8] 한곡 소개",
    description: "하루 한곡, 숨은 명곡 발굴, 신곡 리뷰, 곡 해설 & 감상 포인트",
  },
];
