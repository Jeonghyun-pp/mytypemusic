# 에이전트 개요 및 연결관계 (Agents Overview & Connections)

## 전체 워크플로우

```
[Agent 0: topic-intelligence]
    ↓ (topic.json 생성)
[Agent 1: safe-image-acquisition]
    ↓ (validated-post.json 생성)
[Agent 2: cardnews-composition]
    ↓ (최종 카드뉴스 이미지 생성)
```

---

## Agent 0: topic-intelligence (토픽 인텔리전스)

### 주요 기능
- **토픽 요청 생성**: 프롬프트나 키워드로부터 토픽 요청 생성
- **RSS 피드 수집**: 관련 뉴스 기사 수집 및 필터링 (Phase 1-A)
- **관련성 점수 계산**: 기사 관련성 평가 및 상위 K개 선택 (Phase 1-B)
- **콘텐츠 필드 생성**: 핵심 사실, 각도, 이미지 쿼리, 위험 노트 생성 (Phase 1-C)
- **토픽 인텔 패키지 조립**: 최종 토픽 인텔리전스 데이터 생성 (Phase 1-D)
- **기사 본문 캐싱**: 기사 본문 추출 및 캐싱 (Phase 1-E)
- **트렌드 시드 생성**: Google Trends에서 인기 키워드 수집 (Phase 2-A)
- **시드 선택**: 수집된 시드 중 선택 (Phase 2-B)
- **커버리지 게이트**: RSS 커버리지 사전 검사 (Phase 2-C)

### 입력
- `--prompt` 또는 `--keyword`: 토픽 요청 생성
- `--topicId`: 기존 토픽 ID로 작업 진행

### 출력
- `topic-request.json`: 토픽 요청 정보
- `topic-intel.json`: 토픽 인텔리전스 패키지 (sources, keyFacts, angleCandidates, imageQueries 등)
- `agent2-topic.json`: Agent 2용 변환된 토픽 데이터 (bridge-agent2 명령)

### 주요 명령어
```bash
# 토픽 요청 생성
cli.js request --prompt "이번주 아이브 컴백 소식 정리해줘"

# Phase 1: 인텔리전스 수집
cli.js intel --topicId <id> --phase A  # RSS 수집
cli.js intel --topicId <id> --phase B  # 관련성 점수
cli.js intel --topicId <id> --phase C  # 콘텐츠 필드
cli.js intel --topicId <id> --phase D  # 패키지 조립
cli.js intel --topicId <id> --phase E  # 본문 캐싱

# Agent 2로 브리지
cli.js bridge-agent2 --topicId <id>

# Phase 2: 트렌드 및 배치 처리
cli.js seeds --timeframe "now 7-d" --topN 30
cli.js pick-seeds --date 20260215 --autoPick 5
cli.js run-picked --date 20260215
cli.js preflight --date 20260215
cli.js runlist --date 20260215
```

---

## Agent 1: safe-image-acquisition (안전한 이미지 획득)

### 주요 기능
- **이미지 검색**: 여러 제공자(Pexels, Unsplash, Pressroom, AI Generation)에서 이미지 검색
- **라이선스 검증**: 이미지 라이선스 정보 수집 및 정규화
- **증거 캡처**: 이미지 소스 및 라이선스 페이지 해시 캡처
- **사용 검증**: 브리프 요구사항과 라이선스 호환성 검증
- **위험 점수 계산**: 이미지 사용 위험도 평가
- **비전 분석**: 사람, 로고, 워터마크 감지
- **자산 역할 결정**: 이미지 용도 결정 (background_editable, hero_unedited, evidence_only)
- **저작권 표시 생성**: 필수 저작권 표시 텍스트 생성
- **포스트 컴플라이언스**: 포스트 전체의 컴플라이언스 검사

### 입력
- `ImageBrief`: 토픽, 키워드, 사용 목적, 채널, 제약사항 등
- `AcquireOptions`: 카테고리, 출력 디렉토리 등

### 출력
- `validated-asset.json`: 검증된 단일 이미지 자산
- `validated-post.json`: 포스트 전체 컴플라이언스 결과 (이미지 배열, 위험 점수, 저작권 표시 등)

### 주요 명령어
```bash
npx tsx cli.ts \
  --topic "아이브 컴백" \
  --keywords "아이브,뉴진스,케이팝" \
  --use "editorial" \
  --channel "instagram" \
  --category "music" \
  --out "./outputs/post-001"
```

### 제공자 (Providers)
- **Pexels**: 스톡 이미지
- **Unsplash**: 스톡 이미지
- **Pressroom**: 프레스룸 이미지
- **AI Generation**: AI 생성 이미지

