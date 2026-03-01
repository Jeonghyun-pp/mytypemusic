# Topic Intelligence 에이전트 - 모든 기능 가이드

## 📋 목차

1. [Phase 0: 토픽 요청 생성](#phase-0-토픽-요청-생성)
2. [Phase 1: RSS 수집 및 인텔리전스 생성](#phase-1-rss-수집-및-인텔리전스-생성)
3. [Bridge: Agent 2로 데이터 변환](#bridge-agent-2로-데이터-변환)
4. [Phase 2: 트렌드 시드 및 배치 처리](#phase-2-트렌드-시드-및-배치-처리)

---

## Phase 0: 토픽 요청 생성

### 기능: 프롬프트나 키워드로부터 토픽 요청 생성

**명령어:**
```bash
npx tsx agents/topic-intelligence/cli.ts request --prompt "이번주 아이브 컴백 소식 정리해줘"
# 또는
npx tsx agents/topic-intelligence/cli.ts request --keyword "콜드플레이 내한"
```

**옵션:**
- `--prompt`: 자연어 프롬프트 (예: "이번주 아이브 컴백 소식 정리해줘")
- `--keyword`: 단순 키워드 (예: "콜드플레이 내한")
- `--category`: 카테고리 강제 지정 (`music` 또는 `lifestyle`)

**기능:**
1. 프롬프트에서 시드 키워드 추출 (따옴표 안 텍스트 우선)
2. 카테고리 자동 추론:
   - `music`: 밴드, 내한, 콘서트, 공연, 투어, 신곡, 앨범, 차트, 페스티벌, 라인업
   - `lifestyle`: 여행, 맛집, 소비, 계절, 패션, 뷰티, 라이프, 인테리어, 건강, 트렌드
3. 깊이(depth) 자동 추론:
   - `news`: 속보, 발표, 공개, 확정, 일정
   - `analysis`: 분석, 전망, 영향, 배경, 논란
   - `explainer`: 정리, 설명, 가이드, 쉽게 (기본값)
4. 토픽 ID 생성 (정규화된 토픽명 + 타임스탬프)
5. `topic-request.json` 저장

**출력 파일:**
- `outputs/{topicId}/topic-request.json`

**기본값:**
- `mode`: "manual"
- `region`: "KR"
- `depth`: "explainer"
- `maxArticles`: 10
- `recencyDays`: 7

---

## Phase 1: RSS 수집 및 인텔리전스 생성

Phase 1은 5단계(A, B, C, D, E)로 구성되어 있으며, 순차적으로 실행됩니다.

### Phase 1-A: RSS 피드 수집 및 필터링

**명령어:**
```bash
npx tsx agents/topic-intelligence/cli.ts intel --topicId "아이브-20260215-abc123" --phase A
```

**기능:**
1. 카테고리별 RSS 피드 목록 로드:
   - `music`: 연합뉴스 연예, SBS K-POP, MBC 연예, 한겨레 문화, 경향신문 문화 등
   - `lifestyle`: 관련 라이프스타일 피드
2. 모든 RSS 피드 병렬 수집
3. RSS XML 파싱 및 정규화:
   - 제목, URL, 발행일, 출판사 추출
   - `NormalizedArticle` 형식으로 변환
4. 최신성 필터링:
   - `recencyDays` (기본 7일) 이내 기사만 유지
   - 발행일 없는 기사는 유지 (나중에 위험 노트로 기록)
5. URL 중복 제거

**출력:**
- 콘솔: 수집된 피드 수, 원본 기사 수, 필터링 후 기사 수
- 에러: 실패한 피드 목록

**다음 단계:** Phase 1-B

---

### Phase 1-B: 관련성 점수 계산 및 상위 K개 선택

**명령어:**
```bash
npx tsx agents/topic-intelligence/cli.ts intel --topicId "아이브-20260215-abc123" --phase B
```

**기능:**
1. Phase 1-A 자동 실행
2. 각 기사에 관련성 점수 부여:
   - 시드 키워드 매칭 점수
   - 카테고리 일치 보너스
   - 제목/내용 키워드 빈도
3. 점수 내림차순 정렬
4. 상위 K개 선택 (`maxArticles` 기준, 기본 10개)

**출력:**
- 콘솔: 선택된 기사 목록 (점수, 제목, URL, 신호)

**다음 단계:** Phase 1-C

---

### Phase 1-C: 콘텐츠 필드 생성

**명령어:**
```bash
npx tsx agents/topic-intelligence/cli.ts intel --topicId "아이브-20260215-abc123" --phase C
```

**기능:**
1. Phase 1-B 자동 실행
2. **커버리지 분석:**
   - 소스 클러스터링: 제목 유사도 기반 그룹화
   - 모멘텀 신호 계산:
     - 최근 24시간 기사 수
     - 최근 72시간 기사 수
     - 고유 출판사 수
     - 모멘텀 점수 (0-100)
3. **핵심 사실 추출:**
   - 기사 본문에서 사실 후보 추출 (본문 없으면 제목 사용)
   - 사실 점수 계산
   - 증거 URL 수집 (각 사실을 뒷받침하는 기사 URL)
   - 중복 사실 제거
4. **각도 후보 생성:**
   - 카테고리 및 깊이에 따른 각도 생성
   - 커버리지 힌트 포함 (예: "최근 24시간 기사 5개 / 매체 3곳")
5. **이미지 쿼리 생성:**
   - 시드 키워드 기반 이미지 검색 쿼리 생성
   - 카테고리별 특화 쿼리
6. **위험 노트 생성:**
   - 발행일 누락 기사 수
   - 부족한 소스 수
   - 커버리지 요약

**출력:**
- 콘솔:
  - 커버리지 클러스터 목록
  - 모멘텀 점수 및 통계
  - 핵심 사실 목록 (증거 URL 수 포함)
  - 각도 후보 목록
  - 이미지 쿼리 목록
  - 위험 노트 목록

**다음 단계:** Phase 1-D

---

### Phase 1-D: 토픽 인텔 패키지 조립 및 저장

**명령어:**
```bash
npx tsx agents/topic-intelligence/cli.ts intel --topicId "아이브-20260215-abc123" --phase D
```

**옵션:**
- `--writeRaw true`: 원본 소스 목록도 저장 (`sources-raw.json`)

**기능:**
1. Phase 1-C 자동 실행
2. `TopicIntelPack` 객체 조립:
   - `topicId`, `normalizedTopic`, `category`
   - `sources`: 선택된 기사 목록 (제목, 출판사, URL, 발행일)
   - `keyFacts`: 핵심 사실 (최소 20자, 증거 URL ≥ 1개)
   - `angleCandidates`: 각도 후보
   - `imageQueries`: 이미지 쿼리
   - `riskNotes`: 위험 노트
   - `createdAt`: 생성 시간
3. Zod 스키마로 검증
4. `topic-intel.json` 저장
5. (선택) `sources-raw.json` 저장 (모든 수집된 기사)

**출력 파일:**
- `outputs/{topicId}/topic-intel.json` (필수)
- `outputs/{topicId}/sources-raw.json` (선택)

**출력:**
- 콘솔: 저장 경로, 토픽 인텔 요약 (소스 수, 사실 수, 각도 수 등)

**다음 단계:** Phase 1-E 또는 Bridge

---

### Phase 1-E: 기사 본문 캐싱

**명령어:**
```bash
npx tsx agents/topic-intelligence/cli.ts intel --topicId "아이브-20260215-abc123" --phase E
```

**기능:**
1. Phase 1-D 자동 실행
2. 각 소스 URL에 대해:
   - HTML 가져오기
   - 본문 텍스트 추출 (다양한 추출 방법 시도)
   - HTML 정리 및 정규화
   - `article.{idx}.json` 저장
3. 동시성 제한 (기본 3개)
4. `articles/index.json` 생성 (캐시 인덱스)

**출력 파일:**
- `outputs/{topicId}/articles/article.{idx}.json` (각 기사 본문)
- `outputs/{topicId}/articles/index.json` (캐시 인덱스)

**출력:**
- 콘솔: 캐시된 기사 수, 성공/실패 통계, 추출 방법별 통계

**용도:**
- Phase 1-C에서 본문 기반 사실 추출 시 사용
- 향후 본문 기반 분석에 활용

---

## Bridge: Agent 2로 데이터 변환

### 기능: TopicIntelPack을 Agent 2 형식으로 변환

**명령어:**
```bash
npx tsx agents/topic-intelligence/cli.ts bridge-agent2 --topicId "아이브-20260215-abc123"
```

**기능:**
1. `topic-intel.json` 로드
2. `topic-request.json` 로드
3. Agent 2 형식으로 변환:
   - `title`: normalizedTopic
   - `category`: request.category (music/lifestyle, 필수)
   - `facts`: keyFacts.text (최대 8개, 중복 제거)
   - `angles`: angleCandidates (최대 6개, 중복 제거)
   - `sources`: sources (최대 5개, URL 중복 제거)
4. `topic.agent2.json` 저장

**출력 파일:**
- `outputs/{topicId}/topic.agent2.json`

**출력:**
- 콘솔: 저장 경로, Agent 2 토픽 요약

**요구사항:**
- Phase 1-D 완료 필요
- `topic-request.json`에 `category` 필수 (music 또는 lifestyle)

---

## Phase 2: 트렌드 시드 및 배치 처리

Phase 2는 Google Trends에서 인기 키워드를 수집하고, 배치로 토픽 인텔리전스를 생성하는 기능입니다.

### Phase 2-A: Google Trends 시드 수집

**명령어:**
```bash
npx tsx agents/topic-intelligence/cli.ts seeds --timeframe "now 7-d" --topN 30 --category "music" --save true
```

**옵션:**
- `--timeframe`: 시간 범위
  - `now 1-d`: 지난 1일
  - `now 7-d`: 지난 7일 (기본값)
  - `today 1-m`: 지난 1개월
  - `today 3-m`: 지난 3개월
- `--topN`: 상위 N개 (기본 30)
- `--category`: 카테고리 필터 (`music`, `lifestyle`, `all` 기본값)
- `--save true`: 결과를 스냅샷으로 저장

**기능:**
1. Google Trends KR API 호출:
   - 일일 트렌드
   - 실시간 트렌드
   - 관련 쿼리
2. 키워드 정규화 및 중복 제거
3. 카테고리 자동 분류:
   - `music`: 음악 관련 키워드
   - `lifestyle`: 라이프스타일 관련 키워드
4. 시드 점수 계산:
   - 트래픽 점수
   - 소스 신뢰도
   - 카테고리 일치 보너스
5. 점수 내림차순 정렬
6. 카테고리 필터링 및 TopN 선택
7. (선택) `seeds.{geo}.json` 저장

**출력 파일:**
- `outputs/seeds/{YYYYMMDD}/seeds.{geo}.json` (save=true일 때)

**출력:**
- 콘솔: 생성 시간, 총 후보 수, 상위 후보 목록 (점수, 카테고리, 키워드, 트래픽, 이유)

**다음 단계:** Phase 2-B Pick

---

### Phase 2-B Pick: 시드 선택

**명령어:**
```bash
npx tsx agents/topic-intelligence/cli.ts pick-seeds --date 20260215 --autoPick 5 --category "music" --minScore 40
```

**옵션:**
- `--date`: 날짜 (YYYYMMDD 형식, 필수)
- `--category`: 카테고리 필터 (`music`, `lifestyle`, `all` 기본값)
- `--minScore`: 최소 점수 (기본 40)
- 선택 모드 (하나만 선택):
  - `--pick "1,3,5"`: 인덱스 직접 선택
  - `--autoPick 5`: 상위 N개 자동 선택
  - `--filter "정규식"`: 정규식 필터 (예: `--filter "아이브|뉴진스"`)

**기능:**
1. 시드 스냅샷 로드 (`seeds.{geo}.json`)
2. 선택 모드에 따라 시드 선택:
   - `pick`: 지정된 인덱스 선택
   - `autoPick`: 상위 N개 선택
   - `filter`: 정규식 매칭
3. 최소 점수 필터링
4. 카테고리 필터링
5. `picked.{geo}.json` 저장

**출력 파일:**
- `outputs/seeds/{YYYYMMDD}/picked.{geo}.json`

**출력:**
- 콘솔: 선택된 시드 수, 저장 경로, 선택된 시드 목록

**다음 단계:** Phase 2-C Preflight 또는 Phase 2-B Run

---

### Phase 2-C Preflight: 커버리지 게이트

**명령어:**
```bash
npx tsx agents/topic-intelligence/cli.ts preflight --date 20260215 --geo KR
```

**옵션:**
- `--date`: 날짜 (YYYYMMDD 형식, 필수)
- `--geo`: 지역 (기본 "KR")
- `--recencyDays`: 최신성 기준일 (기본값: topic-request의 recencyDays)
- `--maxArticles`: 최대 기사 수 (기본값: topic-request의 maxArticles)
- `--minTopScore`: 최소 상위 점수 (기본 0)
- `--minMatchedTopK`: 최소 매칭 TopK (기본 0)
- `--minUniquePublishers`: 최소 고유 출판사 수 (기본 0)
- `--concurrency`: 동시성 (기본 2)

**기능:**
1. 선택된 시드 로드 (`picked.{geo}.json`)
2. 각 시드에 대해 RSS 커버리지 검사:
   - Phase 1-A/B와 유사한 RSS 수집
   - 관련성 점수 계산
   - 커버리지 점수 계산:
     - `matchedTopK`: 상위 K개 중 매칭된 기사 수
     - `uniquePublishers`: 고유 출판사 수
     - `last24h`: 최근 24시간 기사 수
     - `topScore`: 최고 점수
   - Pass/Fail 결정 (옵션 기준)
3. 커버리지 점수 내림차순 정렬
4. `coverage-gate.{geo}.json` 저장

**출력 파일:**
- `outputs/seeds/{YYYYMMDD}/coverage-gate.{geo}.json`

**출력:**
- 콘솔: 총 시드 수, Pass/Fail 수, Pass 항목 (상위 10개), Fail 항목 (상위 10개)

**용도:**
- RSS 커버리지가 부족한 시드를 사전에 필터링
- Phase 2-B Run에서 게이트 필터로 사용 가능

**다음 단계:** Phase 2-C Build Run List 또는 Phase 2-B Run

---

### Phase 2-C Build Run List: 최종 점수 계산 및 실행 목록 생성

**명령어:**
```bash
npx tsx agents/topic-intelligence/cli.ts runlist --date 20260215 --minFinalScore 60 --requireGatePass true --save true
```

**옵션:**
- `--date`: 날짜 (YYYYMMDD 형식, 필수)
- `--minFinalScore`: 최소 최종 점수 (기본 60)
- `--requireGatePass`: 게이트 Pass 필수 여부 (기본 true)
- `--save`: 저장 여부 (기본 true)

**기능:**
1. 입력 파일 로드:
   - 시드 스냅샷 (`seeds.{geo}.json`) → Trend 점수
   - 선택된 시드 (`picked.{geo}.json`)
   - (선택) 커버리지 게이트 리포트 (`coverage-gate.{geo}.json`) → Coverage 점수
2. 최종 점수 계산:
   - Trend 점수 (0.45 가중치)
   - Coverage 점수 (0.55 가중치)
   - 게이트 패널티/보너스 적용
3. 실행 목록 빌드:
   - 최종 점수 기준 정렬
   - 정책에 따라 Run/Skip 결정:
     - `minFinalScore` 미만 → Skip
     - `requireGatePass=true`이고 게이트 Fail → Skip
4. `runlist.{geo}.json` 저장

**출력 파일:**
- `outputs/seeds/{YYYYMMDD}/runlist.{geo}.json`

**출력:**
- 콘솔: 총 시드 수, Run/Skip 수, Run 항목 목록, Skip 항목 목록 (상위 10개)

**다음 단계:** Phase 2-B Run

---

### Phase 2-B Run: 배치 실행

**명령어:**
```bash
npx tsx agents/topic-intelligence/cli.ts run-picked --date 20260215 --concurrency 2 --dryRun false
```

**옵션:**
- `--date`: 날짜 (YYYYMMDD 형식, 필수)
- `--concurrency`: 동시성 (기본 2)
- `--dryRun true`: 실제 실행 없이 계획만 생성
- `--useRunList true`: `runlist.{geo}.json` 사용 (기본: `picked.{geo}.json`)
- 게이트 옵션:
  - `--useGate true`: 게이트 필터 활성화
  - `--requireGate true`: 게이트 리포트 필수
  - `--minCoverageScore`: 최소 커버리지 점수 (기본 0)
- 오버라이드 옵션:
  - `--depth`: 깊이 (`news`, `explainer`, `analysis`)
  - `--region`: 지역 (`KR`, `GLOBAL`)
  - `--maxArticles`: 최대 기사 수
  - `--recencyDays`: 최신성 기준일

**기능:**
1. 선택된 시드 또는 실행 목록 로드:
   - `useRunList=true`: `runlist.{geo}.json` 사용
   - `useRunList=false`: `picked.{geo}.json` 사용
2. (선택) 커버리지 게이트 리포트 로드
3. 배치 계획 빌드:
   - 각 시드에 대해 `TopicRequest` 생성
   - 게이트 필터 적용 (옵션)
   - 실행 여부 결정
4. 배치 실행:
   - 동시성 제한 (기본 2)
   - 각 시드에 대해 Phase 1 전체 실행:
     - Phase 1-A: RSS 수집
     - Phase 1-B: 관련성 점수
     - Phase 1-C: 콘텐츠 필드 생성
     - Phase 1-D: 토픽 인텔 패키지 저장
   - 성공/실패 추적
5. 배치 리포트 저장

**출력 파일:**
- 각 시드별: `outputs/{topicId}/topic-intel.json`
- 배치 리포트: `outputs/seeds/{YYYYMMDD}/batch-run.{geo}.json`

**출력:**
- 콘솔:
  - 실행 소스 (picked/runlist)
  - 게이트 통계 (활성화 시)
  - 총 시드 수, 실행 예정 수, 성공/실패/스킵 수
  - 각 시드별 결과 (성공/실패, 소스 수, 사실 수, 각도 수, 소요 시간)
  - 리포트 저장 경로

**용도:**
- 여러 시드를 한 번에 처리하여 토픽 인텔리전스 생성
- 자동화된 일일/주간 배치 작업

---

## 전체 워크플로우 예시

### 시나리오 1: 단일 토픽 처리

```bash
# 1. 토픽 요청 생성
npx tsx agents/topic-intelligence/cli.ts request \
  --prompt "이번주 아이브 컴백 소식 정리해줘" \
  --category music

# 2. Phase 1 전체 실행 (D까지)
npx tsx agents/topic-intelligence/cli.ts intel \
  --topicId "아이브-20260215-abc123" \
  --phase D

# 3. Agent 2로 변환
npx tsx agents/topic-intelligence/cli.ts bridge-agent2 \
  --topicId "아이브-20260215-abc123"

# 4. (선택) 기사 본문 캐싱
npx tsx agents/topic-intelligence/cli.ts intel \
  --topicId "아이브-20260215-abc123" \
  --phase E
```

### 시나리오 2: 트렌드 기반 배치 처리

```bash
# 1. 트렌드 시드 수집
npx tsx agents/topic-intelligence/cli.ts seeds \
  --timeframe "now 7-d" \
  --topN 30 \
  --category "music" \
  --save true

# 2. 시드 선택
npx tsx agents/topic-intelligence/cli.ts pick-seeds \
  --date 20260215 \
  --autoPick 10 \
  --category "music"

# 3. (선택) 커버리지 게이트
npx tsx agents/topic-intelligence/cli.ts preflight \
  --date 20260215

# 4. (선택) 실행 목록 생성
npx tsx agents/topic-intelligence/cli.ts runlist \
  --date 20260215 \
  --minFinalScore 60 \
  --requireGatePass true

# 5. 배치 실행
npx tsx agents/topic-intelligence/cli.ts run-picked \
  --date 20260215 \
  --useRunList true \
  --concurrency 2
```

---

## 주요 출력 파일 요약

| 파일 | 생성 단계 | 용도 |
|------|----------|------|
| `topic-request.json` | Phase 0 | 토픽 요청 정보 |
| `topic-intel.json` | Phase 1-D | 최종 토픽 인텔리전스 패키지 |
| `topic.agent2.json` | Bridge | Agent 2용 변환된 데이터 |
| `sources-raw.json` | Phase 1-D (선택) | 원본 소스 목록 |
| `articles/article.{idx}.json` | Phase 1-E | 기사 본문 캐시 |
| `articles/index.json` | Phase 1-E | 캐시 인덱스 |
| `seeds.{geo}.json` | Phase 2-A | 트렌드 시드 스냅샷 |
| `picked.{geo}.json` | Phase 2-B Pick | 선택된 시드 |
| `coverage-gate.{geo}.json` | Phase 2-C Preflight | 커버리지 게이트 리포트 |
| `runlist.{geo}.json` | Phase 2-C Build Run List | 실행 목록 |
| `batch-run.{geo}.json` | Phase 2-B Run | 배치 실행 리포트 |

---

## 기능 요약

### Phase 1 (단일 토픽 처리)
- ✅ RSS 피드 수집 및 필터링
- ✅ 관련성 점수 계산 및 상위 K개 선택
- ✅ 핵심 사실, 각도, 이미지 쿼리 생성
- ✅ 커버리지 분석 및 모멘텀 계산
- ✅ 위험 노트 생성
- ✅ 토픽 인텔리전스 패키지 생성
- ✅ 기사 본문 캐싱

### Phase 2 (배치 처리)
- ✅ Google Trends 시드 수집
- ✅ 시드 선택 (수동/자동/필터)
- ✅ RSS 커버리지 게이트
- ✅ 최종 점수 계산 및 실행 목록 생성
- ✅ 배치 실행 (여러 시드 동시 처리)

### Bridge
- ✅ Agent 2 형식으로 데이터 변환

---

## 주의사항

1. **Phase 1은 순차 실행**: A → B → C → D → E 순서로 실행해야 함 (각 Phase가 이전 Phase를 자동 실행)
2. **카테고리 필수**: Bridge와 일부 Phase 2 기능은 `category` 필수
3. **날짜 형식**: Phase 2 명령어는 `YYYYMMDD` 형식 필요
4. **동시성 제한**: Phase 1-E와 Phase 2-B Run은 동시성 제한 있음
5. **게이트 리포트**: Phase 2-C Preflight를 실행하면 Phase 2-B Run에서 게이트 필터 사용 가능
