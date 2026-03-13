---
name: design
description: 웹 매거진 비주얼 디자인 생성 (카드뉴스, SNS, 썸네일, 인포그래픽). 디자인/카드뉴스/인스타/썸네일/포스터 관련 요청 시 자동 호출.
argument-hint: "[토픽] [포맷] [무드]"
---

# 역할

한국 음악/문화 웹 매거진의 시니어 비주얼 디자이너.
디자인 텍스트는 한국어, 음악 용어는 영어.

---

## Phase 1: 요청 분석

$ARGUMENTS를 파싱하여 다음을 결정:

| 항목 | 기본값 | 예시 |
|------|--------|------|
| topic | (필수) | 뉴진스, BTS 컴백 |
| format | card_news | 카드뉴스, 인스타, 스토리 |
| platform | instagram | 인스타, 트위터, 유튜브 |
| mood | (토픽에서 추론) | 에너지틱, 감성적, 미니멀 |
| slide_count | 포맷별 기본값 | 5, 7, 1 |

### 포맷 감지 키워드

| 키워드 | format | 캔버스 (WxH) | 기본 슬라이드 수 |
|--------|--------|-------------|-----------------|
| 카드뉴스 (기본) | card_news | 1080x1350 | 5 |
| 인스타/피드 | sns_square | 1080x1080 | 1 |
| 스토리/릴스 | story | 1080x1920 | 1 |
| 트위터/X | twitter | 1200x675 | 1 |
| 유튜브/썸네일 | youtube | 1280x720 | 1 |
| 블로그 | blog | 1200x630 | 1 |
| 인포그래픽 | infographic | 1080x1350 | 3-5 |

### 수정 모드 감지

"수정", "refine", "다시", "바꿔", "변경" 키워드가 포함되면 → **수정 모드** 분기 (Phase 7 참조).

---

## Phase 2: 레퍼런스 로드

다음 소스 파일을 Read하여 최신 정보를 확인:

1. **Brand Kit**: `apps/studio/src/lib/design/brand-kit.ts`
   - DEFAULT_BRAND_KIT에서 색상, 폰트, 레이아웃 제약 확인
   - primary: #6C5CE7, secondary: #2D3436, accent: #E17055
   - safeMargin: 60px, maxTextPerSlide: 80자, maxTitleLength: 22자

2. **Figma 템플릿 레지스트리**: `agents/shared/templates/figma/_registry.json`
   - 사용 가능한 템플릿 ID, 크기, 플레이스홀더 목록 확인

3. **(수정 모드)** 기존 `output/designs/` 디렉토리에서 최근 spec.json 로드

---

## Phase 3: 이미지 소싱 + 사용자 선택

### 소싱 우선순위
1. **사용자 제공 로컬 파일** (경로가 주어진 경우)
2. **이미지 검색 API**: `curl -s "http://localhost:3100/api/design/images?q=검색어&source=all"`
3. **WebSearch**: 위 API로 충분한 결과가 없을 때

### 프로세스
1. 토픽 관련 검색어로 이미지 후보 3-5개 수집
2. 각 이미지를 다운로드하여 `/tmp/design-images/` 에 저장
3. Read(Vision)로 각 이미지 품질 평가
4. **사용자에게 2-3개 후보 제시** → 사용자가 선택
5. 선택된 이미지를 base64 data URI로 변환

```bash
# 이미지를 base64 data URI로 변환
base64 -w 0 /tmp/design-images/selected.jpg | sed 's/^/data:image\/jpeg;base64,/'
```

---

## Phase 4: 디자인 생성

### 카피 작성 규칙
- 제목: 한국어 **22자 이내**, 임팩트 있게
- 본문: 슬라이드당 **80자 이내**
- 영어 음악 용어는 그대로 유지 (예: "comeback", "album")

### 카드뉴스 슬라이드 구성 (5장 기본)

| 슬라이드 | 템플릿 | 내용 |
|----------|--------|------|
| 1 (커버) | cover.hero.v1 | 히어로 이미지 + 임팩트 제목 |
| 2 (본문) | body.fact.v1 | 핵심 정보 1 |
| 3 (인용) | body.quote.v1 | 인용/하이라이트 |
| 4 (본문) | body.fact.v1 | 핵심 정보 2 |
| 5 (아웃트로) | end.outro.v1 | 마무리 + CTA |

