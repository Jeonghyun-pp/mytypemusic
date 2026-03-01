# 프로젝트 진행상황 및 최종 산출물 가이드

## 📋 프로젝트 개요

웹 매거진 콘텐츠 제작을 위한 멀티 에이전트 시스템입니다. 토픽 인텔리전스 수집부터 카드뉴스 이미지 생성, 최종 퍼블리시 번들까지 전 과정을 자동화합니다.

**현재 상태**: MVP 단계 완료 ✅  
**에이전트 수**: 5개 (Agent 0 ~ Agent 4)  
**데이터 소스**: 실제 API 사용 (RSS, Google Trends, 이미지 API 등)

---

## 🎯 최종 산출물

### 최종 산출물: `publish-bundle.json`

**위치**: `outputs/<TOPIC_ID>/publish-bundle.json`

**구성 요소**:
- **Deck**: 카드뉴스 슬라이드 이미지들 (PNG 파일 경로)
- **Caption**: Instagram 캡션 텍스트 및 해시태그
- **Compliance**: 위험 노트, 저작권 표시, 소스 정보
- **Provenance**: 모든 Agent 출력 파일 경로 추적

**생성 Agent**: Agent 4 (publish-bundle)

---

## 🔄 전체 파이프라인 흐름

```
[사용자 입력: 프롬프트/키워드]
         ↓
┌─────────────────────────────────────────┐
│ Agent 0: topic-intelligence             │
│ - RSS 수집 및 분석                      │
│ - 핵심 사실 추출                        │
│ - 각도 후보 생성                        │
│ Output: topic-intel.json                │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ Agent 3: content-structuring            │
│ - ContentPlan 생성                       │
│ - LLM 리라이트 (선택적)                  │
│ - Caption 초안 생성                     │
│ Output: content-plan.json               │
│         agent2-topic.json                │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ Agent 1: safe-image-acquisition        │
│ - 이미지 검색 (Pexels, Unsplash 등)     │
│ - 라이선스 검증                         │
│ - 컴플라이언스 검사                     │
│ Output: validated-post.json             │
│         <UUID>.jpg (이미지 파일)         │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ Agent 2: cardnews-composition           │
│ - 템플릿 매핑                           │
│ - HTML 생성                             │
│ - PNG 렌더링 (Playwright)               │
│ - 캡션 및 매니페스트 생성               │
│ Output: slide_01.png, slide_02.png ... │
│         caption.txt                     │
│         layout_manifest.json            │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ Agent 4: publish-bundle                │
│ - 모든 Agent 출력 통합                  │
│ - 최종 번들 검증                        │
│ Output: publish-bundle.json (최종)     │
└─────────────────────────────────────────┘
```

---

## 📦 각 Agent 상세 설명

### Agent 0: topic-intelligence (토픽 인텔리전스)

**역할**: 토픽에 대한 인텔리전스 데이터 수집 및 분석

**주요 과정**:

1. **Phase 1-A: RSS 수집**
   - 한국 주요 뉴스 사이트 RSS 피드 수집
   - XML 파싱 및 정규화
   - 최신성 필터링 (recencyDays 기준)
   - URL 중복 제거

2. **Phase 1-B: 관련성 점수 계산**
   - 키워드 매칭 점수
   - 카테고리 일치 점수
   - 제목/내용 분석 점수
   - 상위 K개 선택 (maxArticles 기준)

3. **Phase 1-C: 콘텐츠 필드 생성**
   - **커버리지 분석**: 소스 클러스터링, 모멘텀 계산
   - **핵심 사실 추출**: 기사 본문에서 사실 추출, 점수 계산, 증거 URL 수집
   - **각도 생성**: 카테고리 및 깊이에 따른 각도 후보 생성
   - **이미지 쿼리 생성**: 키워드 기반 이미지 검색 쿼리
   - **위험 노트 생성**: 누락된 정보, 부족한 소스 등 기록

4. **Phase 1-D: 토픽 인텔 패키지 조립**
   - `TopicIntelPack` 객체 생성
   - Zod 스키마 검증
   - `topic-intel.json` 저장

