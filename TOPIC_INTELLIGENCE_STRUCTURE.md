# Topic Intelligence 에이전트 구조 및 실행 순서

## 전체 구조 개요

```
topic-intelligence/
├── cli.ts                    # CLI 진입점 및 명령어 라우팅
├── contracts.ts              # 타입 정의 (TopicRequest, TopicIntelPack 등)
├── schema.ts                 # Zod 스키마 및 파싱 함수
├── interpret/                # 프롬프트 해석
├── io/                       # 파일 입출력 (load, save, paths)
├── utils/                    # 유틸리티 함수
├── bridge/                   # Agent 2로 데이터 변환
├── phase1/                   # Phase 1: RSS 수집 및 인텔리전스 생성
└── phase2/                   # Phase 2: 트렌드 시드 및 배치 처리
```

---

## Phase 1: RSS 수집 및 인텔리전스 생성

### 실행 순서

```
Phase 1-A (RSS 수집)
    ↓
Phase 1-B (관련성 점수 계산)
    ↓
Phase 1-C (콘텐츠 필드 생성)
    ↓
Phase 1-D (토픽 인텔 패키지 조립)
    ↓
Phase 1-E (기사 본문 캐싱)
```

### Phase 1-A: RSS 수집 및 필터링

**주요 파일:**
- `phase1/run.ts` → `runPhase1A()`
- `phase1/feeds/feeds.kr.ts` → RSS 피드 정의
- `phase1/feeds/fetch.ts` → RSS XML 가져오기
- `phase1/feeds/normalize.ts` → RSS 파싱 및 정규화

**기능:**
1. `feeds.kr.ts`에서 카테고리별 RSS 피드 목록 로드
2. `fetch.ts`로 모든 피드 병렬 수집
3. `normalize.ts`로 RSS XML 파싱 및 `NormalizedArticle` 변환
4. 최신성 필터링 (recencyDays 기준)
5. URL 중복 제거

**입력:**
- `topic-request.json` (토픽 ID로 로드)

**출력:**
- `Phase1AResult`: 수집된 기사 목록, 에러 목록

**의존성:**
- `io/paths.ts` → `getTopicRequestPath()`
- `io/load.ts` → `loadJson()`
- `schema.ts` → `parseTopicRequest()`

---

### Phase 1-B: 관련성 점수 계산 및 상위 K개 선택

**주요 파일:**
- `phase1/run.ts` → `runPhase1B()`
- `phase1/relevance/score.ts` → 기사 관련성 점수 계산
- `phase1/relevance/filter.ts` → 상위 K개 선택

**기능:**
1. Phase 1-A 실행
2. `score.ts`로 각 기사에 관련성 점수 부여
   - 키워드 매칭
   - 카테고리 일치
   - 제목/내용 분석
3. `filter.ts`로 상위 K개 선택 (maxArticles 기준)

**입력:**
- Phase 1-A 결과

**출력:**
- `Phase1BResult`: 선택된 기사 목록 (`selected: ScoredArticle[]`)

**의존성:**
- Phase 1-A 완료 필요

---

### Phase 1-C: 콘텐츠 필드 생성

**주요 파일:**
- `phase1/run.ts` → `runPhase1C()`
- `phase1/facts/extract.ts` → 핵심 사실 추출
- `phase1/facts/extractFromBody.ts` → 본문에서 사실 추출
- `phase1/facts/scoreFacts.ts` → 사실 점수 계산
- `phase1/facts/evidence.ts` → 증거 URL 수집
- `phase1/facts/dedupe.ts` → 사실 중복 제거
- `phase1/angles/generate.ts` → 각도 후보 생성
- `phase1/images/queries.ts` → 이미지 쿼리 생성
- `phase1/risk/notes.ts` → 위험 노트 생성
- `phase1/coverage/cluster.ts` → 소스 클러스터링
- `phase1/coverage/momentum.ts` → 모멘텀 신호 계산
- `phase1/coverage/tokenize.ts` → 토큰화 유틸리티

