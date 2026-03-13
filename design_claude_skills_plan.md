# /design Claude Code Skill 구현 계획

## 진행 상황 (2026-03-13)

**현재 단계**: 계획 완료 → SKILL.md 작성 직전
**다음 할 일**: 아래 "구현 순서"의 Step 1부터 시작

### 완료된 것
- [x] 디자인 시스템 이중 전략 결정 (Track 1: SaaS UI / Track 2: Claude Skill)
- [x] 기존 인프라 탐색 완료 (렌더 API, 23개 템플릿, Layer Compositor, Brand Kit, 이미지 소싱)
- [x] 스킬 목표/구조/워크플로 설계 완료
- [x] Claude Code Skills 작동 방식 조사 완료

### 아직 안 한 것
- [ ] `.claude/skills/design/SKILL.md` 파일 작성 (핵심 작업)
- [ ] `output/designs/`를 `.gitignore`에 추가
- [ ] E2E 테스트
- [ ] 수정 모드 테스트

### 참고: 현재 .claude/ 디렉토리 상태
```
.claude/
  plans/             ← 플랜 모드용 (자동 생성)
  settings.local.json
  (skills/ 디렉토리 아직 없음 — 생성 필요)
```

### 참고: Track 1 (Studio UI)은 별도 창에서 진행 중
두 트랙은 독립적으로 진행 가능. 공유 인프라만 동일.

---

## Context

Studio를 SaaS로 출시할 때 고객은 Studio UI(Track 1)를 사용하고, 개발자(본인)는 Claude Code `/design` 스킬(Track 2)로 디자인을 직접 생성한다. 두 트랙은 공유 인프라(렌더 API, 템플릿, Layer 시스템, Brand Kit)를 함께 사용한다.

## 스킬 목표 정의

**핵심 목표**: 전체 자동화 디자인 생성 — 단, 사용자 개입 지점 2곳:
1. **이미지 선택**: 후보 이미지를 보여주고 사용자가 선택
2. **결과 피드백**: 완성 후 수정 요청 시 즉시 반영

**지원 범위**:
- 모든 포맷 동등 지원 (카드뉴스, SNS, 썸네일, 블로그 커버)
- 이미지 소싱: API(Spotify+Unsplash) + 웹 검색(WebSearch) + 로컬 파일 경로

## 스킬 파일 구조

```
.claude/skills/design/
  SKILL.md              ← 메인 스킬 (워크플로 + 지시사항)
```

단일 파일. API 스펙/템플릿 정보는 프롬프트에 포함하지 않고,
실행 시 소스 파일을 직접 Read하도록 지시 → 항상 최신 상태 반영, 프롬프트 경량화.

## SKILL.md 구조 (섹션별)

