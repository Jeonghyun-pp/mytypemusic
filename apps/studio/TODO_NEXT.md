# 다음 작업 목록 (2026-03-08 기준)

## 완료된 작업
1. **이미지 생성 통합** — DALL-E 3 + Flux (fal.ai) 듀얼 프로바이더
   - `src/lib/image-gen.ts` 통합 추상화 (자동 라우팅)
   - `POST /api/visual/generate` 엔드포인트
   - `cover-image.ts` 듀얼 프로바이더 전환
   - ReferenceImagesTab에 AI 이미지 생성 UI 추가
   - `.env`에 `FAL_KEY` 항목 추가 (fal.ai 키 발급 필요)

2. **이전 세션 완료 항목** (Phase 7까지 29개 태스크 + 6개 우선순위)
   - Prisma 영속화 (StyleMemory, DesignQuality, StylePerformance)
   - E2E 통합 테스트 15개
   - 피드백 루프 (performanceCollect → StylePerformance 연동)
   - LRU 캐시 20→100 확대
   - 도넛 차트 단일 세그먼트 수정

3. **에디터 UX 개선 (P1)** — 4개 기능 구현 완료
   - 폰트 프리뷰 선택: 커스텀 드롭다운, 각 폰트를 해당 서체로 렌더링 + 샘플 텍스트
   - 텍스트 인라인 편집: 캔버스 더블클릭 → contentEditable 직접 편집
   - 색상 피커 개선: react-colorful 기반 채도/색조 피커 + HEX 입력 + 최근/문서/팔레트 색상
   - 레이어 드래그 리오더: @dnd-kit 기반 드래그 순서 변경 + 그립 핸들
   - (기존 완료: 드래그앤드롭 요소 위치, 실시간 프리뷰 300ms, Undo/Redo 50단계)

4. **분석 대시보드 (P2)** — API + 대시보드 페이지 구현 완료
   - `GET /api/analytics/design` 통합 API (품질/스타일/히트맵/콘텐츠타입 한번에 반환)
   - 디자인 품질 트렌드 차트 (일별 평균 점수 LineChart + 합격률 BarChart)
   - 스타일 퍼포먼스 인사이트 테이블 (속성별 참여율 + 평균 대비 %)
   - 콘텐츠 타입별 성과 BarChart
   - 디자인 경로별 품질 테이블 (템플릿/AI생성/모션/데이터시각화)
   - 최적 발행 시간 히트맵 (요일 x 시간, 색 농도로 참여율 표현)
   - 상위 템플릿 랭킹 테이블
   - Analytics 페이지에서 "디자인 분석" 탭 링크 추가

---

## 남은 작업 (우선순위 순)

### Priority 1: 이미지 생성 고도화
- [ ] fal.ai 키 발급 및 Flux 실제 테스트
- [x] 프롬프트 자동 생성 (토픽/무드 기반) — `POST /api/visual/suggest-prompt` + ReferenceImagesTab UI
- [ ] 이미지 변형 (inpainting, outpainting)
- [ ] ControlNet 지원 (포즈, 엣지 가이드)
- [x] 생성 히스토리 저장 및 재사용 — `ImageGenHistory` Prisma 모델 + `GET /api/visual/history`
- [x] 비용 추적 (프로바이더별 사용량) — `image-gen.ts`에 costUsd 추적 + saveToHistory 자동 저장

### Priority 2: 파이프라인 안정화
- [x] 에러 핸들링 강화 — rate limit(429) 감지 + 긴 백오프, 에러 분류(timeout/rate_limit/api), 재시도 로깅
- [x] 단위 테스트 보강 — Vitest 도입, llm.test.ts(13), image-gen.test.ts(3), env.test.ts(4) = 20개 테스트
- [x] CI/CD 테스트 통합 — package.json에 `test`/`test:watch` 스크립트 추가
- [x] 환경변수 검증 — `src/lib/env.ts` + `src/instrumentation.ts` (서버 시작 시 자동 검증)

---

## 기술 메모
- OpenAI 키: 이미 설정됨 → DALL-E 바로 사용 가능
- fal.ai 키: `.env`에 `FAL_KEY=` 추가됨, 값 채우면 Flux 활성화
- Flux 없으면 자동으로 DALL-E fallback
- 현재 TypeScript 빌드 에러 없음 (2026-03-08 확인)
- 새 의존성: react-colorful (~2.8KB), @dnd-kit/core+sortable+utilities (~15KB)
- Google Fonts 로드: Noto Sans KR, Noto Serif KR, Black Han Sans (layout.tsx)
- 디자인 분석 페이지: /studio/analytics/design