**기능:**
1. Phase 1-B 실행
2. **커버리지 분석:**
   - `cluster.ts`: 제목 기반 소스 클러스터링
   - `momentum.ts`: 최근 24시간/72시간 기사 수, 출판사 수, 모멘텀 점수 계산
3. **핵심 사실 추출:**
   - `extract.ts`: 본문 기반 사실 추출 (제목 폴백)
   - `extractFromBody.ts`: 기사 본문에서 문장 후보 추출
   - `scoreFacts.ts`: 사실 점수 계산
   - `evidence.ts`: 증거 URL 수집
   - `dedupe.ts`: 중복 사실 제거
4. **각도 생성:**
   - `generate.ts`: 카테고리 및 깊이에 따른 각도 후보 생성
5. **이미지 쿼리 생성:**
   - `queries.ts`: 키워드 기반 이미지 검색 쿼리 생성
6. **위험 노트 생성:**
   - `notes.ts`: 누락된 publishedAt, 부족한 소스 등 위험 요소 기록

**입력:**
- Phase 1-B 결과

**출력:**
- `Phase1CResult`: keyFacts, angleCandidates, imageQueries, riskNotes, clusters, momentum

**의존성:**
- Phase 1-B 완료 필요
- `io/paths.ts` → `getArticlesIndexPath()` (본문 캐시 확인용)

---

### Phase 1-D: 토픽 인텔 패키지 조립 및 저장

**주요 파일:**
- `phase1/run.ts` → `runPhase1D()`
- `schema.ts` → `parseTopicIntelPack()` (Zod 검증)

**기능:**
1. Phase 1-C 실행
2. `TopicIntelPack` 객체 조립:
   - `topicId`, `normalizedTopic`, `category`
   - `sources`: ScoredArticle → TopicSource 변환
   - `keyFacts`: 필터링 (최소 20자, 증거 URL ≥ 1)
   - `angleCandidates`, `imageQueries`, `riskNotes`
3. Zod 스키마로 검증
4. `topic-intel.json` 저장
5. (선택) `sources-raw.json` 저장

**입력:**
- Phase 1-C 결과

**출력:**
- `topic-intel.json` (최종 토픽 인텔리전스 패키지)
- (선택) `sources-raw.json`

**의존성:**
- Phase 1-C 완료 필요
- `io/paths.ts` → `getTopicIntelPath()`, `getSourcesRawPath()`
- `io/save.ts` → `saveJson()`
- `schema.ts` → `parseTopicIntelPack()`

---

### Phase 1-E: 기사 본문 캐싱

**주요 파일:**
- `phase1/run.ts` → `runPhase1E()`
- `phase1/article/cache.ts` → 기사 캐시 빌드 및 저장
- `phase1/article/fetchHtml.ts` → HTML 가져오기
- `phase1/article/extractText.ts` → 텍스트 추출
- `phase1/article/sanitize.ts` → HTML 정리

**기능:**
1. Phase 1-D 실행
2. 각 소스 URL에 대해:
   - `fetchHtml.ts`: HTML 가져오기
   - `extractText.ts`: 본문 텍스트 추출 (다양한 추출 방법 시도)
   - `sanitize.ts`: HTML 정리
   - `cache.ts`: `article.{idx}.json` 저장
3. 동시성 제한 (concurrency=3)
4. `articles/index.json` 생성

**입력:**
- Phase 1-D 결과 (topic-intel.json의 sources)

**출력:**
- `articles/article.{idx}.json` (각 기사 본문 캐시)
- `articles/index.json` (캐시 인덱스)

**의존성:**
- Phase 1-D 완료 필요
- `io/paths.ts` → `getArticlesDir()`, `getArticleCachePath()`, `getArticlesIndexPath()`

---

## Phase 2: 트렌드 시드 및 배치 처리

### 실행 순서

```
Phase 2-A (트렌드 시드 수집)
    ↓
Phase 2-B Pick (시드 선택)
    ↓
Phase 2-C Preflight (커버리지 게이트) [선택]
    ↓
Phase 2-C Build Run List (최종 점수 계산) [선택]
    ↓
Phase 2-B Run (배치 실행)
```