```markdown
---
name: design
description: 웹 매거진 비주얼 디자인 생성 (카드뉴스, SNS, 썸네일 등)
argument-hint: "[토픽] [포맷]"
---

# 역할 정의
  - 한국 음악/문화 웹 매거진의 비주얼 디자이너
  - 한국어 카피, 영어 음악 용어

## Phase 1: 요청 분석
  - $ARGUMENTS 파싱 → topic, format, platform, mood, slide_count
  - "수정/refine/다시" → 수정 모드 분기
  - 포맷 감지 키워드 테이블
  - 캔버스 사이즈 매핑 테이블
  - 해석 결과를 사용자에게 확인 (모호할 때만)

## Phase 2: 레퍼런스 로드
  - Read: brand-kit.ts → 색상, 폰트, 레이아웃 제약
  - Read: templates/index.ts → 템플릿 ID, kind 매핑
  - (필요 시) Read: 기존 spec.json (수정 모드)

## Phase 3: 이미지 소싱 + 선택
  - 소싱 우선순위: 로컬 파일 > Spotify > Unsplash > 웹 검색
  - curl로 API 호출 / WebSearch로 웹 검색
  - 후보 이미지 다운로드 → /tmp/design-images/
  - Read(Vision)으로 각 이미지 평가
  - ⭐ 사용자 선택 지점: 후보 2-3장 제시 → 사용자가 선택
  - base64 data URI 변환

## Phase 4: 디자인 생성
  - 한국어 카피 작성 (제목 ≤22자, 본문 ≤80자/슬라이드)
  - 템플릿 선택 + styleOverrides 결정
  - DesignSpec JSON 생성 → Write로 저장
  - 렌더 모드 판단:
    - 기본: Template 모드 (안정적)
    - 콜라주/멀티이미지: Layer 모드

## Phase 5: 렌더링 + 자체 검토
  - curl POST localhost:3000/api/design/render
  - PNG 저장 → Read(Vision)으로 검토
  - 검토 기준: 가독성, 레이아웃, 브랜드, 이미지 품질, 한국어
  - 문제 시 자동 수정 → 재렌더 (최대 2회/슬라이드)

## Phase 6: 결과 제시 + 피드백
  - 전체 슬라이드 PNG를 Read로 사용자에게 보여줌
  - 요약: 포맷, 플랫폼, 슬라이드 수, 사용 템플릿
  - ⭐ 사용자 피드백 지점: "수정할 부분 있으신가요?"
  - 수정 요청 → 해당 슬라이드만 수정+재렌더

## Phase 7: 저장
  - output/designs/YYYY-MM-DD_topic-slug/
    ├─ spec.json
    ├─ slide-01.png ~ slide-0N.png
    └─ metadata.json (topic, format, platform, images 출처)

## 수정 모드 (Refinement)
  - 기존 output/designs/ 에서 spec.json 로드
  - 변경 사항 적용 → 해당 슬라이드만 재렌더
  - Vision 재검토 → 저장

## 렌더 API 레퍼런스 (간략)
  - Template 모드 curl 예시
  - Layer 모드 curl 예시
  - 응답: { png, renderTimeMs, cached }
  - base64 PNG 저장 bash 명령

## 규칙
  - dev server 필수 (localhost:3000)
  - 디자인 텍스트는 한국어
  - Brand Kit 기본값 우선, 토픽에 따라 오버라이드
  - 이미지 출처 항상 기록
```

## 핵심 설계 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| 레퍼런스 로딩 | 소스파일 직접 Read | 프롬프트 경량화 + 항상 최신 반영 |
| 사용자 개입 | 이미지 선택 + 결과 피드백 2곳 | 전체 자동화 유지하면서 품질 제어 |
| 렌더 모드 기본값 | Template 모드 | 빠르고 안정적 |
| Layer 모드 전환 | 자동 판단 (멀티이미지/콜라주 시) | 사용자가 모드를 몰라도 됨 |
| Vision 검토 | 최대 2회/슬라이드 | 무한 루프 방지 |
| 이미지 소싱 | 로컬 > API > 웹 | 가장 확실한 소스 우선 |

## 포맷/플랫폼 매핑

| 키워드 | 포맷 | 캔버스 | 기본 슬라이드 수 |
|--------|------|--------|-----------------|
| 카드뉴스 (기본) | card_news | 1080×1350 | 5 (커버+바디3+아웃트로) |
| 인스타 | sns_single | 1080×1080 | 1 |
| 스토리 | story | 1080×1920 | 1 |
| 트위터/X | twitter | 1200×675 | 1 |
| 유튜브 썸네일 | youtube | 1280×720 | 1 |
| 블로그 | blog | 1200×630 | 1 |
| 인포그래픽 | infographic | 1080×1350 | 3-5 |

## 활용하는 기존 인프라

| 인프라 | 파일 | 용도 |
|--------|------|------|
| Render API | `apps/studio/src/app/api/design/render/route.ts` | 3가지 모드 렌더링 |
| 23개 템플릿 | `agents/shared/templates/index.ts` | 슬라이드 레이아웃 |
| Layer Compositor | `agents/shared/layerCompositor.ts` | 멀티레이어 합성 |
| Brand Kit | `apps/studio/src/lib/design/brand-kit.ts` | 브랜드 기본값 |
| Image Source | `apps/studio/src/lib/pipeline/image-source.ts` | API 엔드포인트 참조 |

## 구현 순서 (내일 이어서 할 것)

### Step 1: 스킬 디렉토리 + SKILL.md 생성
```bash
mkdir -p .claude/skills/design
```
- `.claude/skills/design/SKILL.md` 작성
- 위 "SKILL.md 구조 (섹션별)" 내용을 실제 프롬프트로 구체화
- 포맷 감지 키워드 테이블, 캔버스 사이즈 매핑, 렌더 API curl 예시 포함
- 단, 템플릿 목록/Brand Kit 값은 하드코딩하지 말고 Read 지시로 대체

