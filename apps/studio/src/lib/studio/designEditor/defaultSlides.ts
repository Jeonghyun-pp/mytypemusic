import type { DesignSpec, SlideSpec } from "./types";

const DEFAULT_SLIDES: SlideSpec[] = [
  {
    slideIndex: 0,
    kind: "cover",
    templateId: "cover.hero.v1",
    title: "여기에 제목을 입력하세요",
    bodyText: "부제목 또는 소개 문구를 적어주세요",
    footerText: "@your_magazine",
  },
  {
    slideIndex: 1,
    kind: "fact",
    templateId: "body.fact.v1",
    title: "POINT 01",
    bodyText: "첫 번째 핵심 내용을 여기에 작성하세요. 독자의 관심을 끄는 팩트를 담아보세요.",
    footerText: "@your_magazine",
  },
  {
    slideIndex: 2,
    kind: "fact",
    templateId: "body.fact.v2",
    title: "POINT 02",
    bodyText: "두 번째 핵심 내용입니다. 구체적인 수치나 사례를 포함하면 더 효과적입니다.",
    footerText: "@your_magazine",
  },
  {
    slideIndex: 3,
    kind: "fact",
    templateId: "body.fact.v3",
    title: "POINT 03",
    bodyText: "세 번째 핵심 내용을 카드 형태로 보여줍니다. 핵심 메시지를 강조해보세요.",
    footerText: "@your_magazine",
  },
  {
    slideIndex: 4,
    kind: "cta",
    templateId: "end.outro.v1",
    title: "좋아요 & 저장\n다음 소식도 기대해주세요!",
    bodyText: "",
    footerText: "@your_magazine · 출처: OOO",
  },
];

export function createDefaultDesignSpec(): DesignSpec {
  return {
    slides: DEFAULT_SLIDES.map((s) => ({ ...s })),
    currentSlideIndex: 0,
    globalStyle: {
      bgGradient: "transparent",
    },
  };
}