### Phase 2-A: Google Trends 시드 수집

**주요 파일:**
- `phase2/run.ts` → `runPhase2A()`, `runPhase2AAndMaybeSave()`
- `phase2/trends/client.ts` → Google Trends API 클라이언트
- `phase2/trends/normalize.ts` → 키워드 정규화
- `phase2/trends/score.ts` → 시드 점수 계산 및 카테고리 분류

**기능:**
1. `client.ts`로 Google Trends KR 데이터 수집
   - 일일 트렌드
   - 실시간 트렌드
   - 관련 쿼리
2. `normalize.ts`로 키워드 정규화 및 중복 제거
3. `score.ts`로 카테고리 분류 및 점수 계산
4. 점수 내림차순 정렬
5. 카테고리 필터링 및 TopN 선택
6. (선택) `seeds.{geo}.json` 저장

**입력:**
- 없음 (Google Trends API 직접 호출)

**출력:**
- `Phase2AResult`: 시드 후보 목록
- (선택) `outputs/seeds/{YYYYMMDD}/seeds.{geo}.json`

**의존성:**
- `io/paths.ts` → `getSeedsSnapshotPath()`
- `io/save.ts` → `saveJson()`
- `utils/time.ts` → `nowIso()`, `yyyymmdd()`

---

### Phase 2-B Pick: 시드 선택

**주요 파일:**
- `phase2/run.ts` → `runPhase2BPick()`
- `phase2/pick/loadSnapshot.ts` → 시드 스냅샷 로드
- `phase2/pick/select.ts` → 시드 선택 로직
- `phase2/pick/savePicked.ts` → 선택된 시드 저장

**기능:**
1. `loadSnapshot.ts`로 시드 스냅샷 로드
2. `select.ts`로 시드 선택:
   - `pick`: 인덱스 직접 선택
   - `autoPick`: 상위 N개 자동 선택
   - `filter`: 정규식 필터
3. `savePicked.ts`로 `picked.{geo}.json` 저장

**입력:**
- `outputs/seeds/{YYYYMMDD}/seeds.{geo}.json` (Phase 2-A 결과)

**출력:**
- `outputs/seeds/{YYYYMMDD}/picked.{geo}.json`

**의존성:**
- Phase 2-A 완료 필요
- `io/paths.ts` → `getSeedsSnapshotPath()`, `getPickedSeedsPath()`

---

### Phase 2-C Preflight: 커버리지 게이트

**주요 파일:**
- `phase2/run.ts` → `runPhase2CPreflight()`
- `phase2/gate/preflight.ts` → 개별 시드 커버리지 검사
- `phase2/gate/report.ts` → 게이트 리포트 저장
- `phase2/gate/loadGateReport.ts` → 게이트 리포트 로드

**기능:**
1. 선택된 시드 로드
2. 각 시드에 대해 `preflight.ts` 실행:
   - Phase 1-A/B와 유사한 RSS 수집
   - 커버리지 점수 계산 (matchedTopK, uniquePublishers, last24h 등)
   - Pass/Fail 결정
3. 커버리지 점수 내림차순 정렬
4. `coverage-gate.{geo}.json` 저장

**입력:**
- `picked.{geo}.json` (Phase 2-B 결과)

**출력:**
- `outputs/seeds/{YYYYMMDD}/coverage-gate.{geo}.json`

**의존성:**
- Phase 2-B 완료 필요
- Phase 1의 feeds 모듈 재사용

---

### Phase 2-C Build Run List: 최종 점수 계산

**주요 파일:**
- `phase2/run.ts` → `runPhase2CBuildRunList()`
- `phase2/merge/loadInputs.ts` → 입력 파일 로드
- `phase2/merge/finalScore.ts` → 최종 점수 계산
- `phase2/merge/buildRunList.ts` → 실행 목록 빌드

**기능:**
1. `loadInputs.ts`로 입력 파일 로드:
   - 시드 스냅샷 (trend 점수)
   - 선택된 시드 (picked)
   - (선택) 커버리지 게이트 리포트 (coverage 점수)