5. **Phase 1-E: 기사 본문 캐싱** (선택)
   - 각 소스 URL에서 HTML 다운로드
   - 본문 텍스트 추출
   - `article.{idx}.json` 저장

**출력 파일**:
- `outputs/<TOPIC_ID>/topic-request.json`: 토픽 요청 정보
- `outputs/<TOPIC_ID>/topic-intel.json`: 토픽 인텔리전스 패키지
- `outputs/<TOPIC_ID>/articles/article.{idx}.json`: 기사 본문 캐시 (선택)

**다음 Agent로 전달**: Agent 3 (content-structuring)

---

### Agent 3: content-structuring (콘텐츠 구조화)

**역할**: 토픽 인텔리전스를 구조화된 콘텐츠 계획으로 변환

**주요 과정**:

1. **ContentPlan 생성**
   - `topic-intel.json` 로드
   - 제목/부제목 생성
   - 슬라이드 구조 생성 (cover, fact, summary, cta, credits)
   - 해시태그 생성
   - 크레딧 소스 수집

2. **LLM 리라이트** (선택적)
   - 기본값: `mode: "off"` (비활성화)
   - `mode: "polish"` 선택 시:
     - OpenAI 또는 Anthropic API 호출
     - 슬라이드 텍스트 다듬기
     - 캡션 텍스트 생성
     - Guardrail 적용 (사실 보존, 엔티티 변경 금지)

3. **Caption 초안 생성**
   - 해시태그 포함
   - 소스 정보 포함

4. **Agent 2용 브리지**
   - `ContentPlan` → `Agent2TopicInput` 변환
   - 슬라이드 구조 단순화
   - 크레딧 정보 정리

**출력 파일**:
- `outputs/<TOPIC_ID>/content-plan.json`: 콘텐츠 계획
- `outputs/<TOPIC_ID>/caption.draft.txt`: 캡션 초안
- `outputs/<TOPIC_ID>/agent2-topic.json`: Agent 2용 토픽 데이터
- `outputs/<TOPIC_ID>/rewrite.report.json`: 리라이트 리포트 (리라이트 사용 시)

**다음 Agent로 전달**: Agent 1 (이미지 획득), Agent 2 (카드뉴스 구성)

---

### Agent 1: safe-image-acquisition (안전한 이미지 획득)

**역할**: 라이선스 검증된 이미지 자산 획득

**주요 과정**:

1. **이미지 검색**
   - 라우팅 전략에 따라 제공자 순차 검색:
     - `music`, `fashion`, `celebrity`: PR → EDITORIAL → STOCK → AI
     - `issue`: EDITORIAL → PR → STOCK → AI
   - 제공자:
     - **Pexels**: 스톡 이미지 (API 키 필요)
     - **Unsplash**: 스톡 이미지 (API 키 필요)
     - **Pressroom**: 프레스룸 이미지 (웹 크롤링)
     - **AI Generation**: OpenAI DALL-E (API 키 필요)

2. **라이선스 검증**
   - 각 후보 이미지의 라이선스 정보 수집
   - 라이선스 정규화
   - 증거 캡처 (라이선스 페이지 해시)

3. **사용 검증**
   - 브리프 요구사항과 라이선스 호환성 검사
   - intendedUse (commercial/editorial) 검증
   - 채널 (instagram/web/print) 검증
   - derivatives 허용 여부 검증

4. **위험 점수 계산**
   - 라이선스 신뢰도
   - intendedUse 충돌
   - derivatives 제약
   - 비전 분석 (사람, 로고, 워터마크 감지)
   - 카테고리 baseline

5. **자산 역할 결정**
   - `background_editable`: 배경용, 편집 가능
   - `hero_unedited`: 메인 이미지, 편집 불가
   - `evidence_only`: 증거용

6. **포스트 컴플라이언스**
   - 모든 이미지 통합 검사
   - 전체 위험 점수 계산
   - 저작권 표시 생성

