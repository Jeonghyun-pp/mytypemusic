# API Keys & Environment Variables Guide

프로젝트에서 사용하는 모든 API 키와 환경변수 가이드.
Vercel 배포 시 **Settings > Environment Variables**에도 동일하게 설정 필요.

---

## 필수 (Required)

### 1. PostgreSQL (Neon)

| 변수 | `DATABASE_URL` |
|------|----------------|
| 용도 | Prisma ORM 데이터베이스 연결 |
| 발급 | https://neon.tech → 프로젝트 생성 → Connection string 복사 |
| 형식 | `postgresql://user:pass@host/db?sslmode=require` |
| 비용 | Free 플랜: 0.5GB 스토리지, 190시간/월 컴퓨트 |

### 2. OpenAI

| 변수 | `OPENAI_API_KEY`, `OPENAI_BASE_URL` (선택) |
|------|---------------------------------------------|
| 용도 | GPT-4o-mini (텍스트 생성), DALL-E 3 (이미지 생성) |
| 발급 | https://platform.openai.com/api-keys → Create new secret key |
| 비용 | 종량제. gpt-4o-mini: ~$0.15/1M input tokens |

### 3. Site Password

| 변수 | `SITE_PASSWORD` |
|------|-----------------|
| 용도 | Studio 웹 접근 제한 (미설정 시 비밀번호 없이 접근) |
| 발급 | 직접 설정 (임의 문자열) |

---

## 권장 (Recommended)

### 4. Anthropic Claude

| 변수 | `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` (선택) |
|------|--------------------------------------------------|
| 용도 | OpenAI 대안 LLM (텍스트 리라이트, 분석) |
| 발급 | https://console.anthropic.com → API Keys → Create Key |
| 비용 | 종량제. Claude Sonnet: ~$3/1M input tokens |

### 5. Unsplash

| 변수 | `UNSPLASH_ACCESS_KEY` |
|------|------------------------|
| 용도 | 스톡 이미지 검색 (무드 서치, 히어로 이미지) |
| 발급 | https://unsplash.com/developers → New Application → Access Key 복사 |
| 비용 | 무료 (50 req/hour) |

### 6. Spotify

| 변수 | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` |
|------|-----------------------------------------------|
| 용도 | 앨범 커버 검색, 아티스트 정보, 스타일 추출 |
| 발급 | https://developer.spotify.com/dashboard → Create App → Client ID/Secret 복사 |
| 설정 | Redirect URI 불필요 (Client Credentials Flow) |
| 비용 | 무료 |

### 7. Naver Search

| 변수 | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` |
|------|------------------------------------------|
| 용도 | 뉴스/블로그 검색, DataLab 트렌드 분석 |
| 발급 | https://developers.naver.com → 애플리케이션 등록 → 검색 API 선택 → Client ID/Secret 복사 |
| 비용 | 무료 (25,000 req/일) |

---

## 선택 (Optional) — 기능별

### 트렌드 수집

| 변수 | 용도 | 발급 | 비용 |
|------|------|------|------|
| `YOUTUBE_API_KEY` | 유튜브 인기 동영상 트렌드 | [Google Cloud Console](https://console.cloud.google.com) → API 및 서비스 → 사용자 인증정보 → API 키 생성 → YouTube Data API v3 활성화 | 무료 10,000 units/일 |
| `BRAVE_SEARCH_API_KEY` | 웹 검색 (RAG 파이프라인) | https://brave.com/search/api → 가입 | 무료 2,000 queries/월 |
| `TAVILY_API_KEY` | 웹 검색 (Brave 대안) | https://tavily.com → 가입 → API 키 | 무료 1,000 queries/월 |

### 이미지 생성

| 변수 | 용도 | 발급 | 비용 |
|------|------|------|------|
| `FAL_KEY` | Flux 이미지 생성 (DALL-E 대안) | https://fal.ai → Dashboard → Keys | 종량제 (~$0.01/img) |
| `PEXELS_API_KEY` | 스톡 이미지 (Unsplash 백업) | https://www.pexels.com/api → 가입 | 무료 |

### SNS 발행 (OAuth 2.0)

각 플랫폼별 OAuth 앱을 생성하고 Client ID/Secret을 설정.
`OAUTH_CALLBACK_BASE_URL`을 배포 URL로 변경 필요 (예: `https://mytypemusic.vercel.app`).

| 변수 | 플랫폼 | 발급 | 참고 |
|------|--------|------|------|
| `META_APP_ID`, `META_APP_SECRET` | Threads, Instagram | https://developers.facebook.com → 앱 만들기 | 비즈니스 인증 필요. `META_WEBHOOK_VERIFY_TOKEN`도 설정 |
| `X_CLIENT_ID`, `X_CLIENT_SECRET` | X (Twitter) | https://developer.x.com → Developer Portal → 프로젝트 생성 | Free: 월 1,500 트윗 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | YouTube 업로드 | Google Cloud Console → OAuth 2.0 클라이언트 ID | YouTube Data API v3 활성화 필요 |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | LinkedIn | https://www.linkedin.com/developers/apps → 앱 생성 | Share on LinkedIn 권한 요청 |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | TikTok | https://developers.tiktok.com → 앱 등록 | Content Posting API 신청 |
| `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID` | Instagram Graph API | https://developers.facebook.com → Instagram Graph API | Long-lived Token + 비즈니스 계정 |

### 영상 렌더링 (Remotion Lambda)

| 변수 | 용도 |
|------|------|
| `REMOTION_AWS_REGION` | AWS Lambda 리전 |
| `REMOTION_FUNCTION_NAME` | Lambda 함수 이름 |
| `REMOTION_SERVE_URL` | Remotion 번들 URL |

사전 작업:
```bash
npx remotion lambda functions deploy
npx remotion lambda sites create src/remotion/index.ts
```

---

## 인프라/보안 (자동 생성)

| 변수 | 용도 | 비고 |
|------|------|------|
| `SNS_TOKEN_ENCRYPTION_KEY` | OAuth 토큰 암호화 (64자 hex) | 직접 생성: `openssl rand -hex 32` |
| `CRON_SECRET` | Vercel Cron Job 인증 | 직접 생성: `openssl rand -hex 24` |

---

## Vercel 배포 체크리스트

1. Vercel Dashboard → 프로젝트 → Settings → Environment Variables
2. 최소한 다음 변수를 설정:
   - `DATABASE_URL`
   - `OPENAI_API_KEY`
   - `SITE_PASSWORD`
   - `SNS_TOKEN_ENCRYPTION_KEY`
   - `CRON_SECRET`
3. `OAUTH_CALLBACK_BASE_URL`을 배포 URL로 변경:
   ```
   https://mytypemusic.vercel.app
   ```
4. 설정 후 **Redeploy** 필요 (환경변수는 다음 배포부터 적용)