2. `finalScore.ts`로 최종 점수 계산:
   - Trend 점수 (0.45 가중치)
   - Coverage 점수 (0.55 가중치)
   - 게이트 패널티/보너스 적용
3. `buildRunList.ts`로 실행 목록 빌드:
   - 최종 점수 기준 정렬
   - 정책에 따라 Run/Skip 결정
4. `runlist.{geo}.json` 저장

**입력:**
- `seeds.{geo}.json`
- `picked.{geo}.json`
- (선택) `coverage-gate.{geo}.json`

**출력:**
- `outputs/seeds/{YYYYMMDD}/runlist.{geo}.json`

**의존성:**
- Phase 2-B 완료 필요
- (선택) Phase 2-C Preflight 완료

---

### Phase 2-B Run: 배치 실행

**주요 파일:**
- `phase2/run.ts` → `runPhase2BRun()`
- `phase2/batch/plan.ts` → 배치 계획 빌드
- `phase2/batch/run.ts` → 배치 실행
- `phase2/batch/report.ts` → 배치 리포트 타입

**기능:**
1. 선택된 시드 또는 실행 목록 로드
2. (선택) 커버리지 게이트 리포트 로드
3. `plan.ts`로 배치 계획 빌드:
   - 각 시드에 대해 TopicRequest 생성
   - 게이트 필터 적용 (선택)
4. `run.ts`로 배치 실행:
   - 동시성 제한 (기본 2)
   - 각 시드에 대해 Phase 1 전체 실행
   - 성공/실패 추적
5. `batch-run.{geo}.json` 저장

**입력:**
- `picked.{geo}.json` 또는 `runlist.{geo}.json`
- (선택) `coverage-gate.{geo}.json`

**출력:**
- 각 시드별 `topic-intel.json` 생성
- `outputs/seeds/{YYYYMMDD}/batch-run.{geo}.json` (실행 리포트)

**의존성:**
- Phase 2-B 완료 필요
- Phase 1 모듈 전체 사용

---

## Bridge: Agent 2로 데이터 변환

**주요 파일:**
- `bridge/to-agent2-topic.ts` → `toAgent2Topic()`

**기능:**
1. `topic-intel.json` 로드
2. `topic-request.json` 로드
3. Agent 2 형식으로 변환:
   - `title`: normalizedTopic
   - `category`: request.category (music/lifestyle)
   - `facts`: keyFacts.text (최대 8개, 중복 제거)
   - `angles`: angleCandidates (최대 6개, 중복 제거)
   - `sources`: sources (최대 5개, URL 중복 제거)
4. `topic.agent2.json` 저장

**입력:**
- `topic-intel.json`
- `topic-request.json`

**출력:**
- `topic.agent2.json`

**의존성:**
- Phase 1-D 완료 필요
- `io/paths.ts` → `getTopicIntelPath()`, `getTopicRequestPath()`, `getAgent2TopicPath()`

---

## 공통 모듈

### CLI (`cli.ts`)

**기능:**
- 명령어 파싱 및 라우팅
- 각 Phase 실행 함수 호출
- 콘솔 출력

**명령어:**
- `request`: 토픽 요청 생성
- `intel`: Phase 1 실행 (A, B, C, D, E)
- `bridge-agent2`: Agent 2로 변환
- `seeds`: Phase 2-A 실행
- `pick-seeds`: Phase 2-B Pick 실행
- `run-picked`: Phase 2-B Run 실행
- `preflight`: Phase 2-C Preflight 실행
- `runlist`: Phase 2-C Build Run List 실행

---

### Interpret (`interpret/`)

**주요 파일:**
- `interpret.ts` → `buildTopicRequestFromPrompt()`
- `defaults.ts` → 기본값 정의

**기능:**
1. 프롬프트에서 시드 키워드 추출
2. 카테고리/깊이 추론 (키워드 큐 기반)
3. 기본값과 오버라이드 병합
4. TopicRequest 생성 및 검증

---

### IO (`io/`)

