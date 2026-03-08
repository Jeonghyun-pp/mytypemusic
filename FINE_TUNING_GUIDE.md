# Fine-Tuning Guide
## 프로젝트 전체 튜닝 가능 요소 정리

> 각 항목에 대해: 현재값, 튜닝 방법, 튜닝 시점, 영향 범위를 기술한다.

---

# Part A: 기존 시스템 (이미 구현됨)

## A1. LLM 모델 & Temperature 설정

| 에이전트 | 파일 | 모델 | Temp | 튜닝 시나리오 |
|---------|------|------|------|-------------|
| 기본 LLM (callGptJson) | `apps/studio/src/lib/llm.ts` | gpt-4o-mini | 0.7 | 비용 vs 품질 트레이드오프 |
| 슬라이드 플랜 | `agents/cardnews-composition/llm/index.ts` | gpt-4o (env) | 0.7 | 슬라이드 창의성 조절 |
| 앵글 생성 | `agents/topic-intelligence/phase1/angles/generate-llm.ts` | gpt-4o-mini | 1.0 | 앵글 다양성 vs 관련성 |
| Spotify Intent | `agents/topic-intelligence/spotify/intent-llm.ts` | gpt-4o-mini | 0.0 | 구조화 정확도 |
| 리라이트 (보수) | `agents/content-structuring/rewrite/config.ts` | gpt-4o-mini | 0.2 | 팩트 유지 정도 |
| 리라이트 (생성) | 위와 동일 | gpt-4o-mini | 0.5 | 창의적 표현 정도 |
| 페르소나 학습 | `apps/studio/src/lib/jobs/handlers/personaLearn.ts` | gpt-4o-mini | 0.4 | 학습 보수성 |

**튜닝 방법:**
- Temperature: 낮추면 일관적이지만 단조로움, 높이면 창의적이지만 불안정
- 모델 교체: gpt-4o-mini → gpt-4o (품질↑ 비용↑) 또는 Claude Sonnet
- A/B 테스트: 동일 입력에 다른 temp/model로 50건 생성 후 품질 비교

**튜닝 시점:** 콘텐츠 품질이 기대에 못 미칠 때, 비용 최적화가 필요할 때

---

## A2. 스코어링 가중치 (트렌드/기사/팩트)

### A2-1. 트렌드 시드 스코어
**파일:** `agents/topic-intelligence/phase2/trends/score.ts`

```
현재 가중치:
  기본점: 20
  트래픽 보너스: log10(traffic) * 8 (최대 40)
  소스 보너스: realTime +15, daily +10, related +5
  카테고리: music/lifestyle +10, unknown +0
  제너릭 페널티: -30
  범위: 0-100
```

**튜닝 포인트:**
- `카테고리 보너스 +10` → 음악 콘텐츠 편향 조절. +15로 올리면 음악 토픽 우선
- `제너릭 페널티 -30` → 정치/경제 필터링 강도. -50으로 내리면 더 엄격
- `트래픽 계수 *8` → 인기도 vs 틈새 토픽 균형
- **제너릭 키워드 목록** (16개) → 추가/제거로 필터 범위 조절

**튜닝 방법:** 2주간 생성된 토픽을 수동 평가 → 원하는 토픽이 상위에 오도록 가중치 조절

### A2-2. 기사 관련성 스코어
**파일:** `agents/topic-intelligence/phase1/relevance/score.ts`

```
현재 가중치:
  제목 키워드 전체매칭: +8
  스니펫 키워드 전체매칭: +4
  부분매칭 (제목): +2/단어 (최대 +4)
  부분매칭 (스니펫): +1/단어 (최대 +2)
  카테고리 보너스: +1/토큰 (최대 3개)
  짧은 제목 (<8자): -2
  24시간 이내: +1
  조회수: log10(views) - 2 (최대 +4)
```

**튜닝 포인트:**
- `제목 전체매칭 +8` → 정확한 키워드 매칭의 중요도
- `조회수 보너스` → 인기 기사 편향 정도
- 엔티티 기반: 엔티티 0개 → 점수 최대 2 제한 (하드 필터 강도)

### A2-3. 이미지 리스크 스코어
**파일:** `agents/safe-image-acquisition/risk-scoring.ts`

