import type { TopicCategory } from "../types.js";
import type { SlideKind } from "./schema.js";
import type { WebResearchSlide } from "./index.js";

// ============================================================================
// Prompt templates for LLM slide plan generation
// ============================================================================

/**
 * System prompt — sets the role and output format.
 */
export function buildSystemPrompt(): string {
  return `당신은 한국어 인스타그램 카드뉴스 전문 에디터입니다.
주어진 토픽과 키팩트를 바탕으로, 지정된 장수의 슬라이드 플랜을 생성합니다.

## 규칙

1. **정확한 장수**: 사용자가 요청한 slideCount와 정확히 같은 수의 슬라이드를 생성하세요.
2. **슬라이드 구조**:
   - 첫 번째 슬라이드는 반드시 kind="cover" (표지)
   - 마지막 슬라이드는 반드시 kind="cta" (콜투액션)
   - 중간 슬라이드는 kind="fact" 또는 kind="summary"
   - summary는 여러 팩트를 종합할 때 사용 (선택적)
3. **제목 (title)**: 각 슬라이드별 20자 내외의 임팩트 있는 한 줄
4. **본문 (bodyText)**: 60-120자 내외. 인스타그램 가독성에 맞춰 간결하게
5. **이미지 설명 (imageDescription)**: 해당 슬라이드에 어울리는 이미지를 설명 (검색 키워드용)
6. **레이아웃 제안 (layoutSuggestion)**: 다음 중 선택
   - "hero-overlay": 전면 이미지 + 텍스트 오버레이 (커버에 적합)
   - "text-center": 중앙 정렬 텍스트 (팩트에 적합)
   - "text-left": 좌측 정렬 텍스트
   - "split-horizontal": 상하 분할
   - "split-vertical": 좌우 분할
   - "card-centered": 카드 스타일
   - "minimal-text": 최소 텍스트
7. **서사 흐름 (overallNarrative)**: 전체 슬라이드의 스토리 라인을 1-2문장으로
8. **해시태그**: 5-10개, 한국 인스타그램에 적합한 태그
9. **캡션 초안 (captionDraft)**: 게시물 캡션 (200자 내외)

## 카테고리별 톤 가이드
- music: 감성적, 팬 친화적, 앨범/아티스트 중심
- lifestyle: 실용적, 공감형, 일상 밀착
- celebrity: 흥미 유발, 팬덤 관점
- fashion: 트렌디, 비주얼 중심
- issue: 정보 전달, 객관적, 핵심 위주

## 출력 형식
반드시 아래 JSON 형식으로만 응답하세요:
{
  "topicId": "string",
  "totalSlides": number,
  "overallNarrative": "string",
  "slides": [
    {
      "slideIndex": number,
      "kind": "cover" | "fact" | "summary" | "cta",
      "title": "string",
      "bodyText": "string",
      "imageDescription": "string",
      "layoutSuggestion": "hero-overlay" | "text-center" | ...,
      "templateHint": "string (optional)"
    }
  ],
  "hashtags": ["string"],
  "captionDraft": "string"
}`;
}

/**
 * Build the user message with topic data and slide count.
 */
export function buildUserPrompt(params: {
  topicId: string;
  title: string;
  category: TopicCategory | string;
  slideCount: number;
  keyFacts?: string[];
  angleCandidates?: string[];
  postType?: string;
  slideKeywords?: string[][];
  webResearchFacts?: WebResearchSlide[];
  recentTopics?: string[];
}): string {
  const { topicId, title, category, slideCount, keyFacts, angleCandidates, postType, slideKeywords, webResearchFacts, recentTopics } = params;

  const lines: string[] = [
    `## 토픽 정보`,
    `- topicId: ${topicId}`,
    `- 제목: ${title}`,
    `- 카테고리: ${category}`,
    `- 요청 슬라이드 수: ${slideCount}장`,
  ];

  if (postType) {
    lines.push(`- 포스트 타입: ${postType}`);
  }

  if (keyFacts && keyFacts.length > 0) {
    lines.push(``, `## 핵심 사실 (keyFacts)`);
    for (const fact of keyFacts) {
      lines.push(`- ${fact}`);
    }
  }

  if (angleCandidates && angleCandidates.length > 0) {
    lines.push(``, `## 앵글 후보`);
    for (const angle of angleCandidates) {
      lines.push(`- ${angle}`);
    }
  }

  if (slideKeywords && slideKeywords.length > 0) {
    lines.push(``, `## 슬라이드별 키워드`, `각 슬라이드의 title과 bodyText는 아래 키워드를 반드시 반영하세요:`);
    for (let i = 0; i < slideKeywords.length; i++) {
      const kw = slideKeywords[i];
      if (kw && kw.length > 0) {
        lines.push(`- 슬라이드 ${i + 1}: ${kw.join(", ")}`);
      }
    }
  }

  if (webResearchFacts && webResearchFacts.length > 0) {
    const hasAnyFacts = webResearchFacts.some((s) => s.facts.length > 0);
    if (hasAnyFacts) {
      lines.push(
        ``,
        `## 웹 검색 사실 (최신 정보)`,
        `각 슬라이드의 title과 bodyText에 아래 검색된 사실을 반영하세요.`,
        `구체적인 수치, 날짜, 이름을 포함하세요.`,
      );
      for (const slide of webResearchFacts) {
        if (slide.facts.length === 0) continue;
        const kwLabel = slide.keywords.length > 0 ? ` (키워드: ${slide.keywords.join(", ")})` : "";
        lines.push(``, `### 슬라이드 ${slide.slideIndex}${kwLabel}`);
        for (const fact of slide.facts) {
          const sourceLabel = fact.source === "news" ? "뉴스" : fact.source === "blog" ? "블로그" : "백과";
          const dateStr = fact.date ? ` (${fact.date})` : "";
          lines.push(`- [${sourceLabel}] ${fact.title}${dateStr}`);
          if (fact.description) {
            lines.push(`  ${fact.description.slice(0, 150)}`);
          }
        }
      }
    }
  }

  if (recentTopics && recentTopics.length > 0) {
    lines.push(``, `## 최근 콘텐츠 (중복 방지)`, `최근 1주일간 아래 토픽이 다뤄졌습니다. 서사/제목/구성이 겹치지 않도록 차별화하세요:`);
    for (const topic of recentTopics.slice(0, 10)) {
      lines.push(`- ${topic}`);
    }
  }

  lines.push(
    ``,
    `위 정보를 바탕으로 정확히 ${slideCount}장의 인스타그램 카드뉴스 슬라이드 플랜을 생성해주세요.`,
    `첫 슬라이드는 cover, 마지막 슬라이드는 cta여야 합니다.`,
  );

  if (slideKeywords && slideKeywords.length > 0) {
    lines.push(`각 슬라이드의 제목과 본문은 해당 슬라이드의 키워드를 기반으로 작성하세요.`);
  }

  return lines.join("\n");
}

/**
 * Map LLM slide kind to the deterministic planner's template family.
 */
export function mapKindToTemplateFamily(kind: SlideKind): "cover" | "fact" | "outro" {
  switch (kind) {
    case "cover": return "cover";
    case "fact":
    case "summary": return "fact";
    case "cta": return "outro";
  }
}