**주요 파일:**
- `paths.ts`: 모든 파일 경로 생성 함수
- `load.ts`: JSON 로드
- `save.ts`: JSON 저장

**경로 구조:**
```
outputs/
├── {topicId}/
│   ├── topic-request.json
│   ├── topic-intel.json
│   ├── topic.agent2.json
│   ├── sources-raw.json (선택)
│   └── articles/
│       ├── index.json
│       └── article.{idx}.json
└── seeds/
    └── {YYYYMMDD}/
        ├── seeds.{geo}.json
        ├── picked.{geo}.json
        ├── coverage-gate.{geo}.json
        ├── runlist.{geo}.json
        └── batch-run.{geo}.json
```

---

### Utils (`utils/`)

**주요 파일:**
- `normalize.ts` → `normalizeTopic()`: 토픽 정규화
- `topicId.ts` → `makeTopicId()`: 토픽 ID 생성
- `time.ts` → `nowIso()`, `yyyymmdd()`: 시간 유틸리티

---

### Contracts & Schema

**주요 파일:**
- `contracts.ts`: 타입 정의
- `schema.ts`: Zod 스키마 및 파싱 함수

**주요 타입:**
- `TopicRequest`: 토픽 요청
- `TopicIntelPack`: 토픽 인텔리전스 패키지
- `TopicSource`: 소스 정보
- `TopicKeyFact`: 핵심 사실

---

## 전체 실행 흐름도

```
[CLI: request]
    ↓
[interpret/interpret.ts] → TopicRequest 생성
    ↓
[topic-request.json 저장]

[CLI: intel --phase A]
    ↓
[phase1/run.ts: runPhase1A]
    ├─ [feeds/feeds.kr.ts] → RSS 피드 목록
    ├─ [feeds/fetch.ts] → RSS 수집
    └─ [feeds/normalize.ts] → 파싱 및 정규화

[CLI: intel --phase B]
    ↓
[phase1/run.ts: runPhase1B]
    ├─ [relevance/score.ts] → 관련성 점수
    └─ [relevance/filter.ts] → 상위 K개 선택

[CLI: intel --phase C]
    ↓
[phase1/run.ts: runPhase1C]
    ├─ [coverage/cluster.ts] → 소스 클러스터링
    ├─ [coverage/momentum.ts] → 모멘텀 계산
    ├─ [facts/extract.ts] → 사실 추출
    ├─ [angles/generate.ts] → 각도 생성
    ├─ [images/queries.ts] → 이미지 쿼리
    └─ [risk/notes.ts] → 위험 노트

[CLI: intel --phase D]
    ↓
[phase1/run.ts: runPhase1D]
    └─ [schema.ts] → 검증 및 저장
    ↓
[topic-intel.json 저장]

[CLI: intel --phase E]
    ↓
[phase1/run.ts: runPhase1E]
    ├─ [article/fetchHtml.ts] → HTML 가져오기
    ├─ [article/extractText.ts] → 텍스트 추출
    └─ [article/cache.ts] → 캐시 저장

[CLI: bridge-agent2]
    ↓
[bridge/to-agent2-topic.ts]
    ↓
[topic.agent2.json 저장]

[CLI: seeds]
    ↓
[phase2/run.ts: runPhase2A]
    ├─ [trends/client.ts] → Google Trends 수집
    ├─ [trends/normalize.ts] → 정규화
    └─ [trends/score.ts] → 점수 계산
    ↓
[seeds.{geo}.json 저장]

[CLI: pick-seeds]
    ↓
[phase2/run.ts: runPhase2BPick]
    ├─ [pick/loadSnapshot.ts] → 스냅샷 로드
    └─ [pick/select.ts] → 시드 선택
    ↓
[picked.{geo}.json 저장]

[CLI: preflight]
    ↓
[phase2/run.ts: runPhase2CPreflight]
    └─ [gate/preflight.ts] → 커버리지 검사
    ↓
[coverage-gate.{geo}.json 저장]

[CLI: runlist]
    ↓
[phase2/run.ts: runPhase2CBuildRunList]
    ├─ [merge/loadInputs.ts] → 입력 로드
    ├─ [merge/finalScore.ts] → 최종 점수
    └─ [merge/buildRunList.ts] → 실행 목록
    ↓
[runlist.{geo}.json 저장]

[CLI: run-picked]
    ↓
[phase2/run.ts: runPhase2BRun]
    ├─ [batch/plan.ts] → 배치 계획
    └─ [batch/run.ts] → 배치 실행
        └─ [각 시드에 대해 Phase 1 전체 실행]
    ↓
[batch-run.{geo}.json 저장]
```