```
현재 임계값: 점수 >= 60 → 거부
주요 페널티:
  허용 사용처 없음: +80
  상업 사용 미허용: +80
  증빙 불가: +50
  유명인 (상업용): +50
  워터마크: +35
```

**튜닝 포인트:**
- `거부 임계값 60` → 낮추면(40) 더 엄격, 높이면(80) 더 관대
- 카테고리별 베이스라인 (celebrity: +20) → 유명인 이미지 사용 정책

---

## A3. 페르소나/보이스 시스템

**파일:** `apps/studio/prisma/schema.prisma` (WritingPersona 모델)

**튜닝 대상:**
| 필드 | 설명 | 튜닝 방법 |
|------|------|---------|
| `tone.formality` | 격식 수준 | 0.0(캐주얼) ~ 1.0(격식) |
| `tone.humor` | 유머 수준 | 0.0(진지) ~ 1.0(재치) |
| `tone.emotion` | 감정 표현 | 0.0(건조) ~ 1.0(열정적) |
| `tone.energy` | 에너지 수준 | 0.0(차분) ~ 1.0(활발) |
| `emotionalDrivers` | Persado 패턴 | curiosity, nostalgia 등 추가/제거 |
| `vocabulary.level` | 어휘 수준 | casual / standard / professional |
| `vocabulary.preferredWords` | 선호 단어 | 성과 기반 자동 학습 (최대 30개) |
| `vocabulary.avoidWords` | 회피 단어 | 성과 기반 자동 학습 (최대 20개) |
| `structure.avgSentenceLength` | 평균 문장 길이 | 짧으면(15자) 펀치감, 길면(40자) 서술적 |
| `structure.hookStyle` | 첫 문장 스타일 | question / statement / shock / data |
| `goldenExamples` | 황금 예시 | sns/blog/review별 최고 성과 콘텐츠 교체 |
| `styleFingerprint` | 스타일 서술 | 직접 편집 또는 자동 학습 |
| `contentRules.always` | 항상 적용 규칙 | "항상 데이터를 인용하라" 등 |
| `contentRules.never` | 금지 규칙 | "절대 ~하지 마라" 등 |

**튜닝 시점:**
- 초기: 수동으로 tone/vocabulary 설정
- 운영 중: personaLearn 핸들러가 성과 데이터로 자동 학습 (상위 1/3 vs 하위 1/3 비교)
- 정기: 월 1회 goldenExamples를 최고 성과 콘텐츠로 교체

---

## A4. 콘텐츠 크기 제약

**파일:** `agents/cardnews-composition/` 내 상수들

| 제약 | 현재값 | 튜닝 시나리오 |
|------|--------|-------------|
| 카드뉴스 제목 | 최대 22자 | 플랫폼 트렌드에 따라 ±5자 |
| 카드뉴스 본문 | 60-120자 | 모바일 가독성 기준 조절 |
| 인스타 캡션 | 최대 2200자 | 긴 캡션 vs 짧은 캡션 성과 비교 |
| 인스타 해시태그 | 최대 30개 | 5-15개가 최적이라는 연구 반영 |
| 핵심 팩트 | 최대 4개 | 정보 밀도 vs 가독성 |
| 팩트 슬라이드 | 최대 5개 | 카드뉴스 스와이프 이탈률 기준 |

---

## A5. 재시도 & 타임아웃 정책

| 에이전트 | 재시도 | 백오프 | 타임아웃 | 튜닝 |
|---------|--------|--------|---------|------|
| 기본 LLM | 3회 | 1s, 2s, 4s | 30s | API 안정성에 따라 조절 |
| 슬라이드 플랜 | 3회 | - | 30s | 복잡한 플랜은 60s로 |
| 앵글 생성 | - | - | 15s | 경량 호출이므로 유지 |
| OpenAI Slide API | 2회 | 500ms × 2^n | - | 피크 시간대 조절 |

---

# Part B: 새 디자인 엔진 (구현 예정)

## B1. Design Director Agent

**예정 파일:** `apps/studio/src/lib/design/agents/design-director.ts`

