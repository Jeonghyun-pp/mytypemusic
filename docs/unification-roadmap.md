# Runs ↔ Design Editor 통합 아키텍처 방향

## 현재 상태: 두 개의 독립 시스템

```
┌─────────────────────────────────────┐     ┌─────────────────────────────────┐
│         RUNS PIPELINE               │     │        DESIGN EDITOR            │
│                                     │     │                                 │
│  SlideEdit (서버 저장)               │     │  SlideSpec (localStorage)       │
│  DeckEditSession                    │     │  DesignSpec                     │
│       ↓                             │     │       ↓                         │
│  /api/runs/[runId]/slide-preview    │     │  /api/design/render             │
│       ↓                             │     │       ↓                         │
│  Agent2 CLI (npx tsx cli.ts)        │     │  inlineRenderer.ts              │
│       ↓                             │     │       ↓                         │
│  renderer/html.ts (템플릿 A)        │     │  templates.ts (템플릿 B)        │
│       ↓                             │     │       ↓                         │
│  renderer/satori.ts (렌더러 A)      │     │  inlineRenderer.ts (렌더러 B)   │
│       ↓                             │     │       ↓                         │
│  PNG → 디스크 파일                   │     │  PNG → data URI                 │
└─────────────────────────────────────┘     └─────────────────────────────────┘
```

**문제**: 같은 일(슬라이드 HTML 생성 + Satori 렌더링)을 두 번 구현함.
- 템플릿 HTML 생성기: `renderer/html.ts` vs `designEditor/templates.ts` (중복)
- Satori 렌더러: `renderer/satori.ts` vs `designEditor/inlineRenderer.ts` (중복)
- 데이터 모델: `SlideEdit` vs `SlideSpec` vs `SlidePlan` (3종)
- fontMood/preset: Design Editor에만 UI 있음, Runs에는 자동 선택만

---

## 목표 상태: 단일 렌더링 코어

```
┌──────────────────────────────────────────────────────────────┐
│                    SHARED RENDER CORE                         │
│                                                              │
│  SlideRenderSpec (통합 데이터 모델)                            │
│       ↓                                                      │
│  renderSlideHtml(spec) → HTML string        (templates 통합)  │
│       ↓                                                      │
│  renderToPng(html, fontMood) → Buffer/URI   (Satori 통합)    │
│                                                              │
└──────────────┬─────────────────────────┬─────────────────────┘
               │                         │
     ┌─────────▼──────────┐    ┌─────────▼──────────┐
     │   Agent2 CLI        │    │   Studio API        │
     │   (래퍼)             │    │   (래퍼)             │
     │                     │    │                     │
     │ - 파일 I/O          │    │ - HTTP 엔드포인트    │
     │ - QA/autofix        │    │ - LRU 캐시          │
     │ - LLM slide plan    │    │ - data URI 반환     │
     │ - 배치 렌더링        │    │ - 실시간 프리뷰      │
     └─────────────────────┘    └─────────────────────┘
               │                         │
     ┌─────────▼──────────┐    ┌─────────▼──────────┐
     │  Runs Pipeline      │    │  Design Editor      │
     │  SlideEditorPanel   │    │  DesignEditor.tsx    │
     │  DeckReviewPanel    │    │  StyleControlsTab    │
     │  + fontMood/preset  │    │  + fontMood/preset   │
     │    수동 선택 UI       │    │    수동 선택 UI       │
     └─────────────────────┘    └─────────────────────┘
```

---

## 단계별 로드맵

### Phase 1: 렌더링 함수 통합 (빠른 성과)

**지금 상태**: Satori 렌더러 2개 (`satori.ts`, `inlineRenderer.ts`)가 거의 동일한 코드.

**할 일**: 공유 렌더링 모듈을 만들어 양쪽 모두 사용하도록 통합.

```
agents/shared/render.ts   ← 새 파일 (또는 기존 inlineRenderer.ts 승격)
  ├─ renderHtmlToPngBuffer(html, fontMood?) → Buffer
  ├─ renderHtmlToDataUri(html, fontMood?) → string
  ├─ MOOD_CSS_STACKS, isValidFontMood()
  └─ htmlToVdom(), fixSatoriCompat()  (Satori VDOM 변환)
```

