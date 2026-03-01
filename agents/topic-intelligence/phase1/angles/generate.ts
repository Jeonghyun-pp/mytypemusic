// ============================================================================
// Types
// ============================================================================

export type AnglesOptions = {
  maxAngles?: number; // default 10
  coverageHint?: string; // e.g. "최근 24시간 기사 3개 / 매체 2곳"
};

// ============================================================================
// Helpers
// ============================================================================

/** Fisher-Yates shuffle (in-place). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Pick `n` random items from `pool`, sampling across all items. */
function sampleFromPool(pool: string[], n: number): string[] {
  const shuffled = shuffle([...pool]);
  return shuffled.slice(0, n);
}

// ============================================================================
// Music Templates — 7 categories, ~70 ideas
// ============================================================================

// 1) 씬 뉴스 & 기록
const MUSIC_SCENE_NEWS = [
  "주간 밴드 뉴스 브리핑",
  "이번 주 신보 총정리",
  "공연 리포트: 누가 어디에서 공연했나",
  "내한 속보: OO 밴드 한국 온다",
  "페스티벌 헤드라이너 한눈에",
  "온스테이지 레전드 순간 TOP5",
  "영상에 쓰인 밴드곡 모음",
  "연말 씬 총결산: 올해의 인디",
  "이번 달 티켓팅 후기 & 팁",
  "신보 사운드 간단 감상 포인트",
];

// 2) 공연 & 체험형
const MUSIC_LIVE_EXPERIENCE = [
  "라이브 공연 후기",
  "락페 체험기",
  "공연 셋리스트 해석 카드",
  "공연에서 봤던 순간 TOP3",
  "공연 포스터 아카이브",
  "슬램존 경험기",
  "라이브 장비 리얼 후기",
  "공연 아쉬웠던 점: 다음엔 이렇게",
  "현장 사진으로 보는 분위기",
  "티켓팅 성공 노하우 카드",
];

// 3) 아티스트 심층 & 비하인드
const MUSIC_ARTIST_DEEP = [
  "OO 밴드 소개 | 빠르게 보는 포인트",
  "OO 밴드 세계관 한눈에",
  "무대 밖의 뮤지션: 루틴 공개",
  "밴드 숨은 이야기: 데뷔 비하인드",
  "사운드 메이킹 하이라이트",
  "멤버별 리추얼/버릇 카드",
  "앨범 커버 아트의 의미",
  "가사 속 의미 꿀팁 요약",
  "OO곡 탄생 비하인드",
  "연예인 + 밴드 관계 맵",
];

// 4) 감성 플레이리스트
const MUSIC_PLAYLIST = [
  "비오는 날 감성 플레이리스트",
  "월요일 전투력 상승 곡 TOP10",
  "이별에 듣는 노래 추천 7",
  "여행 플레이리스트 무드별",
  "추억 소환 플레이리스트",
  "잠이 안 올 때 듣는 노래",
  "학창 시절 OST 모음",
  "운전할 때 좋은 사운드트랙",
  "계절별 감성 플레이리스트",
  "MBTI별 추천 노래 카드",
];

// 5) 사운드/덕후 분석
const MUSIC_SOUND_ANALYSIS = [
  "기타 갈드컵: OO vs OO",
  "국내 인디 기타 리프 모음",
  "OO 앰프 톤 분석 카드",
  "디스토션 톤 비교 체크",
  "베이스라인 추천 모음",
  "드럼 패턴 해부 카드",
  "사운드 믹싱 TIP 간단 요약",
  "OO 밴드 톤 시그니처 카드",
  "악기/장비 추천 체크리스트",
  "음향 엔지니어링 꿀팁",
];

// 6) 문화 연결형
const MUSIC_CULTURE_CROSSOVER = [
  "애니 주제가로 보는 락",
  "OO 게임 OST 락 특집",
  "영화 속 베스트 락 트랙",
  "스포츠 경기와 음악 조합",
  "뮤직비디오 숨은 장면 해석",
  "OO 밴드가 광고에 쓰인 이유",
  "SNS #밴드밈 모음",
  "틱톡/릴스 사운드 챌린지 큐레이션",
  "팬 커버 이벤트 카드",
  "음악 관련 밈 카드",
];

// 7) 시즌/테마 특집
const MUSIC_SEASONAL = [
  "OO월 플레이리스트 특집",
  "OO년도 인디 명반 TOP10",
  "밴드 데뷔기념 카드",
  "OO 페스티벌 프리뷰",
  "연말 정리 BEST 트랙",
  "여름 락 배경음악 리스트",
  "겨울 드라이브 음악 큐레이션",
  "봄 감성 음악 트렌드 카드",
  "운동할 때 듣는 음악 리스트",
  "공연 시즌 티켓 일정",
];

/** All music template pools grouped by category. */
const MUSIC_POOLS = [
  MUSIC_SCENE_NEWS,
  MUSIC_LIVE_EXPERIENCE,
  MUSIC_ARTIST_DEEP,
  MUSIC_PLAYLIST,
  MUSIC_SOUND_ANALYSIS,
  MUSIC_CULTURE_CROSSOVER,
  MUSIC_SEASONAL,
] as const;

// ============================================================================
// Base Templates (non-music)
// ============================================================================

function commonTemplates(topic: string): string[] {
  return [
    `${topic} 한 장 요약`,
    `핵심만 3줄: 지금 무슨 일이야?`,
    `초보자용 배경 설명: 왜 중요한가`,
  ];
}