### Step 2: .gitignore에 output/designs/ 추가
```
# Design skill outputs
output/designs/
```

### Step 3: E2E 테스트
- dev server 실행 필요: `cd apps/studio && npm run dev`
- 테스트 명령: `/design 뉴진스 카드뉴스`
- 확인: output/designs/ 에 spec.json + PNG 5장 생성되는지

### Step 4: 수정 모드 테스트
- `/design 수정 - 제목 더 크게`
- 기존 spec.json 로드 → 부분 수정 → 재렌더 확인

### Step 5: 필요 시 보조 파일 분리
- SKILL.md가 500줄 초과 시 reference.md로 API 스펙 분리 고려

## 검증 방법

1. dev server 실행 (`npm run dev` in apps/studio/)
2. `/design 테스트 카드뉴스` → 5장 PNG + spec.json 생성 확인
3. PNG 확인 — 텍스트 가독성, 브랜드 일관성
4. `/design 수정 - 배경 더 어둡게` → 기존 spec 로드 + 부분 수정 확인

## 렌더 API 상세 (SKILL.md 작성 시 참조)

### Template 모드 (기본)
```bash
curl -s -X POST http://localhost:3000/api/design/render \
  -H "Content-Type: application/json" \
  -d '{
    "slide": {
      "slideIndex": 0, "kind": "cover", "templateId": "cover.hero.v1",
      "title": "제목", "bodyText": "본문", "footerText": "Web Magazine",
      "heroImageDataUri": "data:image/jpeg;base64,...",
      "styleOverrides": { "bgGradient": "...", "textColor": "#fff" }
    },
    "globalStyle": { "accentColor": "#6C5CE7" },
    "fontMood": "bold-display",
    "canvasSize": { "width": 1080, "height": 1350 }
  }'
```

### Layer 모드 (콜라주/멀티이미지)
```bash
curl -s -X POST http://localhost:3000/api/design/render \
  -H "Content-Type: application/json" \
  -d '{
    "layers": [
      { "id": "bg", "kind": "shape", "shapeType": "rect", "fill": "#1A1A2E",
        "x": 0, "y": 0, "width": 1080, "height": 1080,
        "zIndex": 0, "rotation": 0, "scale": 1, "opacity": 1,
        "blendMode": "normal", "visible": true, "locked": false,
        "strokeWidth": 0, "borderRadius": 0 },
      { "id": "img1", "kind": "image", "src": "data:image/jpeg;base64,...",
        "x": 60, "y": 60, "width": 960, "height": 600,
        "objectFit": "cover", "borderRadius": 16,
        "zIndex": 1, "rotation": 0, "scale": 1, "opacity": 1,
        "blendMode": "normal", "visible": true, "locked": false },
      { "id": "title", "kind": "text", "text": "제목 텍스트",
        "fontSize": 52, "fontWeight": 800, "color": "#FFFFFF",
        "textAlign": "left", "lineHeight": 1.3, "letterSpacing": -1,
        "x": 60, "y": 700, "width": 960, "height": 200,
        "zIndex": 2, "rotation": 0, "scale": 1, "opacity": 1,
        "blendMode": "normal", "visible": true, "locked": false }
    ],
    "background": "#1A1A2E",
    "fontMood": "bold-display",
    "canvasSize": { "width": 1080, "height": 1080 }
  }'
```

### 응답 형식
```json
{ "png": "data:image/png;base64,...", "renderTimeMs": 150, "cached": false }
```

### PNG 저장 명령
```bash
echo "$RESPONSE" | jq -r '.png' | sed 's|data:image/png;base64,||' | base64 -d > slide-01.png
```

---

# Claude Code Skills 가이드

## Skills란?

Claude Code의 커스텀 슬래시 명령어. 마크다운 파일 하나로 Claude의 행동을 정의하고, `/명령어`로 실행한다.

## 스킬 파일 위치

| 범위 | 경로 | 적용 대상 |
|------|------|----------|
| **프로젝트** | `.claude/skills/<name>/SKILL.md` | 이 프로젝트만 |
| **개인** | `~/.claude/skills/<name>/SKILL.md` | 모든 프로젝트 |
| **레거시** | `.claude/commands/<name>.md` | 호환됨 (skills 권장) |

## 스킬 만들기

### 최소 구조

```
.claude/skills/my-skill/
  SKILL.md
```