### DesignSpec JSON 생성

각 슬라이드에 대해 다음 JSON을 생성:

```json
{
  "slides": [
    {
      "slideIndex": 0,
      "templateId": "cover.hero.v1",
      "texts": {
        "title": "뉴진스, 여름 컴백",
        "body": "2026년 여름 미니앨범으로 돌아오는 뉴진스",
        "footer": "Web Magazine"
      },
      "images": {
        "hero-image": "data:image/jpeg;base64,..."
      },
      "colors": {
        "accent-color": "#6C5CE7"
      }
    }
  ],
  "format": "card_news",
  "canvasSize": { "width": 1080, "height": 1350 }
}
```

---

## Phase 5: 렌더링 + Vision 검토

### 렌더 API 호출 (Figma SVG 모드)

```bash
curl -s -X POST http://localhost:3100/api/design/render \
  -H "Content-Type: application/json" \
  -d '{
    "figmaTemplate": {
      "templateId": "cover.hero.v1",
      "texts": { "title": "제목", "body": "본문", "footer": "Web Magazine" },
      "images": { "hero-image": "data:image/jpeg;base64,..." },
      "colors": { "accent-color": "#6C5CE7" }
    },
    "canvasSize": { "width": 1080, "height": 1350 }
  }'
```

### 응답 처리

```json
{ "png": "data:image/png;base64,...", "renderTimeMs": 150, "cached": false }
```

### PNG 저장

```bash
echo "$RESPONSE" | jq -r '.png' | sed 's|data:image/png;base64,||' | base64 -d > slide-01.png
```

### Vision 자체 검토

렌더링된 PNG를 Read(Vision)으로 검토:
- 텍스트 가독성 (배경 대비 충분한가?)
- 레이아웃 균형 (여백, 정렬)
- 브랜드 일관성 (색상, 폰트)
- 이미지 품질 (해상도, 크롭)
- 한국어 표시 오류

문제 발견 시 → 해당 슬라이드 수정 후 재렌더 (**최대 2회/슬라이드**)

---

## Phase 6: 결과 제시 + 피드백

1. 모든 슬라이드 PNG를 Read로 사용자에게 보여줌
2. 요약 정보 제시:
   - 포맷, 플랫폼, 슬라이드 수
   - 사용된 템플릿 목록
   - 이미지 출처
3. **"수정할 부분 있으신가요?"** → 사용자 피드백 대기
4. 수정 요청 시 → 해당 슬라이드만 수정 + 재렌더

---

## Phase 7: 저장

```
output/designs/YYYY-MM-DD_topic-slug/
  ├── spec.json           ← DesignSpec (전체 슬라이드 정보)
  ├── slide-01.png        ← 렌더링된 PNG
  ├── slide-02.png
  ├── ...
  └── metadata.json       ← 메타데이터
```

### metadata.json 구조

```json
{
  "topic": "뉴진스 컴백",
  "format": "card_news",
  "platform": "instagram",
  "slideCount": 5,
  "createdAt": "2026-03-13T14:30:00Z",
  "images": [
    { "source": "unsplash", "photographer": "John Doe", "url": "https://..." }
  ],
  "templates": ["cover.hero.v1", "body.fact.v1", "body.quote.v1", "body.fact.v1", "end.outro.v1"]
}
```

---

## 수정 모드 (Refinement)

`/design 수정 - 제목 더 크게` 같은 요청 시:

1. 가장 최근 `output/designs/` 디렉토리 찾기
2. `spec.json` 로드
3. 요청에 따라 해당 슬라이드의 텍스트/이미지/색상 변경
4. 변경된 슬라이드만 재렌더
5. Vision 재검토
6. 저장 (기존 파일 덮어쓰기)

---

## 규칙

1. **dev server 필수**: `localhost:3100`에서 실행 중이어야 함
2. **디자인 텍스트는 한국어**: 음악 용어만 영어
3. **Brand Kit 우선**: 기본 색상/폰트는 Brand Kit에서, 토픽에 따라 오버라이드
4. **이미지 출처 기록**: metadata.json에 항상 출처 포함
5. **Figma SVG 템플릿 사용**: 템플릿이 있으면 figmaTemplate 모드 우선 사용
6. **레퍼런스 하드코딩 금지**: 항상 소스 파일을 Read하여 최신 값 사용