**출력 파일**:
- `outputs/<OUTPUT_DIR>/validated-asset.json`: 검증된 단일 이미지 자산
- `outputs/<OUTPUT_DIR>/validated-post.json`: 포스트 전체 컴플라이언스 결과
- `outputs/<OUTPUT_DIR>/<UUID>.jpg`: 다운로드된 이미지 파일

**다음 Agent로 전달**: Agent 2 (cardnews-composition)

---

### Agent 2: cardnews-composition (카드뉴스 구성)

**역할**: 카드뉴스 슬라이드 이미지 생성

**주요 과정**:

1. **사전 검사 (preflight)**
   - `validated-post.json` 검증
   - `allowed` 플래그 확인 (false면 차단)
   - 크레딧 정보 추출

2. **템플릿 매핑 (map)**
   - `agent2-topic.json` 로드
   - 템플릿 슬롯에 데이터 매핑
   - 매핑 프리뷰 생성

3. **HTML 생성 (html)**
   - 각 슬라이드별 HTML 생성
   - 템플릿 적용
   - 이미지 자산 경로 삽입
   - 텍스트 피팅 (오버플로우 자동 조정)

4. **PNG 렌더링 (png)**
   - Playwright로 브라우저 엔진 실행
   - HTML → PNG 변환 (1080x1350)
   - 각 슬라이드별 PNG 파일 생성

5. **QA 검사 (deck-qa)**
   - 안전 영역 위반 검사
   - 푸터 영역 위반 검사
   - 리포트 생성

6. **최종화 (finalize)**
   - Instagram 캡션 생성
   - 레이아웃 매니페스트 생성
   - 모든 슬라이드 정보 통합

**출력 파일**:
- `outputs/<OUTPUT_DIR>/agent2/slide_01.html`, `slide_02.html`, ...
- `outputs/<OUTPUT_DIR>/agent2/slide_01.png`, `slide_02.png`, ...
- `outputs/<OUTPUT_DIR>/agent2/caption.txt`: Instagram 캡션
- `outputs/<OUTPUT_DIR>/agent2/layout_manifest.json`: 레이아웃 매니페스트
- `outputs/<OUTPUT_DIR>/agent2/mapping.preview.json`: 매핑 프리뷰
- `outputs/<OUTPUT_DIR>/agent2/qa.report.json`: QA 리포트

**다음 Agent로 전달**: Agent 4 (publish-bundle)

---

### Agent 4: publish-bundle (퍼블리시 번들)

**역할**: 모든 Agent 출력을 통합하여 최종 퍼블리시 가능한 번들 생성

**주요 과정**:

1. **입력 파일 로드**
   - `topic-intel.json` (Agent 0)
   - `content-plan.json` (Agent 3)
   - `caption.draft.txt` (Agent 3)
   - `validated-post.json` (Agent 1)
   - `layout_manifest.json` (Agent 2)
   - Deck PNG 파일들 (Agent 2)

2. **Deck 자산 수집**
   - `layout_manifest.json`에서 슬라이드 정보 읽기
   - PNG 파일 경로 수집
   - 슬라이드 인덱스 정렬

3. **번들 조립**
   - **Deck**: 슬라이드 파일 경로 배열
   - **Caption**: 텍스트 및 해시태그
   - **Compliance**: 위험 노트, 저작권 표시, 소스 정보
   - **Provenance**: 모든 입력 파일 경로 추적

4. **검증**
   - Zod 스키마로 `PublishBundle` 검증
   - 필수 필드 확인
   - 파일 존재 확인

5. **저장**
   - `publish-bundle.json` 저장

**출력 파일**:
- `outputs/<TOPIC_ID>/publish-bundle.json`: **최종 산출물**

---

## 📊 데이터 흐름 상세

### Agent 0 → Agent 3

**전달 데이터**:
```typescript
// topic-intel.json
{
  topicId: string;
  normalizedTopic: string;
  category: "music" | "lifestyle";
  sources: Array<{
    title: string;
    url: string;
    publisher?: string;
    publishedAt?: string;
  }>;
  keyFacts: Array<{
    text: string;
    evidenceUrls: string[];
  }>;
  angleCandidates: string[];
  imageQueries: string[];
  riskNotes: string[];
}
```

