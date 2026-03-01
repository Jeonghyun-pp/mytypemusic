# 템플릿 & 폰트 시스템 가이드

## 개요

카드뉴스 컴포지션 에이전트의 **무드 기반 스타일링 시스템**. 토픽 카테고리에 따라 폰트·컬러·템플릿이 자동 결정되며, 수동 오버라이드도 가능.

```
Topic(category) → Preset(fontMood, paletteId) → Template(variation) + Font(mood) + Palette(colors)
                                                         ↓
                                                   HTML → Satori → PNG
```

---

## 1. 폰트 무드 (FontMood)

`agents/cardnews-composition/fonts/registry.ts`

| 무드 | 타이틀 폰트 | 본문 폰트 | 용도 |
|------|------------|----------|------|
| `bold-display` | Pretendard Bold/ExtraBold | Pretendard | 기본값, 범용 |
| `clean-sans` | Noto Sans KR | Noto Sans KR | 데이터·정보 중심 (데패뉴 스타일) |
| `editorial` | Noto Serif KR | Pretendard | 에디토리얼 매거진 (디에디트 스타일) |
| `minimal` | Pretendard Regular/SemiBold | Pretendard | 절제된 무드 |
| `impact` | Black Han Sans | Pretendard | 뉴스·속보 |
| `playful` | (Phase 2: Gmarket Sans) | Pretendard | → 현재 bold-display 폴백 |

### 폰트 파일 (`fonts/` 디렉토리)

```
Pretendard-Regular.otf      (1.5MB)
Pretendard-Bold.otf         (1.5MB)
Pretendard-SemiBold.otf     (1.5MB)
Pretendard-ExtraBold.otf    (1.5MB)
NotoSansKR-Regular.otf      (4.6MB)  ← 정적 OTF (variable font 사용 불가)
NotoSansKR-Bold.otf         (4.8MB)
NotoSerifKR-Regular.otf     (7.7MB)
NotoSerifKR-Bold.otf        (7.9MB)
BlackHanSans-Regular.ttf    (1.7MB)
```

### 사용법

```typescript
import { loadFontsForMood, getFontSet } from "./fonts/registry.js";

// Satori 렌더링용 폰트 로드
const fonts = await loadFontsForMood("editorial");

// CSS font-family 스택 조회 (동기)
const { cssStack, primary, body } = getFontSet("editorial");
// primary: "Noto Serif KR"
// body: "Pretendard"
// cssStack: '"Noto Serif KR", "Pretendard", serif'
```

---

## 2. 스타일 프리셋 (StylePreset)

`agents/cardnews-composition/presets.ts`

카테고리별 폰트·팔레트·템플릿 기본값을 묶은 프리셋.

| 프리셋 | 무드 | 팔레트 | 커버 | 팩트 | 매핑 카테고리 |
|--------|------|--------|------|------|-------------|
| `news` | impact | monochrome | v1 (68px) | v1 | issue, 뉴스, 정치 |
| `beauty` | editorial | editorial | v2 (52px) | v3 | celebrity, fashion, 뷰티 |
| `tech` | clean-sans | monochrome | v1 (64px) | v2 | tech, AI, product |
| `lifestyle` | editorial | warmVintage | v2 (56px) | v3 | lifestyle, 인테리어 |
| `finance` | minimal | monochrome | v1 (60px) | v1 | finance, 경제 |
| `music` | bold-display | — | v1 (56px) | v2 | music |
| `default` | bold-display | — | v1 | v1 | 나머지 전부 |

### 자동 선택

```typescript
import { pickPresetByCategory } from "./presets.js";

pickPresetByCategory("lifestyle");  // → "lifestyle"
pickPresetByCategory("celebrity");  // → "beauty"
pickPresetByCategory("unknown");    // → "default"
```

### CLI에서 수동 지정

