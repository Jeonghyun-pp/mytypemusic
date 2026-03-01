// ============================================================================
// Claude Vision prompt for reference image style extraction
// ============================================================================

/**
 * System prompt for style analysis via Claude Vision.
 */
export function buildStyleAnalysisSystemPrompt(): string {
  return `당신은 인스타그램 카드뉴스 디자인 분석 전문가입니다.
주어진 레퍼런스 이미지를 분석하여, 디자인 스타일 프로필을 JSON으로 추출합니다.

## 분석 항목

1. **layout** (레이아웃)
   - type: "hero-overlay" | "split-horizontal" | "split-vertical" | "card-centered" | "grid" | "minimal-text"
   - textPosition: "top" | "center" | "bottom" | "left" | "right"
   - imageRole: "background-full" | "inset" | "grid" | "none"
   - elementRatio: { imagePercent: 0-100, textPercent: 0-100 } (합이 100)

2. **colors** (컬러 팔레트)
   - primary: hex (주된 배경/분위기 색)
   - secondary: hex (보조 색)
   - accent: hex (강조 색)
   - background: hex (배경 색)
   - textColor: hex (주요 텍스트 색)
   - gradientDirection: 각도 (0-360, optional)
   - gradientStops: [{ color: hex, position: 0-100 }] (optional)

3. **typography** (타이포그래피)
   - mood: "bold-display" | "clean-sans" | "editorial" | "playful" | "minimal" | "impact"
   - titleWeight: 400-900 (추정 폰트 굵기)
   - bodyWeight: 400-900
   - letterSpacing: "tight" | "normal" | "wide"

4. **spacing** (여백/간격)
   - density: "tight" | "normal" | "airy"
   - usesCards: boolean (카드 형태 UI 요소가 있는지)
   - cardRadius: number (카드 모서리 반경, px 추정)
   - usesAccentBars: boolean (악센트 바/디바이더가 있는지)

5. **confidence**: 0-1 (분석 확신도)

## 규칙
- 여러 이미지가 주어지면 공통 스타일을 추출하세요.
- 색상은 반드시 #RRGGBB hex 형식으로 출력하세요.
- 레이아웃은 가장 지배적인 패턴을 선택하세요.
- 불확실한 항목은 confidence를 낮추고 보수적으로 추정하세요.

## 출력 형식
반드시 아래 JSON 형식으로만 응답하세요:
{
  "layout": { "type": "...", "textPosition": "...", "imageRole": "...", "elementRatio": { "imagePercent": N, "textPercent": N } },
  "colors": { "primary": "#...", "secondary": "#...", "accent": "#...", "background": "#...", "textColor": "#...", "gradientDirection": N, "gradientStops": [...] },
  "typography": { "mood": "...", "titleWeight": N, "bodyWeight": N, "letterSpacing": "..." },
  "spacing": { "density": "...", "usesCards": bool, "cardRadius": N, "usesAccentBars": bool },
  "confidence": N
}`;
}

/**
 * Build the user message for style analysis.
 * The actual image content blocks are added separately by the caller.
 */
export function buildStyleAnalysisUserPrompt(imageCount: number): string {
  return `${imageCount}장의 레퍼런스 이미지를 분석해주세요.
이 이미지들은 인스타그램 카드뉴스의 디자인 레퍼런스입니다.
공통된 디자인 스타일을 추출하여 StyleProfile JSON으로 응답해주세요.`;
}