function lifestyleTemplates(topic: string): string[] {
  return [
    `요즘 ${topic} 트렌드, 뭐가 달라졌나`,
    `실제로 써보는/가보는 체크리스트`,
    `가격/시즌/주의사항 한 번에`,
  ];
}

function newsDepthTemplates(topic: string): string[] {
  return [
    `${topic} 언제/어디서 발생했나`,
    `지금 무슨 일이 벌어지고 있나`,
  ];
}

function analysisDepthTemplates(topic: string): string[] {
  return [
    `${topic} 왜 중요한가: 원인과 배경`,
    `이후 영향과 전망은?`,
    `전문가들이 보는 핵심 이슈`,
  ];
}

function coverageTemplates(hint: string): string[] {
  return [
    `지금 왜 뜨나: ${hint}`,
    `한눈에 보는 커버리지: ${hint}`,
  ];
}

/**
 * Build music angle templates by sampling across all 7 categories.
 * Picks 1-2 from each category for diversity, then fills remaining.
 */
function musicTemplates(topic: string, maxAngles: number): string[] {
  const perCategory = Math.max(1, Math.floor(maxAngles / MUSIC_POOLS.length));
  const angles: string[] = [];

  for (const pool of MUSIC_POOLS) {
    const sampled = sampleFromPool(pool, perCategory);
    angles.push(...sampled);
  }

  // Fill any remaining from the full pool
  if (angles.length < maxAngles) {
    const allMusic = MUSIC_POOLS.flat();
    const used = new Set(angles);
    const remaining = allMusic.filter((a) => !used.has(a));
    angles.push(...sampleFromPool(remaining, maxAngles - angles.length));
  }

  // Replace OO with topic name where applicable
  return angles.slice(0, maxAngles).map((a) =>
    a.replace(/OO/g, topic),
  );
}

// ============================================================================
// Evergreen Templates
// ============================================================================

const EVERGREEN_COMMON = [
  "한 눈에 보는 타임라인",
  "핵심 업적 정리",
  "입문자를 위한 가이드",
];

const EVERGREEN_MUSIC = [
  "디스코그래피 하이라이트",
  "대표곡 베스트 5",
  "음악적 영향과 유산",
  "장르별 추천곡",
  "밴드 소개 | 빠르게 보는 포인트",
  "세계관 한눈에",
  "숨은 이야기: 데뷔 비하인드",
  "앨범 커버 아트의 의미",
  "가사 속 의미 꿀팁 요약",
  "톤 시그니처 카드",
];

const EVERGREEN_LIFESTYLE = [
  "역사와 배경",
  "초보자 가이드",
  "알아두면 좋은 팁",
];

/**
 * Generate angle candidates for evergreen (non-news) topics.
 */
export function generateEvergreenAngles(
  normalizedTopic: string,
  category: "music" | "lifestyle" | undefined,
  opts?: AnglesOptions,
): string[] {
  const maxAngles = opts?.maxAngles ?? 10;
  const angles: string[] = [];

  angles.push(...EVERGREEN_COMMON.map((a) => `${normalizedTopic} — ${a}`));

  if (category === "music") {
    // Sample from evergreen + all music pools for variety
    const evergreenSampled = sampleFromPool(EVERGREEN_MUSIC, 3);
    angles.push(...evergreenSampled.map((a) => `${normalizedTopic} — ${a}`));

    // Add a few from the broader music pools
    const allMusic = MUSIC_POOLS.flat().map((a) => a.replace(/OO/g, normalizedTopic));
    const used = new Set(angles);
    const remaining = allMusic.filter((a) => !used.has(`${normalizedTopic} — ${a}`) && !used.has(a));
    const extraSampled = sampleFromPool(remaining, 4);
    angles.push(...extraSampled);
  } else if (category === "lifestyle") {
    angles.push(...EVERGREEN_LIFESTYLE.map((a) => `${normalizedTopic} — ${a}`));
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const a of angles) {
    if (!seen.has(a)) {
      seen.add(a);
      unique.push(a);
    }
  }

  return unique.slice(0, maxAngles);
}

/** Alias — used by LLM angle generator as template reference. */
export const getTemplateEvergreenAngles = generateEvergreenAngles;

// ============================================================================
// Trending angle generation
// ============================================================================

/**
 * Generate angle candidates from templates.
 *
 * For music: samples across 7 content categories (~70 templates) for diversity.
 * For others: uses common + category-specific templates.
 * Adds depth-specific and coverage hint angles.
 */
export function generateAngles(
  normalizedTopic: string,
  category: "music" | "lifestyle" | undefined,
  depth: "news" | "explainer" | "analysis",
  opts?: AnglesOptions,
): string[] {
  const maxAngles = opts?.maxAngles ?? 10;

  const angles: string[] = [];

  if (depth === "news") {
    angles.push(...newsDepthTemplates(normalizedTopic));
  }

  angles.push(...commonTemplates(normalizedTopic));

  if (category === "music") {
    // Sample diverse angles from 7 music categories
    const musicSampleCount = Math.max(4, maxAngles - angles.length - 2);
    angles.push(...musicTemplates(normalizedTopic, musicSampleCount));
  } else if (category === "lifestyle") {
    angles.push(...lifestyleTemplates(normalizedTopic));
  }

  if (opts?.coverageHint) {
    angles.push(...coverageTemplates(opts.coverageHint));
  }

  if (depth === "analysis") {
    angles.push(...analysisDepthTemplates(normalizedTopic));
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const a of angles) {
    if (!seen.has(a)) {
      seen.add(a);
      unique.push(a);
    }
  }

  return unique.slice(0, maxAngles);
}

/** Alias — used by LLM angle generator as template reference. */
export const getTemplateAngles = generateAngles;
