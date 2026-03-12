export interface PipelineStep {
  id: string;
  index: number;
  label: string;
  labelShort: string;
  route: string;
  isSetup: boolean;
  description: string;
  hint: string;
  completionCheck: "auto" | "manual";
  skippable: boolean;
  subPaths?: { id: string; label: string; route: string }[];
}

export const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "accounts",
    index: 0,
    label: "계정 연동",
    labelShort: "계정",
    route: "/studio/accounts",
    isSetup: true,
    description: "SNS 계정을 하나 이상 연결하세요",
    hint: "Step 1: SNS 계정을 연결하면 다음 단계로 자동 이동합니다",
    completionCheck: "auto",
    skippable: true,
  },
  {
    id: "persona",
    index: 1,
    label: "페르소나 설정",
    labelShort: "페르소나",
    route: "/studio/persona",
    isSetup: true,
    description: "글쓰기 톤과 스타일을 정의하세요",
    hint: "Step 2: 템플릿 선택 또는 글 분석으로 페르소나를 만드세요",
    completionCheck: "auto",
    skippable: true,
  },
  {
    id: "keywords",
    index: 2,
    label: "키워드 등록",
    labelShort: "키워드",
    route: "/studio",
    isSetup: true,
    description: "전문 분야 키워드를 등록하세요",
    hint: "Step 3: 아래 AI 제안 영역에서 니치 키워드를 등록하세요",
    completionCheck: "auto",
    skippable: true,
  },
  {
    id: "discover",
    index: 3,
    label: "주제 발견",
    labelShort: "주제",
    route: "/studio",
    description: "AI 트렌드 제안을 확인하고 주제를 선택하세요",
    hint: "Step 4: AI 제안에서 마음에 드는 주제를 선택하거나, Create Hub에서 직접 입력하세요",
    completionCheck: "manual",
    isSetup: false,
    skippable: false,
  },
  {
    id: "plan",
    index: 4,
    label: "기획",
    labelShort: "기획",
    route: "/studio/plan",
    description: "주간 콘텐츠 계획을 세우세요",
    hint: "Step 5: 기간과 빈도를 설정하고 AI 계획을 생성하세요",
    completionCheck: "manual",
    isSetup: false,
    skippable: true,
  },
  {
    id: "create",
    index: 5,
    label: "콘텐츠 제작",
    labelShort: "제작",
    route: "/studio/create",
    description: "원하는 포맷으로 콘텐츠를 만드세요",
    hint: "Step 6: 주제를 입력하고 원하는 포맷을 선택하여 제작하세요",
    completionCheck: "manual",
    isSetup: false,
    skippable: false,
    subPaths: [
      { id: "sns", label: "SNS 포스트", route: "/studio/create" },
      { id: "blog", label: "블로그", route: "/studio/blog" },
      { id: "reels", label: "릴스", route: "/studio/reels" },
      { id: "import", label: "Import", route: "/studio/import" },
    ],
  },
  {
    id: "design",
    index: 6,
    label: "디자인",
    labelShort: "디자인",
    route: "/studio/design",
    description: "카드뉴스, 커버 이미지, 비주얼 콘텐츠를 디자인하세요",
    hint: "Step 7: 디자인 에디터에서 카드뉴스를 제작하거나 비주얼 에셋을 만드세요",
    completionCheck: "manual",
    isSetup: false,
    skippable: true,
  },
  {
    id: "publish",
    index: 7,
    label: "발행",
    labelShort: "발행",
    route: "/studio/publish",
    description: "완성된 콘텐츠를 SNS에 발행하세요",
    hint: "Step 8: 계정을 선택하고 즉시 발행 또는 예약하세요",
    completionCheck: "manual",
    isSetup: false,
    skippable: false,
  },
  {
    id: "analytics",
    index: 8,
    label: "분석",
    labelShort: "분석",
    route: "/studio/analytics",
    description: "발행 성과를 확인하고 다음에 반영하세요",
    hint: "Step 9: 성과 데이터를 확인하세요. 완료하면 다음 사이클을 시작할 수 있습니다",
    completionCheck: "manual",
    isSetup: false,
    skippable: false,
  },
];