| 튜닝 대상 | 설명 | 예상 조절 범위 |
|----------|------|--------------|
| 콘텐츠 유형 분류 프롬프트 | 기사 → contentType 매핑 정확도 | 프롬프트 개선, few-shot 예시 추가 |
| 무드 추론 정확도 | 기사 감정 → mood 키워드 | 무드 사전 확장, 음악 장르별 무드 매핑 |
| 출력 계획 로직 | 어떤 포맷을 몇 개 만들지 | 포맷별 성과 데이터 기반 조절 |
| 모델/Temperature | gpt-4o / 0.5 (예상) | 창의성 vs 일관성 균형 |

**튜닝 시점:** Phase 2 완료 후, 생성된 DesignBrief의 적절성을 수동 평가

---

## B2. Visual Designer Agent

**예정 파일:** `apps/studio/src/lib/design/agents/visual-designer.ts`

| 튜닝 대상 | 설명 | 예상 조절 범위 |
|----------|------|--------------|
| Satori JSX 생성 프롬프트 | LLM이 생성하는 JSX의 품질 | CSS 제약 목록, 레이아웃 패턴 예시 추가 |
| Path A/B 선택 기준 | 템플릿 vs 생성 경로 자동 선택 | contentType별 경로 매핑 테이블 |
| 슬라이드 간 일관성 규칙 | 시리즈 전체의 시각적 통일성 | 첫 슬라이드 스타일을 후속에 주입하는 강도 |
| 색상 팔레트 생성 | BrandKit 범위 내 변형 | 허용 변형 범위 (hue shift ±15도 등) |
| 텍스트 피팅 알고리즘 | 긴 텍스트의 자동 축소 | 최소 폰트 크기, 줄바꿈 규칙 |

**튜닝 시점:** Phase 2 완료 후, 렌더링 결과물 50건 수동 평가

---

## B3. Design Critic Agent — 가장 중요한 튜닝 대상

**예정 파일:** `apps/studio/src/lib/design/agents/design-critic.ts`

| 튜닝 대상 | 설명 | 영향도 |
|----------|------|--------|
| **5차원 루브릭 프롬프트** | 평가 기준의 구체성 | CRITICAL |
| **각 차원의 가중치** | 어떤 차원을 더 중시할지 | HIGH |
| **PASS/REFINE 기준점** | 평균 8점 → 7점 or 9점? | HIGH |
| **개선 지시의 구체성** | "색을 바꿔라" vs "배경을 #1a1a2e로" | MEDIUM |
| **Vision 프롬프트** | 이미지의 어떤 측면을 볼지 | HIGH |
| **최대 반복 횟수** | 3회 → 2회 or 5회? | MEDIUM |

```
튜닝 루브릭 예시 (조절 가능):

Visual Hierarchy 가중치:
  - 카드뉴스: 높음 (핵심 메시지 전달이 중요)
  - 모션 그래픽: 중간 (시간 흐름으로 보완)

Aesthetic Quality 가중치:
  - 프리미엄 매거진 톤: 높음 (9점 이상 요구)
  - 속보/트렌딩: 중간 (7점이면 통과)

Platform Fit 가중치:
  - Instagram: 높음 (썸네일에서 인식 필수)
  - Blog: 낮음 (큰 화면으로 봄)
```

**튜닝 방법:**
1. 100건의 디자인을 생성하여 Critic 점수와 사람 평가를 비교
2. Critic이 8점을 준 디자인 vs 사람이 "좋다"고 한 디자인의 일치율 측정
3. 일치율이 낮은 차원의 프롬프트를 개선
4. 점수 기준점(8점)을 사람 평가와 일치하도록 보정

**튜닝 시점:** Phase 3 완료 직후, 이후 월 1회 정기 보정

---

## B4. Motion Designer Agent

**예정 파일:** `apps/studio/src/lib/design/agents/motion-designer.ts`

| 튜닝 대상 | 설명 | 예상 조절 범위 |
|----------|------|--------------|
| Remotion 시스템 프롬프트 | 코드 생성 품질의 핵심 | Remotion API 변경 시 업데이트 필요 |
| 스킬 참조 코드 | 각 스킬의 "모범 답안" | 더 좋은 모션 패턴 발견 시 교체 |
| 스킬 감지 분류기 | 콘텐츠 → 필요 스킬 매핑 | 분류 정확도 기반 프롬프트 개선 |
| 기본 fps | 30fps | 24fps(시네마틱) or 60fps(부드러움) |
| 기본 duration | 15-30초 | 플랫폼별 최적 길이 (릴스 15초 vs 쇼츠 60초) |
| spring 물리 설정 | damping, stiffness | 모션 느낌 조절 (탄력적 vs 부드러운) |
| 코드 자동수정 횟수 | 최대 3회 | 성공률에 따라 조절 |