### 라우팅 전략
카테고리에 따라 제공자 우선순위 결정:
- `music`, `fashion`, `celebrity`: PR → EDITORIAL → STOCK → AI
- `issue`: EDITORIAL → PR → STOCK → AI

---

## Agent 2: cardnews-composition (카드뉴스 구성)

### 주요 기능
- **컴플라이언스 사전 검사**: Agent 1의 `validated-post.json` 검증
- **크레딧 해결**: 저작권 표시 정보 추출
- **템플릿 매핑**: 토픽 데이터를 템플릿 슬롯에 매핑
- **HTML 생성**: 카드뉴스 슬라이드 HTML 생성
- **PNG 렌더링**: Playwright를 사용한 HTML → PNG 변환
- **텍스트 피팅**: 텍스트 오버플로우 자동 조정
- **QA 검사**: 안전 영역 및 푸터 영역 위반 검사
- **캡션 생성**: Instagram 캡션 텍스트 생성
- **매니페스트 생성**: 레이아웃 및 자산 정보 매니페스트

### 입력
- `validated-post.json`: Agent 1에서 생성된 컴플라이언스 결과
- `topic.json`: Agent 0에서 생성된 토픽 데이터 (또는 `agent2-topic.json`)

### 출력
- `slide_01.html`: 커버 슬라이드 HTML
- `slide_01.png`: 렌더링된 PNG 이미지 (1080x1350)
- `caption.txt`: Instagram 캡션 텍스트
- `layout_manifest.json`: 레이아웃 및 자산 매니페스트

### 주요 명령어 (순차 실행)
```bash
# 1. 사전 검사
npx tsx cli.ts --mode preflight \
  --input outputs/post-001/validated-post.json \
  --out outputs/post-001/agent2

# 2. 템플릿 매핑
npx tsx cli.ts --mode map \
  --input outputs/post-001/validated-post.json \
  --topic outputs/post-001/topic.json \
  --out outputs/post-001/agent2

# 3. HTML 생성
npx tsx cli.ts --mode html \
  --input outputs/post-001/validated-post.json \
  --topic outputs/post-001/topic.json \
  --out outputs/post-001/agent2

# 4. PNG 렌더링
npx tsx cli.ts --mode png \
  --out outputs/post-001/agent2

# 5. 최종화 (캡션 + 매니페스트)
npx tsx cli.ts --mode finalize \
  --input outputs/post-001/validated-post.json \
  --topic outputs/post-001/topic.json \
  --out outputs/post-001/agent2
```

---

## 에이전트 간 연결관계

### 데이터 흐름

```
┌─────────────────────────────────────────────────────────────┐
│ Agent 0: topic-intelligence                                 │
│                                                             │
│  Input: 프롬프트/키워드                                      │
│  ↓                                                          │
│  Phase 1-A: RSS 수집                                        │
│  Phase 1-B: 관련성 점수                                     │
│  Phase 1-C: 콘텐츠 필드 생성                                │
│  Phase 1-D: 토픽 인텔 패키지 조립                            │
│  Phase 1-E: 기사 본문 캐싱                                  │
│  ↓                                                          │
│  Output: topic-intel.json                                   │
│  ↓                                                          │
│  bridge-agent2: 변환                                        │
│  ↓                                                          │
│  Output: agent2-topic.json (또는 topic.json)               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Agent 1: safe-image-acquisition                            │
│                                                             │
│  Input: ImageBrief (토픽, 키워드, 사용 목적 등)              │
│  ↓                                                          │
│  - 제공자 검색 (Pexels, Unsplash, Pressroom, AI)            │
│  - 라이선스 검증                                            │
│  - 증거 캡처                                                │
│  - 사용 검증                                                │
│  - 위험 점수 계산                                           │
│  - 비전 분석                                                │
│  - 저작권 표시 생성                                         │
│  ↓                                                          │
│  Output: validated-post.json                               │
│    - images: ValidatedAsset[]                              │
│    - overallRiskScore                                       │
│    - allowed                                                │
│    - attribution                                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Agent 2: cardnews-composition                               │
│                                                             │
│  Input:                                                     │
│    - validated-post.json (Agent 1)                          │
│    - topic.json (Agent 0)                                   │
│  ↓                                                          │
│  - 컴플라이언스 검증                                        │
│  - 크레딧 해결                                              │
│  - 템플릿 매핑                                              │
│  - HTML 생성                                                │
│  - PNG 렌더링                                               │
│  - 캡션 생성                                                │
│  ↓                                                          │
│  Output:                                                    │
│    - slide_01.png (최종 카드뉴스 이미지)                    │
│    - caption.txt                                            │
│    - layout_manifest.json                                   │
└─────────────────────────────────────────────────────────────┘
```

