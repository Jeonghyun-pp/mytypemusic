# SNS 연동 기능 셋업 가이드

> Mirra 기능 흡수 후 **사람이 직접 수행해야 하는 작업** 목록입니다.
> AI가 자동 완료한 항목: ✅ / 사람이 해야 할 항목: 🔧

---

## ✅ AI가 완료한 작업

| 항목 | 상태 |
|------|------|
| 17개 Prisma 모델 추가 | ✅ 완료 |
| DB 테이블 생성 (`prisma db push`) | ✅ 완료 |
| OAuth 연동 코드 (Threads, Instagram, X) | ✅ 완료 |
| OAuth 연동 코드 (LinkedIn, WordPress, YouTube, TikTok) | ✅ 완료 |
| SNS 발행 어댑터 (7개 플랫폼) | ✅ 완료 |
| Job Queue 시스템 + 11개 핸들러 | ✅ 완료 |
| Vercel Cron 설정 (vercel.json) | ✅ 완료 (5분 프로세서 + 자정 리셋) |
| 65+ API 엔드포인트 | ✅ 완료 |
| 8개 새 스튜디오 페이지 + UI | ✅ 완료 |
| 사이드바 네비게이션 전환 | ✅ 완료 |
| `SNS_TOKEN_ENCRYPTION_KEY` 생성 | ✅ .env에 추가됨 |
| `CRON_SECRET` 생성 | ✅ .env에 추가됨 |
| TypeScript 빌드 검증 | ✅ 0 에러 |
| Next.js 프로덕션 빌드 검증 | ✅ 성공 |
| `callGpt` 헬퍼 (lib/llm.ts) | ✅ 완료 |
| 블로그 작성기 (outline → content) | ✅ 완료 |
| 키워드 캠페인 검색+포스팅 | ✅ 완료 |
| 비디오/릴스 렌더링 (Remotion Lambda) | ✅ 완료 |
| 캐러셀→비디오 변환 컴포지션 | ✅ 완료 |

---

## 🔧 사람이 해야 할 작업

### 1. Meta Developer 앱 등록 (Threads + Instagram)

**소요시간**: 약 30분
**URL**: https://developers.facebook.com/

1. Facebook Developer 계정 로그인
2. "앱 만들기" → 앱 유형: "비즈니스"
3. 앱 설정에서 다음 제품 추가:
   - **Threads API** (threads_manage_posts, threads_read_replies 스코프)
   - **Instagram Graph API** (instagram_content_publish, instagram_basic 스코프)
4. "설정 > 기본 설정"에서 확인:
   - **앱 ID** → `.env`의 `META_APP_ID`에 입력
   - **앱 시크릿 키** → `.env`의 `META_APP_SECRET`에 입력
5. "Facebook 로그인 > 설정"에서 OAuth 리디렉션 URL 추가:
   - 로컬: `http://localhost:3100/api/sns/callback/threads`
   - 로컬: `http://localhost:3100/api/sns/callback/instagram`
   - 프로덕션: `https://[your-domain]/api/sns/callback/threads`
   - 프로덕션: `https://[your-domain]/api/sns/callback/instagram`

> ⚠️ Threads API는 2024년부터 공개됨. 앱 검수 전에는 개발자 계정만 테스트 가능.

### 2. X (Twitter) Developer 앱 등록

**소요시간**: 약 20분
**URL**: https://developer.x.com/

1. Developer Portal 로그인
2. "Projects & Apps" → 새 앱 생성
3. OAuth 2.0 활성화:
   - Type: **Web App**
   - Callback URL: `http://localhost:3100/api/sns/callback/x`
   - 프로덕션: `https://[your-domain]/api/sns/callback/x`
4. 키 확인:
   - **Client ID** → `.env`의 `X_CLIENT_ID`에 입력
   - **Client Secret** → `.env`의 `X_CLIENT_SECRET`에 입력
5. 앱 권한 설정: `tweet.read`, `tweet.write`, `users.read`

> ⚠️ X API Free tier는 월 1,500 트윗 읽기 + 쓰기 제한

### 3. LinkedIn Developer 앱 등록

**소요시간**: 약 20분
**URL**: https://www.linkedin.com/developers/apps

1. "Create app" 클릭
2. Products 탭에서 **"Share on LinkedIn"** 과 **"Sign In with LinkedIn using OpenID Connect"** 추가
3. Auth 탭에서:
   - **Client ID** → `.env`의 `LINKEDIN_CLIENT_ID`
   - **Client Secret** → `.env`의 `LINKEDIN_CLIENT_SECRET`
   - Redirect URL: `http://localhost:3100/api/sns/callback/linkedin`
   - 프로덕션: `https://[your-domain]/api/sns/callback/linkedin`