**튜닝 방법:**
- 각 스킬별 20건 생성 → 렌더링 성공률 측정
- 성공률 < 80% → 해당 스킬의 참조 코드/프롬프트 개선
- 참여도 높은 모션 패턴 → 스킬 라이브러리에 추가

---

## B5. Style Transfer Agent

**예정 파일:** `apps/studio/src/lib/design/agents/style-transfer.ts`

| 튜닝 대상 | 설명 | 예상 조절 범위 |
|----------|------|--------------|
| Vision 분석 프롬프트 | 이미지에서 추출하는 스타일 요소 | 추출 항목 추가/제거 |
| 색상 추출 정확도 | hex 값의 정확성 | 색상 보정 후처리 (클러스터링) |
| 무드 키워드 사전 | 추출 가능한 무드 범위 | 음악 장르별 무드 매핑 확장 |
| StyleToken 적용 강도 | DesignBrief에 미치는 영향 | 0.0(무시) ~ 1.0(완전 적용) |

---

## B6. 템플릿 시스템

**예정 파일:** `agents/shared/templates/` 하위

| 튜닝 대상 | 설명 | 튜닝 방법 |
|----------|------|---------|
| 템플릿 레이아웃 | 요소 배치, 여백, 정렬 | CSS 수정 |
| 색상 슬롯 기본값 | 템플릿별 기본 색상 | BrandKit 연동 확인 |
| 폰트 크기 범위 | hero/title/body/caption | 플랫폼별 가독성 테스트 |
| 세이프 존 | 텍스트 안전 영역 | 플랫폼 UI 오버레이 기준 (IG 상단 바 등) |
| 슬라이드 수 기본값 | 카드뉴스 5-7장 | 스와이프 완주율 기반 |

---

## B7. BrandKit

**예정 파일:** `apps/studio/src/lib/design/brand-kit.ts`

| 튜닝 대상 | 설명 | 튜닝 시점 |
|----------|------|---------|
| 색상 팔레트 | primary, secondary, accent | 브랜드 리뉴얼 시 |
| 타이포그래피 | 폰트 패밀리, weight, 크기 | 가독성 이슈 발견 시 |
| 레이아웃 규칙 | safeMargin, cornerRadius | 플랫폼 트렌드 변화 시 |
| maxTextPerSlide | 슬라이드당 최대 글자 수 | 참여율 데이터 기반 |

---

# Part C: 튜닝 우선순위 로드맵

## 즉시 (구현과 동시에)

1. **B3. Design Critic 루브릭** — 디자인 품질의 최종 게이트. 이것이 잘못되면 전체 품질이 무너진다
2. **B7. BrandKit 기본값** — 모든 비주얼의 기반. 초기 설정이 중요
3. **A3. 페르소나 goldenExamples** — 기존 최고 성과 콘텐츠로 교체

## 운영 2주 후

4. **B2. Visual Designer JSX 프롬프트** — 렌더링 결과 50건 평가 후 개선
5. **B4. Motion 스킬 참조 코드** — 렌더링 성공률 기반 개선
6. **A2. 트렌드 스코어 가중치** — 생성된 토픽 목록 수동 평가 후 조절

## 운영 1개월 후

7. **B1. Design Director 무드 추론** — 실제 콘텐츠 유형 분류 정확도 평가
8. **B5. Style Transfer 정확도** — 추출된 StyleToken과 원본 이미지 비교
9. **A4. 콘텐츠 크기 제약** — 성과 데이터 기반 최적 길이 도출

## 지속적 (자동)

10. **A3. preferredWords/avoidWords** — personaLearn이 자동 학습
11. **B6. 템플릿 성과** — 피드백 루프가 템플릿별 성과 추적
12. **B3. Critic 점수 보정** — 사람 평가와의 일치율 기반 자동 보정