- Agent CLI: `import { renderHtmlToPngBuffer } from "shared/render"` → 파일 쓰기만 래핑
- Studio API: `import { renderHtmlToDataUri } from "shared/render"` → 그대로 사용
- 폰트 로딩/캐시도 한곳에서 관리

**효과**: 폰트 무드 변경이 양쪽에 동시 적용. 렌더링 버그 수정이 한 곳에서 해결.

---

### Phase 2: 템플릿 HTML 생성기 통합

**지금 상태**:
- Agent: `renderer/html.ts` — Cover v1/v2, Fact v1-v4, Outro v1, Music 5종
- Studio: `designEditor/templates.ts` — Cover v1/v2, Fact v1-v3, Outro v1

**두 시스템의 차이점**:

| 항목 | Agent html.ts | Studio templates.ts |
|------|------|------|
| 입력 | `(template, mapping, styleVars, cssOverrideBlock)` | `(RenderInput)` — 단일 객체 |
| CSS 오버라이드 | StyleProfile → CSS 변수 블록 주입 | 인라인 스타일 직접 설정 |
| QA autofix | overflow 감지 → 폰트 축소 → 재렌더 | 없음 |
| 뮤직 템플릿 | 5종 (album, concert, meme, grid, detail) | 없음 |
| v4 editorial | 있음 | 없음 |

**할 일**: 하나의 템플릿 모듈로 통합.

```
agents/shared/templates/
  ├─ types.ts          ← SlideRenderSpec (통합 입력 타입)
  ├─ cover.ts          ← renderCoverV1(), renderCoverV2()
  ├─ fact.ts           ← renderFactV1(), V2(), V3(), V4()
  ├─ outro.ts          ← renderOutroV1()
  ├─ music/            ← 뮤직 전용 (album, concert, meme, grid)
  └─ index.ts          ← renderSlideHtml(templateId, spec)
```

**통합 입력 타입** (SlideRenderSpec):
```typescript
interface SlideRenderSpec {
  // 콘텐츠
  title: string;
  bodyText: string;
  footerText: string;
  heroImageDataUri?: string;
  slideIndex: number;

  // 스타일
  fontFamily?: string;        // from fontMood → cssStack
  bgGradient?: string;
  textColor?: string;
  accentColor?: string;
  titleSizePx?: number;
  bodySizePx?: number;
  titleWeight?: number;
  // ... 기존 SlideStyleOverrides 필드들

  // Agent-specific (optional)
  cssOverrideBlock?: string;  // StyleProfile에서 생성된 CSS 블록
}
```

**효과**: 템플릿 수정이 한 곳에서 이루어짐. 새 템플릿 추가 시 양쪽에 자동 반영.

---

### Phase 3: 데이터 모델 브릿지

**지금 상태**: 3개 모델이 비슷하지만 다름.

```
SlideEdit (Runs)          SlideSpec (Design)        SlidePlan (Agent)
─────────────────         ──────────────────        ──────────────
slideIndex                slideIndex                index
kind                      kind                      kind
title                     title                     payload.headline
bodyText                  bodyText                  payload.body
templateId                templateId                templateId
status (pending/confirmed)
imageDescription          heroImageDataUri
                          footerText
                          customHtml
                          styleOverrides
                                                    payload.presetId
htmlPath, pngPath
previewUrl
```

**할 일**: 변환 함수 작성 (모델 자체는 유지).

```typescript
// agents/shared/convert.ts
function slideEditToRenderSpec(edit: SlideEdit, opts?: { fontMood?, globalStyle? }): SlideRenderSpec
function slideSpecToRenderSpec(spec: SlideSpec, opts?: { fontMood?, globalStyle? }): SlideRenderSpec
function slidePlanToRenderSpec(plan: SlidePlan, topic: TopicData): SlideRenderSpec
```

**효과**: 어떤 모델에서 시작하든 같은 렌더링 파이프라인을 탐. 모델 통합 없이 호환성 확보.

---

### Phase 4: Runs에 fontMood/preset 수동 선택 UI 추가

**지금 상태**: Runs의 `SlideEditorPanel`에는 fontMood/preset 선택 UI 없음.