```bash
npx tsx cli.ts --mode deck-html \
  --input validated-post.json \
  --topic topic.json \
  --out ./output \
  --style beauty          # ← 프리셋 직접 지정
```

---

## 3. 컬러 팔레트 (ColorPalette)

`agents/cardnews-composition/style-analysis/palettes.ts`

| 팔레트 | 배경 | 텍스트 | 분위기 |
|--------|------|--------|--------|
| `editorial` | `#FAFAF8` (따뜻한 오프화이트) | `#1A1A1A` | 디에디트 매거진 |
| `monochrome` | `#FFFFFF` | `#1A1A1A` | 하이콘트라스트 뉴스 |
| `warmVintage` | `#F5EDE3` (베이지) | `#3D3529` | 빈티지·라이프스타일 |

---

## 4. 템플릿 시스템

### 템플릿 파일 (`templates/` 디렉토리)

**일반 카드뉴스:**
| 파일 | 용도 | 배경 |
|------|------|------|
| `cover.hero.v1.json` | 커버 — 중앙/상단 타이틀 | 다크 (히어로 이미지 오버레이) |
| `cover.hero.v2.json` | 커버 — 좌측 하단 타이틀 | 다크 (더 강한 스크림) |
| `body.fact.v1.json` | 팩트 — 기본 | 다크 그라데이션 |
| `body.fact.v2.json` | 팩트 — 변형 2 | 다크 그라데이션 |
| `body.fact.v3.json` | 팩트 — 변형 3 | 다크 그라데이션 |
| `body.fact.v4.json` | 팩트 — **에디토리얼** | **라이트** (`#FAFAF8`) |
| `outro.cta.v1.json` | 아웃로/CTA | 다크 그라데이션 |

**뮤직 전용:**
| 파일 | 용도 |
|------|------|
| `music.album.cover.v1.json` | 앨범 커버 |
| `music.album.detail.v1.json` | 앨범 상세 |
| `music.concert.v1.json` | 콘서트 정보 |
| `music.grid.v1.json` | 그리드 레이아웃 |
| `music.meme.v1/v2.json` | 밈 카드 |

### 안전 영역 (Safe Area)

모든 템플릿 공통: `{ top: 75, right: 75, bottom: 100, left: 75 }` (px)
- bottom이 100px인 이유: 인스타그램 UI(좋아요·댓글 바) 오버랩 보호

### v4 에디토리얼 템플릿 특징

```
┌──────────────────────────────────┐
│ (75px padding)                   │
│                                  │
│  ── (divider line)               │  ← 2px, rgba(26,26,26,0.2)
│                                  │
│  headline (18px, weight 500)     │  ← 연한 레이블 스타일
│                                  │
│  body (36px, weight 600)         │  ← 다크 텍스트, lineHeight 1.5
│  본문 텍스트가 들어가는 영역      │
│                                  │
│                                  │
│  footer credits (14px)           │
│ (100px bottom padding)           │
└──────────────────────────────────┘
배경: #FAFAF8 (라이트)
```

### 변형 선택 로직

```
editorial/minimal 무드 → 무조건 v4 (라이트 에디토리얼)
그 외 무드 → seed 기반 해시로 v1/v2/v3 랜덤 로테이션
```

---

## 5. CLI 사용법

### 기본 덱 생성 (HTML → PNG)

```bash
# Step 1: HTML 생성
npx tsx cli.ts --mode deck-html \
  --input fixtures/validated-post.json \
  --topic fixtures/topic.json \
  --out ./output

# Step 2: PNG 렌더링
npx tsx cli.ts --mode deck-png \
  --out ./output

# Step 3: 캡션 + 매니페스트
npx tsx cli.ts --mode deck-finalize \
  --input fixtures/validated-post.json \
  --topic fixtures/topic.json \
  --out ./output
```

### 프리셋 지정

```bash
npx tsx cli.ts --mode deck-html \
  --input validated-post.json \
  --topic topic.json \
  --out ./output \
  --style beauty          # editorial 무드 + editorial 팔레트
```