### 4. WordPress.com 앱 등록

**소요시간**: 약 10분
**URL**: https://developer.wordpress.com/apps/

1. "Create New Application" 클릭
2. Redirect URL: `http://localhost:3100/api/sns/callback/wordpress`
3. 앱 정보 확인:
   - **Client ID** → `.env`의 `WORDPRESS_COM_CLIENT_ID`
   - **Client Secret** → `.env`의 `WORDPRESS_COM_CLIENT_SECRET`

> Self-hosted WordPress는 Application Password 방식도 지원 예정

### 5. Google (YouTube) Developer 앱 등록

**소요시간**: 약 20분
**URL**: https://console.cloud.google.com/

1. API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID 만들기
2. 유형: **웹 애플리케이션**
3. 승인된 리디렉션 URI:
   - `http://localhost:3100/api/sns/callback/youtube`
   - `https://[your-domain]/api/sns/callback/youtube`
4. API 라이브러리에서 **YouTube Data API v3** 활성화
5. 키 확인:
   - **Client ID** → `.env`의 `GOOGLE_CLIENT_ID`
   - **Client Secret** → `.env`의 `GOOGLE_CLIENT_SECRET`

### 6. TikTok Developer 앱 등록

**소요시간**: 약 20분
**URL**: https://developers.tiktok.com/

1. "Manage apps" → 새 앱 생성
2. Products에서 **"Content Posting API"** 추가
3. OAuth 설정:
   - Redirect URL: `http://localhost:3100/api/sns/callback/tiktok`
   - 프로덕션: `https://[your-domain]/api/sns/callback/tiktok`
4. 키 확인:
   - **Client Key** → `.env`의 `TIKTOK_CLIENT_KEY`
   - **Client Secret** → `.env`의 `TIKTOK_CLIENT_SECRET`

> ⚠️ TikTok은 비디오 전용 플랫폼. 이미지/텍스트만 있는 게시물은 발행 불가

### 7. Remotion Lambda 배포 (비디오 렌더링)

**소요시간**: 약 30분
**사전 조건**: AWS 계정 + IAM 자격증명