**할 일**:
1. `DeckEditSession`에 `fontMood?`, `presetId?` 필드 추가
2. `SlideEditorPanel`에 프리셋/폰트 무드 드롭다운 추가 (Design Editor와 동일 UI)
3. `slide-preview` API가 fontMood를 받아서 렌더링에 반영
4. Agent2 CLI `render-slide` 모드에 `--fontMood` 인자 추가

**효과**: Design Editor에서 구현한 프리셋/폰트 선택이 Runs에서도 동일하게 동작.

---

### Phase 5: 양방향 연결 (Design ↔ Runs)

**할 일**:
1. **Run → Design**: "Design Editor에서 열기" 버튼
   - `DeckEditSession` → `DesignSpec`으로 변환
   - 해당 run의 슬라이드를 Design Editor에서 자유롭게 편집

2. **Design → Run**: "Run으로 내보내기" 버튼
   - `DesignSpec` → 새 Run 생성 (deck-png + deck-finalize 스텝만)
   - 또는 기존 Run의 agent2_render 스텝에 주입

**효과**: 두 워크플로우가 자연스럽게 연결됨.

---

## 우선순위 추천

```
Phase 1 (렌더러 통합)     → 가장 빠르고 효과 큼. 지금 바로 가능.
Phase 2 (템플릿 통합)     → Phase 1 완료 후 자연스럽게 진행.
Phase 3 (모델 브릿지)     → Phase 2와 병행 가능.
Phase 4 (Runs UI)         → Phase 1-3 토대 위에 UI만 추가.
Phase 5 (양방향 연결)     → 최종 목표. Phase 1-4 완료 후.
```

Phase 1-2가 핵심 — 이것만 해도 "두 시스템이 같은 렌더링 엔진 사용"이 보장됨.
Phase 3-4는 사용자 경험 통합.
Phase 5는 워크플로우 통합.

---

## 리스크/고려사항

1. **Agent CLI 독립 실행**: Agent는 Studio 없이도 CLI로 돌아감. 공유 모듈이 Node.js 순수 모듈이어야 함 (Next.js 의존 불가).

2. **뮤직 템플릿**: Agent에만 있는 5종 뮤직 템플릿을 공유 모듈로 옮기면 Design Editor에서도 쓸 수 있게 됨. 하지만 Spotify API 연동 등 데이터 의존이 있어 UI 작업 필요.

3. **QA autofix**: Agent의 overflow 감지 → 폰트 축소 로직은 렌더링 코어가 아닌 Agent 래퍼에 유지. Design Editor에서는 사용자가 직접 조절하므로 불필요.

4. **성능**: Agent CLI는 배치(10장 순차)이고, Design Editor는 실시간(300ms 디바운스). 공유 렌더러는 두 패턴 모두 지원해야 함 → 이미 함수 형태라 문제없음.

---

## 관련 파일 참조

**Agent 렌더링 (현재)**:
- `agents/cardnews-composition/renderer/satori.ts` — Satori 렌더러
- `agents/cardnews-composition/renderer/html.ts` — HTML 템플릿 생성기
- `agents/cardnews-composition/fonts/registry.ts` — 폰트 무드 시스템
- `agents/cardnews-composition/presets.ts` — 프리셋 정의
- `agents/cardnews-composition/compose.ts` — renderSingleSlide()
- `agents/cardnews-composition/cli.ts` — CLI 엔트리포인트

**Studio 렌더링 (현재)**:
- `apps/studio/src/lib/studio/designEditor/inlineRenderer.ts` — Satori 렌더러
- `apps/studio/src/lib/studio/designEditor/templates.ts` — HTML 템플릿 생성기
- `apps/studio/src/lib/studio/designEditor/types.ts` — DesignSpec, SlideSpec 타입
- `apps/studio/src/app/api/design/render/route.ts` — 렌더 API

**Runs 파이프라인 (현재)**:
- `apps/studio/src/lib/studio/slideEditTypes.ts` — SlideEdit, DeckEditSession 타입
- `apps/studio/src/lib/studio/deckSessionStore.ts` — 세션 저장소
- `apps/studio/src/app/api/runs/[runId]/slide-preview/route.ts` — 프리뷰 API
- `apps/studio/src/app/studio/runs/[runId]/_components/SlideEditorPanel.tsx` — 편집 UI
