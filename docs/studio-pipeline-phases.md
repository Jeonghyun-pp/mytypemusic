# Studio Pipeline Phases (Phase 1–4)

> Web Magazine Studio 파이프라인의 단계적 진화 정리.
> Branch: `geonu` | Base commit: `7346f05`

---

## Pipeline Flow Overview

```
[CreateRunForm] → POST /api/runs
  ↓
spotify_prefetch (Phase 1: 음악 PostType만)
  ↓ CHECKPOINT (keyword alignment)
url_fetch → trend_signals ∥ topic_request
  ↓
topic_intel_A → B → C → D
  ↓
content → bridge
  ↓
image (Agent1)
  ↓
llm_slide_plan        (Phase 2: slideCount 설정 시)
  ↓
style_analysis        (Phase 2: reference images)
  ↓ CHECKPOINT
slide_plan_review     (Phase 3: 텍스트 리뷰)
  ↓ CHECKPOINT
slide_editing         (Phase 4: 슬라이드별 프리뷰+편집)
  ↓ CHECKPOINT
deck_review           (Phase 4: 전체 덱 그리드 승인)
  ↓
agent2_render         (Phase 4: slideCount 시 finalize+QA만)
  ↓
bundle
```

`slideCount` 미설정 시: `llm_slide_plan` ~ `deck_review` 모두 스킵, `agent2_render`는 풀 렌더.

---

## Phase 1: Music PostTypes + Checkpoint System

### 목적
PostType별 파이프라인 분기 + Spotify 키워드 정렬 체크포인트

### 핵심 기능
- **PostType 선택**: album_release, artist_spotlight, curated_playlist, concert_info, meme, album_recommendation, general_cardnews
- **PostTypeConfig**: `requiresTopicIntel` 플래그 + 동적 체크포인트 정의
- **spotify_prefetch 체크포인트**: topicId 생성 전 Spotify 데이터로 키워드 정렬
- **HumanCreativeInput**: PostType별 사용자 입력 (meme text, concert info, album selection 등)
- **PostType-aware plan builder**: `buildPostTypePlan()` — PostType에 따라 단계 건너뛰기/체크포인트 삽입

### 파일 변경

| 구분 | 파일 | 변경 내용 |
|------|------|-----------|
| **New** | `apps/studio/src/app/studio/_components/KeywordChips.tsx` | Spotify 키워드 편집 칩 UI |
| **New** | `apps/studio/src/app/studio/_components/SpotifyReferenceCards.tsx` | Spotify artist/album/track 카드 표시 |
| Modified | `apps/studio/src/lib/studio/runTypes.ts` | `PostType`, `HumanCreativeInput`, `CheckpointState`, `RunStatus` (awaiting_input/approval) |
| Modified | `apps/studio/src/lib/studio/runSchema.ts` | Zod 스키마에 PostType, checkpoint 관련 필드 추가 |
| Modified | `apps/studio/src/lib/studio/orchestrator/plan.ts` | `PostTypeConfig` 시스템, `buildPostTypePlan()`, `SPOTIFY_FIRST_TYPES`, spotify_prefetch 조건부 삽입 |
| Modified | `apps/studio/src/lib/studio/orchestrator/pipeline.ts` | `startPipeline()`: spotify_prefetch 체크포인트 감지 → pause, `continueFromSpotifyCheckpoint()`, `resumePipeline()` |
| Modified | `apps/studio/src/app/studio/_components/CreateRunForm.tsx` | PostType 드롭다운, PostType별 입력 필드 |
| Modified | `apps/studio/src/app/studio/runs/[runId]/_components/CheckpointPanel.tsx` | 키워드 정렬 UI, PostType별 human input 폼 (meme, concert, album, playlist) |

---

## Phase 2: LLM Slide Plan + Style Analysis + Reference Images

### 목적
Claude API로 슬라이드 기획 자동 생성 + 레퍼런스 이미지 기반 스타일 추출

### 핵심 기능
- **slideCount**: 사용자가 3~15장 슬라이드 개수 지정
- **LLM Slide Plan**: Claude API로 slide별 kind/title/bodyText/imageDescription 자동 생성
- **Style Analysis**: 레퍼런스 이미지(최대 3장) → Claude Vision → CSS 스타일 프로파일 추출
- **Reference Image Upload**: 드래그&드롭으로 레퍼런스 이미지 업로드
- **CLI 모드**: `--mode llm-plan`, `--mode style-analyze`

