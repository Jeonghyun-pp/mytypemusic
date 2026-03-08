# 수동 설정 작업 목록

## 현재 상태 요약
- 로컬 개발: 바로 가능 (OPENAI_API_KEY, DATABASE_URL 설정됨)
- SNS 발행: API 키 등록 필요
- 비디오 렌더링: AWS Lambda 배포 필요
- Vercel 배포: 환경변수 세팅 필요

---

## 1. API 키 발급 (미설정 항목)

### 우선순위 높음

| 서비스 | 환경변수 | 용도 | 발급처 | 비용 |
|--------|----------|------|--------|------|
| fal.ai | `FAL_KEY` | Flux 이미지 생성 (DALL-E 대안) | https://fal.ai/dashboard/keys | 무료 100크레딧/월 |
| YouTube | `YOUTUBE_API_KEY` | 유튜브 트렌드 수집 | https://console.cloud.google.com/ | 무료 10,000쿼리/일 |
| Pexels | `PEXELS_API_KEY` | 스톡 이미지 검색 (백업) | https://www.pexels.com/api/ | 무료 |

### 우선순위 보통 (SNS 발행용)

| 서비스 | 환경변수 | 발급처 | 설정 시간 |
|--------|----------|--------|-----------|
| Meta (Threads/Instagram) | `META_APP_ID`, `META_APP_SECRET` | https://developers.facebook.com/ | 30분 |
| X (Twitter) | `X_CLIENT_ID`, `X_CLIENT_SECRET` | https://developer.x.com/ | 20분 |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | https://www.linkedin.com/developers/apps | 20분 |
| Google (YouTube) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | https://console.cloud.google.com/ | 20분 |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | https://developers.tiktok.com/ | 20분 |
| WordPress | `WORDPRESS_COM_CLIENT_ID`, `WORDPRESS_COM_CLIENT_SECRET` | https://developer.wordpress.com/apps/ | 10분 |

### 우선순위 낮음

| 서비스 | 환경변수 | 용도 | 발급처 | 비용 |
|--------|----------|------|--------|------|
| Instagram Trend | `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID` | 해시태그 트렌드 | https://developers.facebook.com/ | 무료 |
| Brave Search | `BRAVE_SEARCH_API_KEY` | 웹 검색 (RAG) | https://brave.com/search/api/ | 무료 2,000/월 |
| Tavily | `TAVILY_API_KEY` | 웹 검색 (대안) | https://tavily.com/ | 무료 1,000/월 |

---

## 2. SNS OAuth 리다이렉트 URL 등록

각 플랫폼 앱 설정에서 아래 URL을 등록해야 합니다.

**로컬 개발:**
```
http://localhost:3100/api/sns/callback/threads
http://localhost:3100/api/sns/callback/instagram
http://localhost:3100/api/sns/callback/x
http://localhost:3100/api/sns/callback/linkedin
http://localhost:3100/api/sns/callback/youtube
http://localhost:3100/api/sns/callback/tiktok
http://localhost:3100/api/sns/callback/wordpress
```

**프로덕션 (Vercel 도메인으로 교체):**
```
https://[your-domain]/api/sns/callback/[platform]
```

자세한 가이드: `apps/studio/SETUP_SNS.md`

---

## 3. Vercel 배포 설정

### 환경변수 등록
Vercel 프로젝트 설정 > Environment Variables에 아래 항목 등록:

**필수:**
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `SNS_TOKEN_ENCRYPTION_KEY`
- `CRON_SECRET`
- `OAUTH_CALLBACK_BASE_URL` = `https://[your-vercel-domain]`

**선택:** 위 1번 표의 모든 API 키

### Cron 관련
- 현재: `/api/jobs/daily-reset` 매일 3PM UTC 실행 중
- Hobby 플랜: 일 1회 cron만 가능
- Pro 플랜 업그레이드 시: `vercel.json`에 `/api/jobs/process` 5분 cron 재활성화

---

## 4. Remotion Lambda (비디오 렌더링) — 선택사항

AWS 계정이 필요합니다. 비디오 기능이 필요 없으면 건너뛰세요.

```bash
# 1. AWS 인증 설정
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

# 2. Lambda 함수 배포
npx remotion lambda functions deploy --memory=2048 --timeout=240

# 3. 사이트 번들 배포
npx remotion lambda sites create apps/studio/src/remotion/index.ts --site-name=studio

# 4. 출력값을 .env에 추가
REMOTION_AWS_REGION=ap-northeast-2
REMOTION_FUNCTION_NAME=[출력값]
REMOTION_SERVE_URL=[출력값]
```

---

## 5. 데이터베이스

**상태: 완료**
- Neon PostgreSQL 사용 중
- 최신 마이그레이션: `20260307163845_add_design_engine_persistence`
- 새 환경에서: `npx prisma db push`

---

## 6. 이미 설정된 항목 (건드릴 필요 없음)

| 환경변수 | 상태 |
|----------|------|
| `OPENAI_API_KEY` | 설정됨 |
| `DATABASE_URL` | 설정됨 (Neon) |
| `ANTHROPIC_API_KEY` | 설정됨 |
| `SNS_TOKEN_ENCRYPTION_KEY` | 설정됨 |
| `CRON_SECRET` | 설정됨 |
| `UNSPLASH_ACCESS_KEY` | 설정됨 |
| `SPOTIFY_CLIENT_ID` / `SECRET` | 설정됨 |
| `NAVER_CLIENT_ID` / `SECRET` | 설정됨 |
| `SITE_PASSWORD` | 설정됨 (magazine2026) |

---

## 빠른 시작 체크리스트

### 지금 바로 할 수 있는 것 (5분)
- [ ] fal.ai 가입 + `FAL_KEY` 발급 -> .env에 추가
- [ ] Pexels API 키 발급 -> .env에 추가

### 이번 주 안에 할 것 (1시간)
- [ ] YouTube Data API 활성화 + `YOUTUBE_API_KEY` 발급
- [ ] Vercel 환경변수 등록 (프로덕션 배포용)

### SNS 발행이 필요할 때 (2~3시간)
- [ ] Meta 앱 등록 (Threads + Instagram)
- [ ] X 앱 등록
- [ ] 기타 플랫폼 (LinkedIn, YouTube, TikTok, WordPress)
- [ ] 각 플랫폼에 OAuth 리다이렉트 URL 등록