1. AWS IAM에서 Remotion용 사용자 생성 (정책: [Remotion 문서](https://www.remotion.dev/docs/lambda/permissions) 참조)
2. AWS 자격증명을 환경에 설정:
   ```
   export AWS_ACCESS_KEY_ID=...
   export AWS_SECRET_ACCESS_KEY=...
   ```
3. Lambda 함수 배포:
   ```bash
   npx remotion lambda functions deploy --memory=2048 --timeout=240
   ```
4. 사이트 번들 배포:
   ```bash
   npx remotion lambda sites create apps/studio/src/remotion/index.ts --site-name=studio
   ```
5. 출력된 값을 `.env`에 입력:
   - `REMOTION_AWS_REGION` (예: `ap-northeast-2`)
   - `REMOTION_FUNCTION_NAME` (예: `remotion-render-...`)
   - `REMOTION_SERVE_URL` (예: `https://remotionlambda-...s3.amazonaws.com/sites/studio/index.html`)

> 비디오 렌더링 없이도 나머지 기능은 정상 동작합니다.

### 8. Vercel 환경변수 등록

**소요시간**: 약 10분
**URL**: https://vercel.com/[project]/settings/environment-variables

다음 환경변수를 Vercel 프로젝트에 추가:

```
# 기존 (필수)
SNS_TOKEN_ENCRYPTION_KEY=fc4e85d840be36fd81dbc26172bedffcfc734ffa875f21c593290edfa7b9be6c
CRON_SECRET=40d24d77081448109ded9e81f7139ff1a159933476cbb253
OAUTH_CALLBACK_BASE_URL=https://[your-vercel-domain]

# Meta (Threads + Instagram)
META_APP_ID=[발급한 값]
META_APP_SECRET=[발급한 값]

# X (Twitter)
X_CLIENT_ID=[발급한 값]
X_CLIENT_SECRET=[발급한 값]

# LinkedIn
LINKEDIN_CLIENT_ID=[발급한 값]
LINKEDIN_CLIENT_SECRET=[발급한 값]

# WordPress.com
WORDPRESS_COM_CLIENT_ID=[발급한 값]
WORDPRESS_COM_CLIENT_SECRET=[발급한 값]

# Google (YouTube)
GOOGLE_CLIENT_ID=[발급한 값]
GOOGLE_CLIENT_SECRET=[발급한 값]

# TikTok
TIKTOK_CLIENT_KEY=[발급한 값]
TIKTOK_CLIENT_SECRET=[발급한 값]

# Remotion Lambda (비디오 렌더링, 선택)
REMOTION_AWS_REGION=[배포한 리전]
REMOTION_FUNCTION_NAME=[배포한 함수명]
REMOTION_SERVE_URL=[배포한 사이트 URL]
```

> 기존 환경변수(DATABASE_URL, OPENAI_API_KEY 등)는 이미 등록되어 있어야 합니다.

### 4. Vercel 재배포

```bash
git add -A && git commit -m "feat: add Mirra SNS features"
git push
```

Vercel이 자동 배포하면 Cron Job(`/api/jobs/process`, 5분마다)이 활성화됩니다.

### 5. 첫 연동 테스트

배포 후 순서:

1. `/studio/accounts` 접속 → Threads 또는 Instagram "연결" 클릭
2. OAuth 인증 완료 → 계정 목록에 표시 확인
3. `/studio/publish` 접속 → 연결된 계정 선택 → 테스트 글 작성 → "즉시 발행"
4. 해당 SNS에서 실제 게시물 확인

---

## 🔧 선택적 작업 (나중에 해도 됨)

### A. 추가 플랫폼 (Facebook, Pinterest, Telegram)

현재 7개 플랫폼 구현 완료 (Threads, Instagram, X, LinkedIn, WordPress, YouTube, TikTok).
나머지 3개 플랫폼도 동일 패턴으로 추가 가능:
1. `src/lib/sns/platforms/[platform].ts` 에 OAuth 어댑터 추가
2. `src/lib/sns/publish/adapters/[platform].ts` 에 발행 어댑터 추가
3. `src/lib/sns/platforms/index.ts` + `publish/publisher.ts` 등록
4. `AccountsView.tsx`에서 `available: true` 변경
5. 해당 플랫폼의 Developer 앱 등록

### B. Meta Webhooks 설정 (댓글/DM 자동 수신)

Inbox 기능이 실시간으로 동작하려면:
1. Meta Developer 앱 > Webhooks 설정
2. 콜백 URL: `https://[domain]/api/webhooks/meta`
3. 검증 토큰: 아무 문자열 (코드에서 `META_WEBHOOK_VERIFY_TOKEN` 환경변수로 설정)
4. 구독할 이벤트: `comments`, `messages`

### C. 카카오 / 네이버 블로그 연동

한국 플랫폼 지원이 필요하면 별도 OAuth 어댑터 구현 필요:
- 카카오: https://developers.kakao.com/
- 네이버: https://developers.naver.com/

---

## 기능별 사용법 요약

| 페이지 | 기능 | 사전 조건 |
|--------|------|----------|
| `/studio/accounts` | SNS 계정 연결/해제 (7개 플랫폼) | 각 플랫폼 앱 등록 |
| `/studio/import` | URL → SNS 콘텐츠 변환 | 없음 (OpenAI 키만) |
| `/studio/persona` | 글쓰기 스타일 학습 | 없음 |
| `/studio/publish` | 즉시/예약 발행 (7개 플랫폼) | 계정 연결 필요 |
| `/studio/autopilot` | AI 자동 콘텐츠 제안 | 계정 + Cron 활성 |
| `/studio/inbox` | 댓글/DM 관리 | 계정 + Webhooks |
| `/studio/campaigns` | 키워드 검색 + AI 댓글 자동 포스팅 | 계정 + TOS 동의 |
| `/studio/analytics` | 성과 대시보드 + AI 챗 | 계정 + 발행 데이터 |
| `/studio/blog` | 장문 블로그 생성 + WordPress 발행 | OpenAI + WP 계정 |
| `/studio/reels` | 비디오/릴스 편집 + MP4 렌더링 | Remotion Lambda 배포 |

---

## 트러블슈팅

### OAuth 콜백 에러
- `OAUTH_CALLBACK_BASE_URL`이 실제 접속 URL과 일치하는지 확인
- Meta/X 앱 설정의 리디렉션 URL과 일치하는지 확인

### Cron Job이 실행되지 않음
- Vercel에 `CRON_SECRET` 환경변수가 등록되어 있는지 확인
- `vercel.json`의 crons 설정이 배포에 포함되었는지 확인
- Vercel Pro 플랜에서만 Cron이 지원됨 (Hobby는 일 1회 제한)

### DB 연결 에러
- Neon DB가 ap-southeast-1 리전에서 활성 상태인지 확인
- Connection pooler URL을 사용하고 있는지 확인 (`-pooler` 포함)