### 파일 변경

| 구분 | 파일 | 변경 내용 |
|------|------|-----------|
| **New** | `agents/cardnews-composition/llm/index.ts` | `generateSlidePlan()` 오케스트레이션 |
| **New** | `agents/cardnews-composition/llm/schema.ts` | `LLMSlidePlan`, `LLMSlideContent` Zod 스키마 |
| **New** | `agents/cardnews-composition/llm/anthropic-client.ts` | Claude API 호출 |
| **New** | `agents/cardnews-composition/llm/prompts.ts` | System/user 프롬프트 빌더 |
| **New** | `agents/cardnews-composition/llm/fallback.ts` | API 실패 시 deterministic fallback planner |
| **New** | `agents/cardnews-composition/style-analysis/index.ts` | `analyzeReferenceImages()` 오케스트레이션 |
| **New** | `agents/cardnews-composition/style-analysis/schema.ts` | StyleProfile Zod 스키마 |
| **New** | `agents/cardnews-composition/style-analysis/vision-prompt.ts` | Claude Vision 프롬프트 |
| **New** | `agents/cardnews-composition/style-analysis/css-mapper.ts` | 분석 결과 → CSS 변수 매핑 |
| **New** | `apps/studio/src/app/studio/_components/ReferenceImageUploader.tsx` | 드래그&드롭 이미지 업로더 (최대 3장) |
| **New** | `apps/studio/src/app/api/runs/[runId]/reference-images/route.ts` | POST: 이미지 업로드, GET: 이미지 목록 |
| Modified | `agents/cardnews-composition/cli.ts` | `--mode llm-plan`, `--mode style-analyze` 핸들러 |
| Modified | `apps/studio/src/lib/studio/runTypes.ts` | `RunInput.slideCount` 필드 |
| Modified | `apps/studio/src/lib/studio/runStore.ts` | `ALL_STEPS`에 `llm_slide_plan`, `style_analysis` 추가 |
| Modified | `apps/studio/src/lib/studio/orchestrator/plan.ts` | `llm_slide_plan` 단계 (slideCount 조건부), `style_analysis` 단계, timeout 설정 |
| Modified | `apps/studio/src/lib/studio/client/api.ts` | `uploadReferenceImages()` |
| Modified | `apps/studio/src/app/studio/_components/CreateRunForm.tsx` | slideCount 슬라이더, ReferenceImageUploader 통합 |

---

## Phase 3: Slide Plan Review Checkpoint

### 목적
LLM이 생성한 슬라이드 플랜을 렌더링 전에 사용자가 검토/편집

### 핵심 기능
- **slide_plan_review 체크포인트**: `style_analysis` 이후, `agent2_render` 이전에 파이프라인 일시정지
- **DeckEditSession**: 슬라이드 편집 상태를 JSON 파일로 관리 (생성 → 편집 → 확정)
- **SlidePlanReview UI**: 전체 내러티브, 슬라이드별 title/body 편집, caption draft 수정, hashtag 표시
- **Post-resolution hook**: 확정 후 편집 내용을 `llm-slide-plan.json`에 반영

### Pipeline 흐름
```
llm_slide_plan → style_analysis →
  [preCheckpointHook: LLM plan → DeckEditSession 생성] →
  CHECKPOINT: slide_plan_review (사용자 리뷰) →
  [postResolutionHook: DeckEditSession → llm-slide-plan.json 업데이트] →
  agent2_render
```

### 파일 변경