### 슬라이드 수 지정

```bash
npx tsx cli.ts --mode deck-html \
  --input validated-post.json \
  --topic topic.json \
  --out ./output \
  --slideCount 8          # 1 커버 + 6 팩트 + 1 아웃로
```

### 레퍼런스 이미지 스타일 분석

```bash
npx tsx cli.ts --mode style-analyze \
  --images ref1.png,ref2.png,ref3.png \
  --out ./output
# → output/style-profile.json 생성
```

생성된 `style-profile.json`이 output 디렉토리에 있으면, `deck-html`이 자동으로 읽어서 CSS 오버라이드에 반영.

### 원샷 렌더 (E2E)

```bash
npx tsx cli.ts --mode render \
  --input validated-post.json \
  --topic topic.json \
  --out ./output
```

---

## 6. 무드 전파 흐름

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Topic JSON   │────▶│ Preset 선택   │────▶│ fontMood 결정  │
│ category:    │     │ pickPreset   │     │               │
│ "lifestyle"  │     │ ByCategory() │     │ "editorial"   │
└─────────────┘     └──────────────┘     └───────┬───────┘
                                                  │
                    ┌─────────────────────────────┤
                    ▼                             ▼
           ┌────────────────┐           ┌─────────────────┐
           │ story-planner  │           │ compose.ts       │
           │ v4 템플릿 선택   │           │ resolveEffective │
           │ (editorial이면)  │           │ Mood()           │
           └────────────────┘           └────────┬────────┘
                                                  │
                    ┌─────────────────────────────┤
                    ▼                             ▼
           ┌────────────────┐           ┌─────────────────┐
           │ css-mapper.ts  │           │ satori.ts        │
           │ font-family    │           │ loadFontsForMood │
           │ CSS !important │           │ ("editorial")    │
           │ 규칙 주입       │           │ → Noto Serif KR  │
           └────────────────┘           └─────────────────┘
```

### 우선순위

1. `style-profile.json`의 `typography.mood` (레퍼런스 이미지 분석 결과)
2. 프리셋의 `fontMood` (카테고리 기반 자동 선택)
3. `"bold-display"` (최종 폴백)

---

## 7. 커스텀 스타일 적용

### 방법 A: 레퍼런스 이미지 분석

```bash
# 1. 레퍼런스 이미지 → style-profile.json
npx tsx cli.ts --mode style-analyze \
  --images-dir ./references \
  --out ./output

# 2. 같은 output에서 deck-html → 자동 반영
npx tsx cli.ts --mode deck-html \
  --input validated-post.json \
  --topic topic.json \
  --out ./output
```

### 방법 B: 프리셋 직접 선택

`--style` 플래그로 7개 프리셋 중 선택:
`news` | `beauty` | `tech` | `lifestyle` | `finance` | `music` | `default`

### 방법 C: 코드에서 직접 무드 전달

```typescript
import { renderHtmlToPng } from "./renderer/satori.js";

await renderHtmlToPng("slide.html", "slide.png", "editorial");
//                                                 ^^^^^^^^^ FontMood
```

---

## 8. 주의사항

### Satori 제약
- **Variable font 사용 불가** — 반드시 정적 OTF/TTF (fvar 테이블 파싱 에러)
- `children: []` 빈 배열 금지 → `fixSatoriCompat()`이 자동 처리
- text-shadow, box-shadow, filter, object-fit 미지원 → `postProcessHtml()`이 제거
- `<div>`에 다수 자식 → `display: flex` 필수 → 자동 주입

### 폰트 추가 방법
1. `fonts/` 디렉토리에 정적 OTF/TTF 파일 추가
2. `registry.ts`의 `FONT_SETS`에 해당 무드의 `specs` 배열 수정
3. 필요시 `presets.ts`의 프리셋에 `fontMood` 매핑 추가
