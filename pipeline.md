 AoB-Style Music Instagram Magazine — 전체 시스템 운영 가이드

  0. 시스템 개요

  목적: 음악 인스타그램 매거진 콘텐츠(카드뉴스, 밈, 앨범 소개, 공연 정보 등)의 70% 자동화

  핵심 원칙: Human-in-the-Loop — 주제 선정과 창작 텍스트는 사람이, 나머지는 파이프라인이 처리

  ┌─ Studio UI (localhost:3100) ─────────────────────────────────────┐
  │  CreateRunForm → API → Pipeline Orchestrator                     │
  │     ↓                                                            │
  │  [url_fetch] → [trend_signals] → [topic_request]                │
  │     ↓                                                            │
  │  [topic_intel A→D] → [content] → [bridge]                       │
  │     ↓                                                            │
  │  [image] → (checkpoint: human_input) → [agent2_render]          │
  │     ↓                                                            │
  │  (checkpoint: human_approval) → [bundle] → SUCCESS               │
  └──────────────────────────────────────────────────────────────────┘


  ---
  1. 환경 설정

  1-1. 필수 소프트웨어

  ┌─────────────┬─────────────┬─────────────────────────────────┐
  │ 소프트웨어  │    용도     │            설치 확인            │
  ├─────────────┼─────────────┼─────────────────────────────────┤
  │ Node.js 20+ │ 런타임      │ node -v                         │
  ├─────────────┼─────────────┼─────────────────────────────────┤
  │ npm         │ 패키지 관리 │ npm -v                          │
  ├─────────────┼─────────────┼─────────────────────────────────┤
  │ Playwright  │ PNG 렌더링  │ npx playwright install chromium │
  ├─────────────┼─────────────┼─────────────────────────────────┤
  │ Git         │ 소스 관리   │ git -v                          │
  └─────────────┴─────────────┴─────────────────────────────────┘

  1-2. 의존성 설치

  cd C:\Users\pjhic\Projects\Web_magazine
  npm install
  npx playwright install chromium


  1-3. 환경 변수 (.env)

  프로젝트 루트에 .env 파일 생성:

  # ── 이미지 프로바이더 (Agent 1) ──
  UNSPLASH_ACCESS_KEY=your_key          # 무료 이미지 검색
  PEXELS_API_KEY=your_key               # 무료 이미지 검색

  # ── Spotify (앨범 커버 + 검색) ──
  SPOTIFY_CLIENT_ID=your_id             # 앨범 커버 다운로드
  SPOTIFY_CLIENT_SECRET=your_secret     # Client Credentials OAuth

  # ── LLM Rewrite (Agent 3, 선택) ──
  OPENAI_API_KEY=your_key               # GPT 슬라이드/캡션 리라이트
  ANTHROPIC_API_KEY=your_key            # Claude 리라이트

  # ── AI 이미지 생성 (Agent 1, 선택) ──
  # OPENAI_API_KEY 위와 동일                # DALL-E 이미지 생성

  # ── Trend Signals (Agent 5, 선택) ──
  YOUTUBE_API_KEY=your_key              # YouTube 트렌드 수집
  INSTAGRAM_ACCESS_TOKEN=your_token     # Instagram 해시태그 수집
  INSTAGRAM_USER_ID=your_id            # IG Business 계정 ID

  # ── Pressroom 설정 (선택) ──
  # PRESSROOM_DOMAINS=domain1.com,domain2.com
  # PRESSROOM_MAX_PAGES=5
  # PRESSROOM_TIMEOUT_MS=12000

  최소 필수: UNSPLASH_ACCESS_KEY 또는 PEXELS_API_KEY (이미지 1개 이상)
  음악 PostType 사용 시: + SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET

  ---
  2. Studio 실행

  npm run studio:dev
  # → http://localhost:3100/studio


  Studio는 Next.js 16 앱으로, 브라우저에서 모든 작업을 수행합니다.

  ---
  3. 7가지 PostType 상세

  3-1. PostType 비교표

  ┌──────────────────────┬──────────────┬──────────────┬────────┬────────────┬──────────────────────┬──────────────────┐
  │       PostType       │    한국어    │ 자동화 수준  │ 인텔   │ 사람 입력  │     이미지 전략      │    체크포인트    │
  │                      │              │              │  필요  │            │                      │                  │
  ├──────────────────────┼──────────────┼──────────────┼────────┼────────────┼──────────────────────┼──────────────────┤
  │ general_cardnews     │ 일반         │ Full Auto    │ O      │ X          │ stock                │ 없음             │
  │                      │ 카드뉴스     │              │        │            │ (Unsplash/Pexels)    │                  │
  ├──────────────────────┼──────────────┼──────────────┼────────┼────────────┼──────────────────────┼──────────────────┤
  │ album_release        │ 신보 알림    │ Full Auto    │ O      │ X          │ Spotify 앨범 커버    │ render 후 승인   │
  ├──────────────────────┼──────────────┼──────────────┼────────┼────────────┼──────────────────────┼──────────────────┤
  │ album_recommendation │ 앨범 추천    │ Semi         │ X      │ O (앨범    │ Spotify 앨범 커버    │ input → render   │
  │                      │              │              │        │ 선택)      │                      │ 후 승인          │
  ├──────────────────────┼──────────────┼──────────────┼────────┼────────────┼──────────────────────┼──────────────────┤
  │ concert_info         │ 공연 정보    │ Human-driven │ X      │ O (공연    │ Pressroom/stock      │ input → render   │
  │                      │              │              │        │ 상세)      │                      │ 후 승인          │
  ├──────────────────────┼──────────────┼──────────────┼────────┼────────────┼──────────────────────┼──────────────────┤
  │ meme                 │ 밈           │ Human-driven │ X      │ O (밈      │ Pressroom/stock      │ input → render   │
  │                      │              │              │        │ 텍스트)    │                      │ 후 승인          │
  ├──────────────────────┼──────────────┼──────────────┼────────┼────────────┼──────────────────────┼──────────────────┤
  │ artist_spotlight     │ 아티스트     │ Full Auto    │ O      │ X          │ mixed                │ render 후 승인   │
  │                      │ 소개         │              │        │            │                      │                  │
  ├──────────────────────┼──────────────┼──────────────┼────────┼────────────┼──────────────────────┼──────────────────┤
  │ curated_playlist     │ 플레이리스트 │ Semi         │ X      │ O (선곡)   │ Spotify 앨범 커버    │ input → render   │
  │                      │              │              │        │            │                      │ 후 승인          │
  └──────────────────────┴──────────────┴──────────────┴────────┴────────────┴──────────────────────┴──────────────────┘

  3-2. PostType별 파이프라인 흐름

  인텔 필요 (general_cardnews, album_release, artist_spotlight):

  url_fetch → trend_signals → topic_request
    → topic_intel A→D → content → bridge
    → image → agent2_render → (approval) → bundle → SUCCESS


  인텔 불필요 (meme, concert_info, album_recommendation, curated_playlist):

  topic_request → (SKIP intel A→D, content, bridge)
    → image → (human_input) → agent2_render → (approval) → bundle → SUCCESS


  - content/bridge 스텝은 자동 스킵 (cmds 비어있음)
  - topic.agent2.json은 파이프라인이 자동 생성 (minimal: title + category)

  3-3. PostType별 슬라이드 구성

  ┌──────────────────────┬────────────────────────────────────────────────┬─────────┐
  │       PostType       │                슬라이드 시퀀스                 │ 총 장수 │
  ├──────────────────────┼────────────────────────────────────────────────┼─────────┤
  │ album_release        │ album.cover → fact x2~3 → album.detail → outro │ 4~6     │
  ├──────────────────────┼────────────────────────────────────────────────┼─────────┤
  │ meme                 │ meme.v1 또는 v2 (단일)                         │ 1       │
  ├──────────────────────┼────────────────────────────────────────────────┼─────────┤
  │ album_recommendation │ cover → grid → fact x2~4 → outro               │ 4~7     │
  ├──────────────────────┼────────────────────────────────────────────────┼─────────┤
  │ concert_info         │ concert → fact(상세) → outro                   │ 2~3     │
  ├──────────────────────┼────────────────────────────────────────────────┼─────────┤
  │ curated_playlist     │ cover → grid → outro                           │ 3       │
  ├──────────────────────┼────────────────────────────────────────────────┼─────────┤
  │ artist_spotlight     │ album.cover → fact x3 → outro                  │ 5       │
  ├──────────────────────┼────────────────────────────────────────────────┼─────────┤
  │ general_cardnews     │ cover → fact x1~4 → outro                      │ 3~6     │
  └──────────────────────┴────────────────────────────────────────────────┴─────────┘

  ---
  4. Studio UI 사용법

  4-1. Run 생성 (CreateRunForm)

  기본 필드:
  - Post Type: 드롭다운 (7가지 중 선택)
  - Prompt: 주제 설명 (필수)
  - Source URL: 참고 기사 링크 (선택 — URL 기반 인텔 수집)

  PostType별 추가 필드:

  ┌──────────────────────┬──────────────────────────────────────────────────┐
  │       PostType       │                    추가 입력                     │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │ meme                 │ 밈 텍스트 + 텍스트 위치 (top/center/bottom)      │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │ concert_info         │ 공연장 + 일시 + 라인업                           │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │ album_recommendation │ Spotify 앨범 검색/선택 (최대 4장)                │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │ curated_playlist     │ 플레이리스트 제목 + Spotify 앨범 검색 (최대 8장) │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │ album_release        │ 프롬프트에 아티스트/앨범명 입력                  │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │ artist_spotlight     │ 프롬프트에 아티스트명 입력                       │
  └──────────────────────┴──────────────────────────────────────────────────┘

  Advanced Options (접기/펼치기):

  ┌──────────────────┬─────────────────────────────────────────┬──────────────────────────────┐
  │       옵션       │                  설명                   │            기본값            │
  ├──────────────────┼─────────────────────────────────────────┼──────────────────────────────┤
  │ Category         │ music / lifestyle                       │ auto (음악 PostType → music) │
  ├──────────────────┼─────────────────────────────────────────┼──────────────────────────────┤
  │ Recency (days)   │ 기사 검색 기간                          │ 7                            │
  ├──────────────────┼─────────────────────────────────────────┼──────────────────────────────┤
  │ Max articles     │ 수집할 최대 기사 수                     │ 5                            │
  ├──────────────────┼─────────────────────────────────────────┼──────────────────────────────┤
  │ Rewrite mode     │ off / slides / caption / all / generate │ off                          │
  ├──────────────────┼─────────────────────────────────────────┼──────────────────────────────┤
  │ Rewrite provider │ mock / openai / anthropic               │ mock                         │
  ├──────────────────┼─────────────────────────────────────────┼──────────────────────────────┤
  │ Rewrite model    │ LLM 모델명                              │ gpt-4o-mini                  │
  ├──────────────────┼─────────────────────────────────────────┼──────────────────────────────┤
  │ Image keywords   │ 이미지 검색 키워드 (커스텀)             │ auto                         │
  ├──────────────────┼─────────────────────────────────────────┼──────────────────────────────┤
  │ Allow people     │ 사람 포함 이미지 허용                   │ false                        │
  ├──────────────────┼─────────────────────────────────────────┼──────────────────────────────┤
  │ Trend signals    │ YouTube / Instagram 체크박스            │ 없음                         │
  └──────────────────┴─────────────────────────────────────────┴──────────────────────────────┘

  4-2. Run 목록 (RunsList)

  - 최근 20개 표시, 5초 간격 폴링
  - 컬럼: Created, Status, Prompt, Topic ID, Delete(✕)
  - 행 클릭 → Run Detail 페이지 이동
  - Clear All 버튼으로 전체 삭제

  4-3. Run Detail 페이지

  RunHeader: runId, status 배지, 경과 시간

  StepsTable: 14개 파이프라인 스텝 진행 상태

  url_fetch → trend_signals → topic_request
  → topic_intel_A → B → C → D
  → content → bridge → image
  → agent2_render → bundle


  각 스텝: pending / running / success / failed / skipped / awaiting_human

  CheckpointPanel (상태가 awaiting_*일 때 표시):
  - awaiting_input: PostType별 입력 폼
    - 밈: 텍스트 에디터 + 위치 선택
    - 앨범 추천/플레이리스트: Spotify 앨범 검색 + 카드 선택
    - 공연 정보: 장소/일시/라인업 입력
    - 공통: Custom Caption (선택)
  - awaiting_approval: "Approve" / "Reject" 버튼
  - 모든 체크포인트에 "Reject" 버튼 (→ run canceled)

  LogsViewer: 실시간 파이프라인 로그 (최근 400줄)

  View Results / Preview Results: 하단 링크 (terminal 또는 awaiting_approval 상태)

  폴링 주기:
  - running/queued: 2.5초 (빠른 업데이트)
  - awaiting_*: 10초 (사람 대기 중)
  - terminal: 정지

  4-4. Results 페이지

  ┌─────────────────┬───────────────────────────────────────────┐
  │    컴포넌트     │                   기능                    │
  ├─────────────────┼───────────────────────────────────────────┤
  │ SlidesGallery   │ PNG 슬라이드 그리드 뷰 (클릭 → 원본 크기) │
  ├─────────────────┼───────────────────────────────────────────┤
  │ CaptionViewer   │ 인스타그램 캡션 텍스트 (복사 버튼)        │
  ├─────────────────┼───────────────────────────────────────────┤
  │ BundleViewer    │ publish-bundle.json 내용 (JSON 뷰어)      │
  ├─────────────────┼───────────────────────────────────────────┤
  │ outputsDir 경로 │ 클릭 → 클립보드 복사 (파일 탐색기 접근용) │
  └─────────────────┴───────────────────────────────────────────┘

  ---
  5. 파이프라인 14 스텝 상세

  Step 0: url_fetch (선택)

  - 조건: sourceUrl 입력 시
  - 동작: URL → 기사 텍스트 추출 → signal-url.json
  - 실패 시: soft-fail (다음 스텝 계속)

  Step 1: trend_signals (선택)

  - 조건: YouTube / Instagram 체크박스 선택 시
  - 동작: 키워드로 소셜 미디어 검색 → signal-*.json → 병합 signal-merged.json
  - 실패 시: soft-fail

  Step 2: topic_request

  - 동작: 프롬프트 → topicId 생성 + topic-request.json
  - 출력: topicId (예: 아이브-20260217-e2038f)
  - 핵심: topicId 없으면 파이프라인 중단

  Step 3~6: topic_intel_A → D (인텔 필요 PostType만)

  - A: RSS 피드 수집 (한국 뉴스 + Google News)
  - B: 관련성 점수 + 기사 본문 추출
  - C: 핵심 사실(keyFacts) + 각도(angles) 도출
  - D: 이미지 쿼리 + 리스크 노트 + 최종 topic-intel.json
  - 비인텔 PostType: 자동 스킵

  Step 7: content

  - 동작: topic-intel → 슬라이드 구조 + 캡션 초안 (content-plan.json, caption.draft.txt)
  - Rewrite: 옵션 켜면 LLM이 슬라이드/캡션 폴리싱
  - 비인텔 PostType: 자동 스킵

  Step 8: bridge

  - 동작: content-plan → Agent 2 용 topic.agent2.json 변환
  - 비인텔 PostType: 자동 스킵 (파이프라인이 minimal topic 자동 생성)

  Step 9: image

  - 동작: 키워드 기반 이미지 검색 → 라이선스 검증 → 리스크 스코어링
  - 프로바이더 우선순위: Spotify → Pressroom → Unsplash/Pexels → AI생성
  - 리스크 스코어: 0-29 PASS / 30-59 PASS_WITH_FLAGS / 60+ FAIL(재시도)
  - 출력: validated-post.json (이미지 + 라이선스 + 저작자 표시)

  (Checkpoint: human_input — 해당 PostType만)

  - 밈: 밈 텍스트 입력
  - 앨범 추천/플레이리스트: Spotify 앨범 선택
  - 공연 정보: 상세 입력

  Step 10: agent2_render

  - 동작: 템플릿 선택 → HTML 생성 → Playwright PNG 렌더링
  - QA: 오버플로 감지 → 폰트 자동 축소 (최대 2회), 세이프 에어리어 검증
  - 출력: slide_XX.html, slide_XX.png, caption.txt, layout_manifest.json

  (Checkpoint: human_approval — 대부분의 음악 PostType)

  - 렌더 결과 미리보기 후 승인/거절

  Step 11: bundle

  - 동작: scaffold → build → publish-bundle.json
  - 포함: 슬라이드 목록, 캡션, 해시태그, 크레딧, 라이선스 정보

  ---
  6. Agent별 CLI 사용법

  Studio UI 없이 터미널에서 직접 실행 가능합니다.

  6-1. Agent 0: Topic Intelligence

  # 토픽 생성
  npx tsx agents/topic-intelligence/cli.ts request \
    --prompt "아이브 컴백 소식" --category music

  # 인텔 수집 (phase A→D 순서대로)
  npx tsx agents/topic-intelligence/cli.ts intel \
    --topicId "아이브-20260217-e2038f" --phase A
  npx tsx agents/topic-intelligence/cli.ts intel \
    --topicId "아이브-20260217-e2038f" --phase B
  npx tsx agents/topic-intelligence/cli.ts intel \
    --topicId "아이브-20260217-e2038f" --phase C
  npx tsx agents/topic-intelligence/cli.ts intel \
    --topicId "아이브-20260217-e2038f" --phase D

  # Agent 2용 변환
  npx tsx agents/topic-intelligence/cli.ts bridge-agent2 \
    --topicId "아이브-20260217-e2038f"

  # URL 기반 기사 수집
  npx tsx agents/topic-intelligence/cli.ts fetch-url \
    --url "https://example.com/article" --out ./signal-url.json

  # Batch: 시드 후보 (Google Trends KR)
  npx tsx agents/topic-intelligence/cli.ts seeds \
    --timeframe "now 7-d" --topN 30 --save true

  # Batch: 시드 선택
  npx tsx agents/topic-intelligence/cli.ts pick-seeds \
    --date 20260217 --autoPick 5

  # Batch: 일괄 실행
  npx tsx agents/topic-intelligence/cli.ts run-picked \
    --date 20260217 --concurrency 3


  6-2. Agent 1: Safe Image Acquisition

  npx tsx agents/safe-image-acquisition/cli.ts \
    --topic "아이브 컴백" \
    --keywords "아이브,케이팝,걸그룹" \
    --use editorial \
    --channel instagram \
    --category music \
    --out ./test-image-output
    # 선택: --allowPeople true


  6-3. Agent 2: Cardnews Composition

  # 전체 렌더링 (HTML + PNG + 캡션 + 매니페스트)
  npx tsx agents/cardnews-composition/cli.ts \
    --mode render \
    --input ./image/validated-post.json \
    --topic ./topic.agent2.json \
    --out ./agent2-output

  # 음악 PostType (밈 예시)
  npx tsx agents/cardnews-composition/cli.ts \
    --mode render \
    --input ./image/validated-post.json \
    --topic ./topic.agent2.json \
    --out ./meme-output \
    --postType meme \
    --humanInput ./human-input.json

  # 개별 스텝 실행
  npx tsx agents/cardnews-composition/cli.ts --mode preflight --input ... --out ...
  npx tsx agents/cardnews-composition/cli.ts --mode html --input ... --topic ... --out ...
  npx tsx agents/cardnews-composition/cli.ts --mode png --out ...
  npx tsx agents/cardnews-composition/cli.ts --mode finalize --input ... --topic ... --out ...

  # 멀티슬라이드 (deck)
  npx tsx agents/cardnews-composition/cli.ts --mode deck-html --input ... --topic ... --out ...
  npx tsx agents/cardnews-composition/cli.ts --mode deck-png --out ...
  npx tsx agents/cardnews-composition/cli.ts --mode deck-finalize --input ... --topic ... --out ...
  npx tsx agents/cardnews-composition/cli.ts --mode deck-qa --out ...


  6-4. Agent 3: Content Structuring

  # 콘텐츠 구조화
  npx tsx agents/content-structuring/cli.ts content \
    --topicId "아이브-20260217-e2038f"

  # LLM 리라이트 포함
  npx tsx agents/content-structuring/cli.ts content \
    --topicId "아이브-20260217-e2038f" \
    --rewriteMode all \
    --rewriteProvider openai \
    --rewriteModel gpt-4o-mini

  # 브릿지 (→ Agent 2 토픽)
  npx tsx agents/content-structuring/cli.ts bridge \
    --topicId "아이브-20260217-e2038f"

  # E2E (content + bridge 한번에)
  npx tsx agents/content-structuring/cli.ts e2e \
    --topicId "아이브-20260217-e2038f"


  6-5. Agent 4: Publish Bundle

  npx tsx agents/publish-bundle/cli.ts scaffold --topicId "아이브-20260217-e2038f"
  npx tsx agents/publish-bundle/cli.ts build --topicId "아이브-20260217-e2038f"


  6-6. Agent 5: Trend Signals

  # YouTube 트렌드
  npx tsx agents/trend-signals/cli.ts youtube \
    --seed "인디음악" --region KR --max 15

  # Instagram 해시태그
  npx tsx agents/trend-signals/cli.ts instagram \
    --seed "인디밴드" --edge both


  ---
  7. API 엔드포인트

  ┌────────┬──────────────────────────────────────┬────────────────────────────────────────────────┐
  │ Method │                 Path                 │                      설명                      │
  ├────────┼──────────────────────────────────────┼────────────────────────────────────────────────┤
  │ GET    │ /api/runs?limit=20                   │ Run 목록 (최대 50)                             │
  ├────────┼──────────────────────────────────────┼────────────────────────────────────────────────┤
  │ POST   │ /api/runs                            │ Run 생성 + 파이프라인 시작                     │
  ├────────┼──────────────────────────────────────┼────────────────────────────────────────────────┤
  │ DELETE │ /api/runs                            │ 전체 Run 삭제                                  │
  ├────────┼──────────────────────────────────────┼────────────────────────────────────────────────┤
  │ GET    │ /api/runs/[runId]                    │ Run 상세                                       │
  ├────────┼──────────────────────────────────────┼────────────────────────────────────────────────┤
  │ DELETE │ /api/runs/[runId]                    │ 단일 Run 삭제                                  │
  ├────────┼──────────────────────────────────────┼────────────────────────────────────────────────┤
  │ GET    │ /api/runs/[runId]/logs?tail=400      │ 로그 (최근 N줄)                                │
  ├────────┼──────────────────────────────────────┼────────────────────────────────────────────────┤
  │ GET    │ /api/runs/[runId]/artifacts          │ Artifacts (PNG 경로, 캡션, 번들)               │
  ├────────┼──────────────────────────────────────┼────────────────────────────────────────────────┤
  │ GET    │ /api/runs/[runId]/file?path=...      │ 파일 서빙 (PNG, JSON 등)                       │
  ├────────┼──────────────────────────────────────┼────────────────────────────────────────────────┤
  │ GET    │ /api/runs/[runId]/checkpoint         │ 체크포인트 상태                                │
  ├────────┼──────────────────────────────────────┼────────────────────────────────────────────────┤
  │ POST   │ /api/runs/[runId]/checkpoint         │ 체크포인트 해결 (approve/reject/provide_input) │
  ├────────┼──────────────────────────────────────┼────────────────────────────────────────────────┤
  │ GET    │ /api/spotify/search?q=...&type=album │ Spotify 앨범 검색 프록시                       │
  └────────┴──────────────────────────────────────┴────────────────────────────────────────────────┘

  ---
  8. 템플릿 시스템

  8-1. 12개 템플릿

  ┌───────────────────────┬─────────────────────────┬─────────────────────────────────────────────────────┐
  │       템플릿 ID       │          용도           │                        슬롯                         │
  ├───────────────────────┼─────────────────────────┼─────────────────────────────────────────────────────┤
  │ cover.hero.v1         │ 기본 표지 (이미지 전면) │ heroImage, title, subtitle, footerCredits           │
  ├───────────────────────┼─────────────────────────┼─────────────────────────────────────────────────────┤
  │ cover.hero.v2         │ 표지 변형               │ heroImage, title, subtitle, footerCredits           │
  ├───────────────────────┼─────────────────────────┼─────────────────────────────────────────────────────┤
  │ body.fact.v1          │ 사실 카드 (대형 폰트)   │ headline, body, footerCredits                       │
  ├───────────────────────┼─────────────────────────┼─────────────────────────────────────────────────────┤
  │ body.fact.v2          │ 사실 카드 (중형)        │ headline, body, footerCredits                       │
  ├───────────────────────┼─────────────────────────┼─────────────────────────────────────────────────────┤
  │ body.fact.v3          │ 사실 카드 (소형)        │ headline, body, footerCredits                       │
  ├───────────────────────┼─────────────────────────┼─────────────────────────────────────────────────────┤
  │ outro.cta.v1          │ CTA 마무리              │ cta, footerCredits                                  │
  ├───────────────────────┼─────────────────────────┼─────────────────────────────────────────────────────┤
  │ music.album.cover.v1  │ 앨범 표지               │ albumArt, title, artist, releaseDate, footerCredits │
  ├───────────────────────┼─────────────────────────┼─────────────────────────────────────────────────────┤
  │ music.album.detail.v1 │ 트랙리스트              │ headline, tracklist, footerCredits                  │
  ├───────────────────────┼─────────────────────────┼─────────────────────────────────────────────────────┤
  │ music.meme.v1         │ 밈 (이미지+텍스트)      │ artistImage, memeText, footerCredits                │
  ├───────────────────────┼─────────────────────────┼─────────────────────────────────────────────────────┤
  │ music.meme.v2         │ 밈 (텍스트 카드)        │ memeText, bgColor, footerCredits                    │
  ├───────────────────────┼─────────────────────────┼─────────────────────────────────────────────────────┤
  │ music.grid.v1         │ 앨범 2x2 그리드         │ albumArt1~4, title, footerCredits                   │
  ├───────────────────────┼─────────────────────────┼─────────────────────────────────────────────────────┤
  │ music.concert.v1      │ 공연 포스터             │ posterImage, venue, date, lineup, footerCredits     │
  └───────────────────────┴─────────────────────────┴─────────────────────────────────────────────────────┘

  8-2. 스타일 프리셋

  - default: 일반 카드뉴스용
  - music: 음악 PostType 전용 (타이틀 56px, CTA "저장해두고 들어보기 · 팔로우하면 새 음악 소식 도착")

  8-3. QA 자동 보정

  - 텍스트 오버플로: 타이틀 -6px, 서브타이틀 -4px (최대 2회 재시도)
  - 세이프 에어리어 위반: 위치 조정 + 폰트 축소 (최대 2회)
  - 푸터 영역 침범: 폰트 축소 + 위치 조정
  - 서브타이틀 제거: 2번째 시도에서도 위반 시 서브타이틀 숨김

  ---
  9. 이미지 라이선스 시스템

  9-1. 프로바이더 & 라우팅

  ┌─────────────────┬────────────────┬─────────────────────────────────┬─────────────────────────────┐
  │   프로바이더    │      트랙      │            라이선스             │          파생 허용          │
  ├─────────────────┼────────────────┼─────────────────────────────────┼─────────────────────────────┤
  │ Spotify         │ PR (editorial) │ 한국 저작권법 제28조 (공정이용) │ O (resize, crop, composite) │
  ├─────────────────┼────────────────┼─────────────────────────────────┼─────────────────────────────┤
  │ Pressroom       │ PR (editorial) │ 사이트별 감지                   │ 사이트별                    │
  ├─────────────────┼────────────────┼─────────────────────────────────┼─────────────────────────────┤
  │ Unsplash        │ STOCK          │ Unsplash License                │ O                           │
  ├─────────────────┼────────────────┼─────────────────────────────────┼─────────────────────────────┤
  │ Pexels          │ STOCK          │ Pexels License                  │ O                           │
  ├─────────────────┼────────────────┼─────────────────────────────────┼─────────────────────────────┤
  │ AI생성 (DALL-E) │ AI             │ OpenAI ToS                      │ O                           │
  └─────────────────┴────────────────┴─────────────────────────────────┴─────────────────────────────┘

  라우팅 우선순위 (music): PR(Spotify→Pressroom) → STOCK(Unsplash→Pexels) → AI

  9-2. 리스크 스코어링

  ┌───────┬─────────────────┬───────────────────────────┐
  │ 점수  │      판정       │           동작            │
  ├───────┼─────────────────┼───────────────────────────┤
  │ 0-29  │ PASS            │ 사용 가능                 │
  ├───────┼─────────────────┼───────────────────────────┤
  │ 30-59 │ PASS_WITH_FLAGS │ 사용 가능 (경고 저장)     │
  ├───────┼─────────────────┼───────────────────────────┤
  │ 60+   │ FAIL            │ 자동 재시도 (다른 이미지) │
  └───────┴─────────────────┴───────────────────────────┘

  즉시 FAIL (80-100):
  - 라이선스 불명 (UNKNOWN)
  - 출처 증명 없음 (no proof hash)
  - 파생 불가인데 편집 필요
  - derivatives.allowed === false

  9-3. 필수 출력 필드 (ValidatedAsset)

  assetId, provider, sourceUrl, licenseUrl, LicenseProfile, proof(hash + fetchedAt), riskScore, localPath,
  recommendedAttribution

  ---
  10. 리라이트 시스템 (Agent 3)

  10-1. 모드

  ┌──────────┬────────────────────────────┐
  │   모드   │            동작            │
  ├──────────┼────────────────────────────┤
  │ off      │ 패스스루 (LLM 호출 없음)   │
  ├──────────┼────────────────────────────┤
  │ slides   │ 슬라이드 텍스트만 리라이트 │
  ├──────────┼────────────────────────────┤
  │ caption  │ 캡션만 리라이트            │
  ├──────────┼────────────────────────────┤
  │ all      │ 슬라이드 + 캡션 리라이트   │
  ├──────────┼────────────────────────────┤
  │ generate │ 새 슬라이드 생성           │
  └──────────┴────────────────────────────┘

  10-2. 가드레일

  - 수치 보존: 원문의 숫자가 리라이트 후 변경되면 롤백
  - 고유명사 보존: 아티스트명, 앨범명 등 변경 시 롤백
  - 날짜 보존: 날짜 정보 변경 시 롤백
  - 새 사실 차단: 원문에 없는 사실 추가 시 거부

  10-3. 프로바이더

  ┌────────────┬──────────────────┬──────┬─────────────────────┐
  │ 프로바이더 │    기본 모델     │ 비용 │        특징         │
  ├────────────┼──────────────────┼──────┼─────────────────────┤
  │ mock       │ —                │ 무료 │ 패스스루 (테스트용) │
  ├────────────┼──────────────────┼──────┼─────────────────────┤
  │ openai     │ gpt-4o-mini      │ 저렴 │ JSON 응답 안정적    │
  ├────────────┼──────────────────┼──────┼─────────────────────┤
  │ anthropic  │ claude-3-5-haiku │ 저렴 │ 한국어 품질 우수    │
  └────────────┴──────────────────┴──────┴─────────────────────┘

  ---
  11. 출력 디렉토리 구조

  outputs/
  ├── runs/
  │   └── <runId>/
  │       ├── run.json              # RunRecord (상태, 스텝, 체크포인트)
  │       ├── run.log               # 파이프라인 로그
  │       ├── artifacts/            # artifacts.json
  │       ├── signal-url.json       # URL 기사 (선택)
  │       ├── signal-merged.json    # 병합 시그널 (선택)
  │       ├── human-input.json      # 사람 입력 (체크포인트)
  │       ├── image/
  │       │   ├── validated-asset.json
  │       │   ├── validated-post.json
  │       │   └── <uuid>.jpg
  │       └── agent2/
  │           ├── slide_01.html / .png
  │           ├── slide_02.html / .png
  │           ├── ...
  │           ├── caption.txt
  │           ├── layout_manifest.json
  │           ├── qa.report.json / qa.deck.report.json
  │           ├── compliance.preview.json
  │           ├── credits.preview.json
  │           └── mapping.preview.json
  │
  agents/topic-intelligence/outputs/
  └── <topicId>/
      ├── topic-request.json
      ├── topic-intel.json
      ├── topic-intel-raw.json (선택)
      ├── content-plan.json
      ├── caption.draft.txt
      ├── topic.agent2.json
      ├── rewrite.report.json (선택)
      └── publish-bundle.json


  ---
  12. 1인 운영 일일 워크플로우

  시나리오 A: 일반 카드뉴스 (완전 자동)

  1. Studio 열기 → 일반 카드뉴스 선택
  2. 프롬프트 입력 (예: "이번 주 인디밴드 소식")
  3. (선택) Source URL 붙여넣기, Rewrite mode 켜기
  4. Run 클릭 → 자동 완료까지 대기 (~2~5분)
  5. Results에서 PNG 확인 → 인스타 업로드

  시나리오 B: 밈 (사람 텍스트 필요)

  1. 밈 선택 → 프롬프트에 아티스트명 입력
  2. 밈 텍스트 직접 작성 + 위치 선택
  3. Run → 이미지 수집 후 awaiting_input 상태
  4. CheckpointPanel에서 밈 텍스트 확인/수정 → Submit Input
  5. 렌더 후 awaiting_approval → 미리보기 확인 → Approve

  시나리오 C: 앨범 추천 (Spotify 검색)

  1. 앨범 추천 선택 → 프롬프트 입력
  2. AlbumPicker에서 Spotify 앨범 검색 → 4장 선택
  3. Run → awaiting_input → 선택한 앨범 확인 → Submit
  4. 렌더 → awaiting_approval → 그리드 확인 → Approve

  시나리오 D: Batch (일괄 제작)

  # 1. 트렌드 시드 수집
  npx tsx agents/topic-intelligence/cli.ts seeds --save true

  # 2. 시드 선택 (자동 상위 5개)
  npx tsx agents/topic-intelligence/cli.ts pick-seeds --date 20260217 --autoPick 5

  # 3. 일괄 실행
  npx tsx agents/topic-intelligence/cli.ts run-picked --date 20260217 --concurrency 3

  # 4. 각 토픽별 Studio에서 개별 확인/승인


  ---
  13. 트러블슈팅

  증상: PIPELINE_FAIL topic_request
  원인: Agent 0 실행 실패
  해결: 프롬프트가 비어있거나 Node.js 버전 확인
  ────────────────────────────────────────
  증상: image step failed
  원인: 모든 프로바이더 실패
  해결: API 키 확인 (UNSPLASH_ACCESS_KEY, PEXELS_API_KEY)
  ────────────────────────────────────────
  증상: slide_01.png 생성 안됨
  원인: Playwright 미설치
  해결: npx playwright install chromium
  ────────────────────────────────────────
  증상: topic-intel.json not found
  원인: 비인텔 PostType인데 content 스텝 실행
  해결: 이미 수정됨 (content/bridge 자동 스킵)
  ────────────────────────────────────────
  증상: topic.agent2.json not found
  원인: bridge 스킵된 비인텔 PostType
  해결: 이미 수정됨 (minimal topic 자동 생성)
  ────────────────────────────────────────
  증상: Spotify search 실패
  원인: 토큰 만료 또는 API 키 미설정
  해결: SPOTIFY_CLIENT_ID + SECRET 확인
  ────────────────────────────────────────
  증상: rewrite 실패
  원인: LLM API 키 미설정
  해결: rewriteMode off로 두거나 API 키 설정
  ────────────────────────────────────────
  증상: awaiting_input 상태에서 멈춤
  원인: 사람 입력 대기 중
  해결: CheckpointPanel에서 입력 → Submit
  ────────────────────────────────────────
  증상: Run 목록 로딩 느림
  원인: 폴링 주기
  해결: 정상 동작 (5초 간격)
  ────────────────────────────────────────
  증상: Post not allowed
  원인: Agent 1이 이미지 차단
  해결: 라이선스 위반 — 다른 키워드로 재시도

  ---
  14. 기술 스택 요약

  ┌──────────────┬──────────────────────────────────────┬────────┐
  │    레이어    │                 기술                 │  버전  │
  ├──────────────┼──────────────────────────────────────┼────────┤
  │ Frontend     │ Next.js (App Router)                 │ 16.1.6 │
  ├──────────────┼──────────────────────────────────────┼────────┤
  │ UI           │ React (inline styles, CSS variables) │ 19.2   │
  ├──────────────┼──────────────────────────────────────┼────────┤
  │ Runtime      │ Node.js + tsx                        │ 20+    │
  ├──────────────┼──────────────────────────────────────┼────────┤
  │ Validation   │ Zod                                  │ 4.3    │
  ├──────────────┼──────────────────────────────────────┼────────┤
  │ Rendering    │ Playwright (Chromium)                │ 1.50   │
  ├──────────────┼──────────────────────────────────────┼────────┤
  │ HTTP         │ Axios + built-in fetch               │ —      │
  ├──────────────┼──────────────────────────────────────┼────────┤
  │ HTML Parsing │ Cheerio, JSDOM, Readability          │ —      │
  ├──────────────┼──────────────────────────────────────┼────────┤
  │ XML/RSS      │ fast-xml-parser                      │ 5.3    │
  ├──────────────┼──────────────────────────────────────┼────────┤
  │ Template     │ EJS                                  │ 3.1    │
  ├──────────────┼──────────────────────────────────────┼────────┤
  │ Language     │ TypeScript (strict)                  │ 5.9    │
  └──────────────┴──────────────────────────────────────┴────────┘