---

## 파일별 기능 요약

| 파일/모듈 | 기능 | 의존성 |
|----------|------|--------|
| `cli.ts` | CLI 진입점, 명령어 라우팅 | 모든 모듈 |
| `contracts.ts` | 타입 정의 | 없음 |
| `schema.ts` | Zod 스키마, 파싱 함수 | `contracts.ts` |
| `interpret/interpret.ts` | 프롬프트 → TopicRequest | `contracts.ts`, `schema.ts` |
| `io/paths.ts` | 파일 경로 생성 | 없음 |
| `io/load.ts` | JSON 로드 | 없음 |
| `io/save.ts` | JSON 저장 | 없음 |
| `utils/normalize.ts` | 토픽 정규화 | 없음 |
| `utils/topicId.ts` | 토픽 ID 생성 | `utils/normalize.ts` |
| `utils/time.ts` | 시간 유틸리티 | 없음 |
| `bridge/to-agent2-topic.ts` | Agent 2 변환 | `contracts.ts` |
| `phase1/run.ts` | Phase 1 실행 함수 | 모든 phase1 모듈 |
| `phase1/feeds/*` | RSS 수집 및 파싱 | 없음 |
| `phase1/relevance/*` | 관련성 점수 및 필터링 | `phase1/feeds/*` |
| `phase1/facts/*` | 핵심 사실 추출 | `phase1/relevance/*`, `phase1/article/*` |
| `phase1/angles/*` | 각도 생성 | 없음 |
| `phase1/images/*` | 이미지 쿼리 생성 | 없음 |
| `phase1/risk/*` | 위험 노트 생성 | 없음 |
| `phase1/coverage/*` | 커버리지 분석 | `phase1/relevance/*` |
| `phase1/article/*` | 기사 본문 캐싱 | 없음 |
| `phase2/run.ts` | Phase 2 실행 함수 | 모든 phase2 모듈 |
| `phase2/trends/*` | Google Trends 수집 | 없음 |
| `phase2/pick/*` | 시드 선택 | `phase2/trends/*` |
| `phase2/gate/*` | 커버리지 게이트 | `phase1/feeds/*` |
| `phase2/merge/*` | 최종 점수 및 실행 목록 | `phase2/pick/*`, `phase2/gate/*` |
| `phase2/batch/*` | 배치 실행 | `phase1/*` |

---

## 주요 데이터 흐름

1. **TopicRequest 생성** → `topic-request.json`
2. **Phase 1-A** → RSS 수집 (NormalizedArticle[])
3. **Phase 1-B** → 관련성 점수 (ScoredArticle[])
4. **Phase 1-C** → 콘텐츠 필드 (keyFacts, angles, imageQueries 등)
5. **Phase 1-D** → `TopicIntelPack` 조립 → `topic-intel.json`
6. **Phase 1-E** → 기사 본문 캐시 (`article.{idx}.json`)
7. **Bridge** → `topic.agent2.json` (Agent 2용)
8. **Phase 2-A** → 트렌드 시드 수집 → `seeds.{geo}.json`
9. **Phase 2-B Pick** → 시드 선택 → `picked.{geo}.json`
10. **Phase 2-C Preflight** → 커버리지 게이트 → `coverage-gate.{geo}.json`
11. **Phase 2-C Build Run List** → 최종 점수 → `runlist.{geo}.json`
12. **Phase 2-B Run** → 배치 실행 → 각 시드별 `topic-intel.json` 생성