**Agent 3에서 사용**:
- `keyFacts` → 슬라이드 내용 생성
- `angleCandidates` → 각도 선택
- `sources` → 크레딧 소스
- `imageQueries` → Agent 1 키워드 (선택적)

---

### Agent 3 → Agent 2

**전달 데이터**:
```typescript
// agent2-topic.json
{
  title: string;
  category: "music" | "lifestyle";
  slides: Array<{
    kind: "cover" | "fact" | "summary" | "cta" | "credits";
    headline: string;
    bullets?: string[];
    note?: string;
  }>;
  caption?: string;
  credits?: Array<{
    title: string;
    url: string;
  }>;
}
```

**Agent 2에서 사용**:
- `title` → 커버 슬라이드 제목
- `slides` → 각 슬라이드 내용
- `credits` → 크레딧 슬라이드

---

### Agent 1 → Agent 2

**전달 데이터**:
```typescript
// validated-post.json
{
  images: Array<{
    assetId: string;
    localPath: string;  // 이미지 파일 경로
    role: "background_editable" | "hero_unedited" | "evidence_only";
    // ...
  }>;
  attribution: {
    captionAppendix?: string;
    footerCredits?: string;
    perImageCredits?: Array<{
      localPath: string;
      creditLine: string;
    }>;
  };
  allowed: boolean;  // false면 Agent 2에서 차단
  overallRiskScore: number;
}
```

**Agent 2에서 사용**:
- `images[].localPath` → HTML에 이미지 삽입
- `images[].role` → 이미지 용도 결정
- `attribution` → 저작권 표시
- `allowed` → 사전 검사

---

### Agent 0/3/1/2 → Agent 4

**통합 데이터**:
```typescript
// publish-bundle.json
{
  topicId: string;
  category: "music" | "lifestyle";
  region: "KR" | "GLOBAL";
  title: string;
  subtitle?: string;
  
  deck: {
    size: { width: 1080, height: 1350 };
    format: "png";
    slides: Array<{
      index: number;
      kind: "cover" | "fact" | "summary" | "cta" | "credits";
      filePath: string;  // slide_01.png 경로
    }>;
  };
  
  caption: {
    text: string;  // Instagram 캡션
    hashtags: string[];
  };
  
  compliance: {
    riskNotes: string[];  // Agent 0에서
    attribution: {  // Agent 1에서
      captionAppendix?: string;
      footerCredits?: string;
      perImageCredits?: Array<{
        localPath: string;
        creditLine: string;
      }>;
    };
    sources: Array<{  // Agent 3에서
      title: string;
      url: string;
      publisher?: string;
      publishedAt?: string;
    }>;
  };
  
  provenance: {  // 모든 입력 파일 경로
    topicIntelPath?: string;
    contentPlanPath?: string;
    agent2TopicPath?: string;
    deckManifestPath?: string;
    validatedPostPath?: string;
  };
  
  createdAt: string;
  version: "1.0";
}
```

---

## 📁 출력 파일 구조

```
outputs/
├── <TOPIC_ID>/                          # Agent 0, 3, 4 출력
│   ├── topic-request.json              # Agent 0
│   ├── topic-intel.json                # Agent 0
│   ├── content-plan.json               # Agent 3
│   ├── caption.draft.txt               # Agent 3
│   ├── agent2-topic.json               # Agent 3
│   ├── rewrite.report.json             # Agent 3 (리라이트 사용 시)
│   ├── publish-bundle.json             # Agent 4 (최종 산출물)
│   └── articles/                       # Agent 0 (선택)
│       ├── index.json
│       └── article.{idx}.json
│
└── <OUTPUT_DIR>/                        # Agent 1, 2 출력
    ├── validated-asset.json             # Agent 1
    ├── validated-post.json             # Agent 1
    ├── <UUID>.jpg                       # Agent 1 (이미지 파일)
    └── agent2/                          # Agent 2
        ├── slide_01.html
        ├── slide_01.png
        ├── slide_02.html
        ├── slide_02.png
        ├── ...
        ├── caption.txt
        ├── layout_manifest.json
        ├── mapping.preview.json
        └── qa.report.json
```

