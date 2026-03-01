# Web Magazine - TODO

## 완료된 작업
- [x] Task 1: RSS → Naver Search API 마이그레이션
- [x] Task 2: Playwright → Satori + resvg-js 마이그레이션
- [x] E2E 파이프라인 검증 (83.6s, PASS)

## 다음 단계

### P1: 슬라이드 타입 검증
- [ ] fact 슬라이드 Satori 렌더링 검증
- [ ] outro 슬라이드 Satori 렌더링 검증
- [ ] music album (cover/detail) Satori 렌더링 검증
- [ ] meme, grid, concert 슬라이드 Satori 렌더링 검증

### P2: 코드 정리
- [ ] dead code 제거: `renderer/playwright.ts`, `renderer/measure.ts`, `renderer/qa.ts`
- [ ] 불필요한 테스트 스크립트 정리

### P3: 멀티슬라이드 덱 E2E
- [ ] 10장짜리 카드뉴스 전체 렌더링 테스트
- [ ] 슬라이드 간 스타일 일관성 확인

### P4: Agent 3 - Pre-publish 법적 충돌 차단
- [ ] 스키마/계약 정의
- [ ] 법적 리스크 규칙 엔진
- [ ] 파이프라인 통합

### P5: Studio UI 개선
- [ ] Liner 스타일 리디자인
- [ ] 덱 리뷰/편집 UX 개선

## 성능 벤치마크
| 지표 | 값 |
|------|-----|
| E2E 전체 | ~84s |
| Satori 렌더링/장 | ~450-600ms |
| Naver topic intel | ~3s |
| style_analysis | ~800ms |
| agent2_render | ~1.3s |
| bundle | ~1.0s |