| 구분 | 파일 | 변경 내용 |
|------|------|-----------|
| **New** | `apps/studio/src/lib/studio/slideEditTypes.ts` | `SlideEdit`, `DeckEditSession` 타입 + Zod 스키마 |
| **New** | `apps/studio/src/lib/studio/deckSessionStore.ts` | `readDeckSession()`, `writeDeckSession()`, `createDeckSessionFromPlan()`, `applySessionToLLMPlan()` |
| **New** | `apps/studio/src/app/api/runs/[runId]/deck-session/route.ts` | GET/PATCH DeckEditSession API |
| **New** | `apps/studio/src/app/studio/runs/[runId]/_components/SlidePlanReview.tsx` | 슬라이드 플랜 리뷰 UI (카드 리스트 + 편집 폼) |
| Modified | `apps/studio/src/lib/studio/runTypes.ts` | PipelineStep에 `slide_plan_review` 추가 |
| Modified | `apps/studio/src/lib/studio/runSchema.ts` | PipelineStepSchema에 추가 |
| Modified | `apps/studio/src/lib/studio/runStore.ts` | `ALL_STEPS`에 추가 |
| Modified | `apps/studio/src/lib/studio/orchestrator/plan.ts` | `slide_plan_review` 체크포인트 삽입 (slideCount 조건부) |
| Modified | `apps/studio/src/lib/studio/orchestrator/pipeline.ts` | `preCheckpointHook()`, `postResolutionHook()` 추가 |
| Modified | `apps/studio/src/lib/studio/client/api.ts` | `getDeckSession()`, `patchDeckSession()` |
| Modified | `apps/studio/src/lib/studio/client/types.ts` | `DeckEditSession`, `SlideEdit`, `SlideKind` re-export |
| Modified | `apps/studio/src/app/studio/runs/[runId]/_components/CheckpointPanel.tsx` | `slide_plan_review` → SlidePlanReview 라우팅 |

---

## Phase 4: Per-Slide Interactive Editing + Deck Review

### 목적
슬라이드별 실시간 PNG 프리뷰 렌더링 + 편집 + 전체 덱 승인 워크플로

### 핵심 기능
- **renderSingleSlide()**: 개별 슬라이드 HTML→PNG 렌더링 (cover/fact/outro 지원, autofix 루프)
- **slide_editing 체크포인트**: 2컬럼 에디터 (좌: PNG 프리뷰, 우: title/body 편집)
- **deck_review 체크포인트**: 전체 슬라이드 그리드 + caption/hashtag 최종 편집 + 승인
- **agent2_render 분기**: slideCount 설정 시 `deck-finalize` + `deck-qa`만 실행 (PNG는 이미 생성됨)
- **CLI**: `--mode render-slide` (slideIndex, slideContent JSON)

### Pipeline 흐름
```
slide_plan_review →
  [preCheckpointHook: session.status → "editing"] →
  CHECKPOINT: slide_editing (슬라이드별 프리뷰+편집+확정) →
  CHECKPOINT: deck_review (그리드 리뷰+캡션 편집+승인) →
  [postResolutionHook: caption.txt 작성 + llm-slide-plan.json 업데이트] →
  agent2_render (finalize + QA만)
```

### 사용자 결정
- **프리뷰 = 최종 출력**: slide_editing에서 렌더링한 PNG가 최종 결과물. agent2_render에서 재렌더링 없음.

### 파일 변경

| 구분 | 파일 | 변경 내용 |
|------|------|-----------|
| **New** | `apps/studio/src/app/api/runs/[runId]/slide-preview/route.ts` | POST: 단일 슬라이드 렌더링 API (CLI spawn → PNG) |
| **New** | `apps/studio/src/app/studio/runs/[runId]/_components/SlideEditorPanel.tsx` | 2컬럼 에디터: PNG 프리뷰 + title/body 편집, 슬라이드 네비게이션, 확정 버튼 |
| **New** | `apps/studio/src/app/studio/runs/[runId]/_components/DeckReviewPanel.tsx` | 전체 슬라이드 그리드 + caption textarea + hashtag 칩 + 승인/거부 |
| Modified | `apps/studio/src/lib/studio/slideEditTypes.ts` | `SlideEdit`에 htmlPath, pngPath, previewUrl, confirmedAt 추가. `DeckEditSession`에 currentSlideIndex, status "editing"/"reviewing" 추가 |
| Modified | `apps/studio/src/lib/studio/deckSessionStore.ts` | `createDeckSessionFromPlan()`에 currentSlideIndex 초기화 |
| Modified | `apps/studio/src/lib/studio/runTypes.ts` | PipelineStep에 `slide_editing`, `deck_review` 추가 |
| Modified | `apps/studio/src/lib/studio/runSchema.ts` | PipelineStepSchema에 추가 |
| Modified | `apps/studio/src/lib/studio/runStore.ts` | `ALL_STEPS`에 추가 |
| Modified | `apps/studio/src/lib/studio/orchestrator/plan.ts` | 2개 체크포인트 삽입 + `agent2_render` 분기 (slideCount → finalize+QA only) |
| Modified | `apps/studio/src/lib/studio/orchestrator/pipeline.ts` | `preCheckpointHook(slide_editing)`, `postResolutionHook(deck_review)` |
| Modified | `apps/studio/src/lib/studio/client/api.ts` | `renderSlidePreview()` |
| Modified | `apps/studio/src/app/api/runs/[runId]/deck-session/route.ts` | PATCH에 "editing"/"reviewing" status + currentSlideIndex 지원 |
| Modified | `agents/cardnews-composition/compose.ts` | `renderSingleSlide()` 함수 추가 (~150줄) |
| Modified | `agents/cardnews-composition/cli.ts` | `--mode render-slide` + `--slideIndex` / `--slideContent` 파라미터 |
| Modified | `apps/studio/src/app/studio/runs/[runId]/_components/CheckpointPanel.tsx` | `slide_editing` → SlideEditorPanel, `deck_review` → DeckReviewPanel 라우팅 |