### 파일 연결관계

| Agent | 출력 파일 | 다음 Agent | 입력으로 사용 |
|-------|----------|-----------|--------------|
| Agent 0 | `topic-intel.json` | → | Agent 0 (bridge) |
| Agent 0 | `agent2-topic.json` | → | Agent 2 (`topic.json`) |
| Agent 1 | `validated-post.json` | → | Agent 2 |
| Agent 2 | `slide_01.png` | → | 최종 결과물 |

### 데이터 구조 연결

**Agent 0 → Agent 1:**
- Agent 0의 `imageQueries` → Agent 1의 `ImageBrief.keywords`
- Agent 0의 `category` → Agent 1의 `AcquireOptions.category`

**Agent 0 → Agent 2:**
- Agent 0의 `agent2-topic.json`:
  - `title` → Agent 2 템플릿의 제목 슬롯
  - `facts` → Agent 2 템플릿의 사실 슬롯
  - `angles` → Agent 2 각도 선택
  - `sources` → Agent 2 소스 표시

**Agent 1 → Agent 2:**
- Agent 1의 `validated-post.json`:
  - `images[].localPath` → Agent 2 이미지 자산 경로
  - `images[].role` → Agent 2 자산 역할 결정
  - `attribution` → Agent 2 저작권 표시
  - `allowed` → Agent 2 사전 검사
  - `overallRiskScore` → Agent 2 위험 평가

---

## 주요 데이터 타입

### Agent 0 → Agent 1
```typescript
// Agent 0 출력
{
  imageQueries: string[];  // → ImageBrief.keywords
  category: "music" | "lifestyle";  // → AcquireOptions.category
}
```

### Agent 1 → Agent 2
```typescript
// Agent 1 출력 (validated-post.json)
{
  images: ValidatedAsset[];
  attribution: AttributionBundle;
  allowed: boolean;
  overallRiskScore: number;
}
```

### Agent 0 → Agent 2
```typescript
// Agent 0 출력 (agent2-topic.json)
{
  title: string;
  category: "music" | "lifestyle";
  facts: string[];
  angles: string[];
  sources: Array<{title: string; url: string}>;
}
```

---

## 실행 시나리오 예시

### 시나리오 1: 전체 파이프라인 실행

```bash
# 1. Agent 0: 토픽 인텔리전스 수집
npx tsx agents/topic-intelligence/cli.ts request --prompt "아이브 컴백 소식"
TOPIC_ID="..."  # 생성된 ID 사용

npx tsx agents/topic-intelligence/cli.ts intel --topicId $TOPIC_ID --phase A
npx tsx agents/topic-intelligence/cli.ts intel --topicId $TOPIC_ID --phase B
npx tsx agents/topic-intelligence/cli.ts intel --topicId $TOPIC_ID --phase C
npx tsx agents/topic-intelligence/cli.ts intel --topicId $TOPIC_ID --phase D
npx tsx agents/topic-intelligence/cli.ts bridge-agent2 --topicId $TOPIC_ID

# 2. Agent 1: 이미지 획득
npx tsx agents/safe-image-acquisition/cli.ts \
  --topic "아이브 컴백" \
  --keywords "아이브,뉴진스" \
  --use "editorial" \
  --channel "instagram" \
  --category "music" \
  --out "./outputs/post-001"

# 3. Agent 2: 카드뉴스 구성
npx tsx agents/cardnews-composition/cli.ts --mode preflight \
  --input outputs/post-001/validated-post.json \
  --out outputs/post-001/agent2

npx tsx agents/cardnews-composition/cli.ts --mode html \
  --input outputs/post-001/validated-post.json \
  --topic outputs/post-001/agent2-topic.json \
  --out outputs/post-001/agent2

npx tsx agents/cardnews-composition/cli.ts --mode png \
  --out outputs/post-001/agent2

npx tsx agents/cardnews-composition/cli.ts --mode finalize \
  --input outputs/post-001/validated-post.json \
  --topic outputs/post-001/agent2-topic.json \
  --out outputs/post-001/agent2
```

---

## 의존성 요약

- **Agent 0** → 독립 실행 가능
- **Agent 1** → Agent 0의 `imageQueries` 활용 (선택적)
- **Agent 2** → Agent 0의 `topic.json` + Agent 1의 `validated-post.json` 필수

각 에이전트는 JSON 파일을 통해 느슨하게 결합되어 있어, 개별적으로도 실행 가능합니다.