---

## 🎬 실행 순서 예시

### 전체 파이프라인 실행

```powershell
# 1. Agent 0: 토픽 인텔리전스 수집
npx tsx agents/topic-intelligence/cli.ts request --prompt "아이브 컴백 소식"
$TOPIC_ID = "생성된_TOPIC_ID"

npx tsx agents/topic-intelligence/cli.ts intel --topicId $TOPIC_ID --phase A
npx tsx agents/topic-intelligence/cli.ts intel --topicId $TOPIC_ID --phase B
npx tsx agents/topic-intelligence/cli.ts intel --topicId $TOPIC_ID --phase C
npx tsx agents/topic-intelligence/cli.ts intel --topicId $TOPIC_ID --phase D

# 2. Agent 3: 콘텐츠 구조화
npx tsx agents/content-structuring/cli.ts content --topicId $TOPIC_ID
npx tsx agents/content-structuring/cli.ts bridge --topicId $TOPIC_ID

# 3. Agent 1: 이미지 획득
npx tsx agents/safe-image-acquisition/cli.ts `
  --topic "아이브 컴백" `
  --keywords "아이브,뉴진스,케이팝" `
  --use editorial `
  --channel instagram `
  --category music `
  --out "./outputs/test-run"

# 4. Agent 2: 카드뉴스 구성
npx tsx agents/cardnews-composition/cli.ts `
  --mode render `
  --input "./outputs/test-run/validated-post.json" `
  --topic "./outputs/$TOPIC_ID/agent2-topic.json" `
  --out "./outputs/test-run/agent2"

# 5. Agent 4: 퍼블리시 번들
npx tsx agents/publish-bundle/cli.ts scaffold --topicId $TOPIC_ID
npx tsx agents/publish-bundle/cli.ts build --topicId $TOPIC_ID
```

### 최종 산출물 확인

```powershell
# 최종 산출물 확인
cat outputs/$TOPIC_ID/publish-bundle.json

# 또는 JSON 포맷팅하여 확인
Get-Content outputs/$TOPIC_ID/publish-bundle.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## ✅ MVP 완성도

### 완료된 기능

- ✅ **Agent 0**: RSS 수집, 관련성 점수, 사실 추출, 각도 생성, 트렌드 시드 수집
- ✅ **Agent 1**: 이미지 검색, 라이선스 검증, 컴플라이언스 검사
- ✅ **Agent 2**: HTML 생성, PNG 렌더링, QA 검사
- ✅ **Agent 3**: ContentPlan 생성, LLM 리라이트, 브리지
- ✅ **Agent 4**: 번들 통합 및 검증

### 데이터 소스

- ✅ **실제 API 사용**: RSS 피드, Google Trends, 이미지 API (Pexels, Unsplash, Pressroom, OpenAI)
- ✅ **Mock 모드**: Agent 3 리라이트만 선택적 mock 지원

### 최종 산출물

- ✅ **publish-bundle.json**: 모든 Agent 출력 통합
- ✅ **Deck PNG 파일들**: 카드뉴스 슬라이드 이미지
- ✅ **Caption 텍스트**: Instagram 캡션
- ✅ **Compliance 정보**: 위험 노트, 저작권 표시, 소스 정보

---

## 📝 참고 문서

- `QUICK_START.md`: 빠른 시작 가이드
- `AGENTS_OVERVIEW.md`: 에이전트 개요 및 연결관계
- `TOPIC_INTELLIGENCE_STRUCTURE.md`: Agent 0 상세 구조
- `TOPIC_INTELLIGENCE_FEATURES.md`: Agent 0 기능 목록

---

**최종 업데이트**: 2025-02-15  
**버전**: MVP 1.0