---

## 전체 신규 파일 목록

### Agent2 (cardnews-composition)
```
agents/cardnews-composition/llm/
  ├── index.ts          # generateSlidePlan()
  ├── schema.ts         # LLMSlidePlan Zod
  ├── anthropic-client.ts   # Claude API
  ├── prompts.ts        # 프롬프트 빌더
  └── fallback.ts       # deterministic fallback

agents/cardnews-composition/style-analysis/
  ├── index.ts          # analyzeReferenceImages()
  ├── schema.ts         # StyleProfile Zod
  ├── vision-prompt.ts  # Claude Vision 프롬프트
  └── css-mapper.ts     # 분석 → CSS 변수
```

### Studio App
```
apps/studio/src/lib/studio/
  ├── slideEditTypes.ts     # SlideEdit, DeckEditSession
  └── deckSessionStore.ts   # CRUD + createFromPlan + applyToLLMPlan

apps/studio/src/app/api/runs/[runId]/
  ├── deck-session/route.ts     # GET/PATCH DeckEditSession
  ├── reference-images/route.ts # POST/GET 레퍼런스 이미지
  └── slide-preview/route.ts    # POST 단일 슬라이드 렌더

apps/studio/src/app/studio/_components/
  ├── KeywordChips.tsx              # 키워드 칩 편집기
  ├── SpotifyReferenceCards.tsx     # Spotify 데이터 카드
  └── ReferenceImageUploader.tsx    # 이미지 드래그&드롭 업로더

apps/studio/src/app/studio/runs/[runId]/_components/
  ├── SlidePlanReview.tsx     # Phase 3: 텍스트 리뷰
  ├── SlideEditorPanel.tsx    # Phase 4: 슬라이드별 편집
  └── DeckReviewPanel.tsx     # Phase 4: 전체 덱 승인
```

---

## 수정된 기존 파일 (Phase 1–4 누적)

| 파일 | Phase | 주요 변경 |
|------|-------|-----------|
| `runTypes.ts` | 1,2,3,4 | PostType, HumanCreativeInput, PipelineStep 확장 |
| `runSchema.ts` | 1,2,3,4 | Zod 스키마 동기화 |
| `runStore.ts` | 1,2,3,4 | ALL_STEPS 확장, artifacts CRUD |
| `plan.ts` | 1,2,3,4 | PostTypeConfig, buildPostTypePlan, 체크포인트 삽입, agent2_render 분기 |
| `pipeline.ts` | 1,3,4 | 체크포인트 pause/resume, pre/post hooks |
| `client/api.ts` | 2,3,4 | getDeckSession, patchDeckSession, renderSlidePreview, uploadReferenceImages |
| `CheckpointPanel.tsx` | 1,3,4 | PostType별 input 폼, 3개 checkpoint 컴포넌트 라우팅 |
| `CreateRunForm.tsx` | 1,2 | PostType 선택, slideCount 입력, 레퍼런스 이미지 업로더 |
| `cli.ts` (Agent2) | 2,4 | llm-plan, style-analyze, render-slide 모드 |
| `compose.ts` (Agent2) | 4 | renderSingleSlide() |

---

## TypeScript 검증

```bash
npx tsc --noEmit
# Phase 4 완료 후: 신규 에러 0건
# 기존 에러 4건 (Spotify client ESM/CJS 호환 — Phase 1~4 무관)
```
