  # 빠른 시작 가이드 (Quick Start Guide)

  전체 파이프라인을 테스트하는 방법입니다.

  ## 전체 파이프라인 실행 순서

  ### 1단계: Agent 0 - 토픽 인텔리전스 수집

  ```powershell
  # 토픽 요청 생성
  npx tsx agents/topic-intelligence/cli.ts request --prompt "아이브 컴백 소식"

  # 위 명령어 실행 후 출력된 Topic ID를 복사하세요
  # 예: topic_20250215_아이브_컴백_소식_abc123

  # Phase 1-A: RSS 수집
  npx tsx agents/topic-intelligence/cli.ts intel --topicId <TOPIC_ID> --phase A

  # Phase 1-B: 관련성 점수 계산
  npx tsx agents/topic-intelligence/cli.ts intel --topicId <TOPIC_ID> --phase B

  # Phase 1-C: 콘텐츠 필드 생성
  npx tsx agents/topic-intelligence/cli.ts intel --topicId <TOPIC_ID> --phase C

  # Phase 1-D: 패키지 조립
  npx tsx agents/topic-intelligence/cli.ts intel --topicId <TOPIC_ID> --phase D

  # (선택) Phase 1-E: 기사 본문 캐싱
  npx tsx agents/topic-intelligence/cli.ts intel --topicId <TOPIC_ID> --phase E
  ```

  ### 2단계: Agent 3 - 콘텐츠 구조화

  ```powershell
  # ContentPlan 생성
  npx tsx agents/content-structuring/cli.ts content --topicId <TOPIC_ID>

  # Agent 2용 브리지
  npx tsx agents/content-structuring/cli.ts bridge --topicId <TOPIC_ID>
  ```

  ### 3단계: Agent 1 - 이미지 획득

  ```powershell
  npx tsx agents/safe-image-acquisition/cli.ts `
    --topic "아이브 컴백" `
    --keywords "아이브,뉴진스,케이팝" `
    --use editorial `
    --channel instagram `
    --category music `
    --out "./outputs/test-run"
  ```

  ### 4단계: Agent 2 - 카드뉴스 구성

  ```powershell
  # 사전 검사
  npx tsx agents/cardnews-composition/cli.ts `
    --mode preflight `
    --input "./outputs/test-run/validated-post.json" `
    --out "./outputs/test-run/agent2"

  # HTML 생성
  npx tsx agents/cardnews-composition/cli.ts `
    --mode html `
    --input "./outputs/test-run/validated-post.json" `
    --topic "./outputs/<TOPIC_ID>/agent2-topic.json" `
    --out "./outputs/test-run/agent2"

  # PNG 렌더링
  npx tsx agents/cardnews-composition/cli.ts `
    --mode png `
    --out "./outputs/test-run/agent2"

  # 최종화
  npx tsx agents/cardnews-composition/cli.ts `
    --mode finalize `
    --input "./outputs/test-run/validated-post.json" `
    --topic "./outputs/<TOPIC_ID>/agent2-topic.json" `
    --out "./outputs/test-run/agent2"
  ```

  ### 5단계: Agent 4 - 퍼블리시 번들

  ```powershell
  # 스캐폴드 생성
  npx tsx agents/publish-bundle/cli.ts scaffold --topicId <TOPIC_ID>

  # 번들 빌드
  npx tsx agents/publish-bundle/cli.ts build --topicId <TOPIC_ID>
  ```

  ---

  ## 간단한 테스트 (최소 파이프라인)

  빠르게 테스트하려면 다음 순서로 실행하세요:

  ```powershell
  # 1. Agent 0: 토픽 생성 및 인텔리전스 수집
  npx tsx agents/topic-intelligence/cli.ts request --prompt "아이브 컴백"
  # Topic ID 복사

  npx tsx agents/topic-intelligence/cli.ts intel --topicId <TOPIC_ID> --phase A
  npx tsx agents/topic-intelligence/cli.ts intel --topicId <TOPIC_ID> --phase B
  npx tsx agents/topic-intelligence/cli.ts intel --topicId <TOPIC_ID> --phase C
  npx tsx agents/topic-intelligence/cli.ts intel --topicId <TOPIC_ID> --phase D

  # 2. Agent 3: 콘텐츠 구조화
  npx tsx agents/content-structuring/cli.ts content --topicId <TOPIC_ID>
  npx tsx agents/content-structuring/cli.ts bridge --topicId <TOPIC_ID>

  # 3. Agent 1: 이미지 획득 (간단 버전)
  npx tsx agents/safe-image-acquisition/cli.ts `
    --topic "아이브" `
    --keywords "아이브" `
    --use editorial `
    --channel instagram `
    --category music `
    --out "./outputs/test"

  # 4. Agent 2: 카드뉴스 (한 번에)
  npx tsx agents/cardnews-composition/cli.ts `
    --mode render `
    --input "./outputs/test/validated-post.json" `
    --topic "./outputs/<TOPIC_ID>/agent2-topic.json" `
    --out "./outputs/test/agent2"
  ```

  ---

  ## 출력 파일 위치

  - **Agent 0**: `outputs/<TOPIC_ID>/`
    - `topic-request.json`
    - `topic-intel.json`
    - `agent2-topic.json` (bridge 후)

  - **Agent 3**: `outputs/<TOPIC_ID>/`
    - `content-plan.json`
    - `caption.draft.txt`
    - `agent2-topic.json` (bridge 후)

  - **Agent 1**: `outputs/<OUTPUT_DIR>/`
    - `validated-asset.json`
    - `validated-post.json`
    - `<UUID>.jpg` (이미지 파일)

  - **Agent 2**: `outputs/<OUTPUT_DIR>/agent2/`
    - `slide_01.html`, `slide_02.html`, ...
    - `slide_01.png`, `slide_02.png`, ...
    - `caption.txt`
    - `layout_manifest.json`

  - **Agent 4**: `outputs/<TOPIC_ID>/`
    - `publish-bundle.json`

  ---

  ## 문제 해결

  ### Topic ID를 모르는 경우
  `outputs/` 폴더에서 가장 최근에 생성된 폴더를 확인하세요.

  ### Agent 1이 이미지를 찾지 못하는 경우
  - 키워드를 더 구체적으로 변경해보세요
  - `--allowPeople true` 옵션을 추가해보세요

  ### Agent 2 렌더링이 실패하는 경우
  - Playwright가 설치되어 있는지 확인: `npx playwright install`
  - `validated-post.json`과 `agent2-topic.json` 경로가 올바른지 확인하세요

  ---

  ## 전체 파이프라인 한 번에 실행 (고급)

  PowerShell 스크립트를 사용하려면:
  ```powershell
  .\test-pipeline.ps1
  ```

  또는 각 단계를 수동으로 실행하세요.