### SKILL.md 형식

```yaml
---
name: my-skill
description: 이 스킬이 하는 일 설명
argument-hint: "[인자1] [인자2]"
---

여기에 Claude가 따를 지시사항을 마크다운으로 작성.
$ARGUMENTS로 사용자 입력을 참조.
```

### Frontmatter 옵션 (모두 선택사항)

```yaml
---
name: skill-name                        # 슬래시 명령 이름 (기본: 디렉토리명)
description: 설명                        # 자동 호출 판단에 사용
argument-hint: "[issue-number]"          # 자동완성에 표시
disable-model-invocation: true           # Claude가 자동 호출 못함 (수동만)
user-invocable: false                    # 사용자가 직접 호출 못함 (Claude 자동만)
allowed-tools: Read, Grep, Bash(*)       # 허용 도구 제한
model: claude-opus                       # 특정 모델 지정
context: fork                            # 서브에이전트에서 실행
agent: Explore                           # 서브에이전트 타입 (fork 시)
---
```

### 인자 (Arguments) 사용법

| 변수 | 설명 | 예시 |
|------|------|------|
| `$ARGUMENTS` | 전체 인자 문자열 | `/fix 버그 수정` → `"버그 수정"` |
| `$0`, `$1`, `$2` | 인덱스별 인자 | `/migrate A B` → `$0="A"`, `$1="B"` |
| `$ARGUMENTS[N]` | 위와 동일 (정식 표기) | |
| `${CLAUDE_SKILL_DIR}` | 스킬 디렉토리 경로 | 보조 파일 참조 시 |
| `${CLAUDE_SESSION_ID}` | 현재 세션 ID | 로그 파일 등 |

### 동적 컨텍스트 주입

`` !`command` ``로 셸 명령 결과를 프롬프트에 삽입 (전처리):

```markdown
---
name: pr-summary
---

## PR 변경사항
!`gh pr diff`

이 PR을 요약해주세요.
```

실행 시 `gh pr diff` 결과가 먼저 실행되어 프롬프트에 삽입됨.

### 보조 파일 사용

복잡한 스킬은 여러 파일로 분리:

```
my-skill/
├── SKILL.md              # 메인 (500줄 이내 권장)
├── reference.md          # 상세 API 문서
├── examples.md           # 사용 예시
└── scripts/
    └── validate.sh       # 헬퍼 스크립트
```

SKILL.md에서 참조:
```markdown
상세 API 문서는 [reference.md](reference.md)를 Read하세요.
```

## 스킬 사용하기

### 직접 호출

```
/skill-name                    # 인자 없이
/skill-name 인자1 인자2         # 인자와 함께
```

`/` 입력 시 자동완성 메뉴에 등록된 스킬 표시.

### 자동 호출

`description`이 사용자 메시지와 매치되면 Claude가 자동으로 스킬 실행.
`disable-model-invocation: true`로 방지 가능.

### 호출 제어 요약

| 설정 | 사용자 호출 | Claude 자동 호출 | 용도 |
|------|-----------|-----------------|------|
| (기본) | O | O | 범용 유틸리티 |
| `disable-model-invocation: true` | O | X | 배포, 커밋 등 수동 제어 |
| `user-invocable: false` | X | O | 백그라운드 지식 |

## 고급 패턴

### 서브에이전트에서 실행

```yaml
---
name: deep-research
context: fork
agent: Explore
---
```

메인 컨텍스트 오염 없이 격리 실행. agent 타입: `Explore`, `Plan`, `general-purpose`.

### 도구 제한

```yaml
---
allowed-tools: Read, Grep, Glob
---
```

읽기 전용 스킬 등에 유용.

### 확장 사고 활성화

프롬프트 내 `ultrathink` 포함 시 extended thinking 활성화.

## 팁 & 베스트 프랙티스

1. **SKILL.md는 500줄 이내** — 상세 내용은 보조 파일로 분리
2. **description은 구체적으로** — 자동 호출 정확도에 영향
3. **단계별 지시** — 번호 매긴 리스트가 Claude에 효과적
4. **`` !`command` `` 활용** — 실시간 데이터(git diff, API 상태 등)를 프롬프트에 주입
5. **테스트**: `/skill-name`으로 직접 호출하여 확인
6. **공유**: `.claude/skills/`를 git에 커밋하면 팀 전체 사용 가능
