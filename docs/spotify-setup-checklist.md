# Spotify Developer Dashboard 설정 체크리스트

## 현재 상황

| 항목 | 상태 |
|------|------|
| Token 발급 (`/api/token`) | 200 OK |
| Web API 호출 (`/v1/search` 등) | **403 Forbidden** |
| 에러 메시지 | `"the user may not be registered"` |

> 인증(token)은 정상이지만, 모든 데이터 API 호출이 403으로 차단됨

---

## 체크리스트

### 1. Web API 활성화 확인

- Dashboard → 앱 선택 → **Settings**
- **APIs** 섹션에서 **"Web API"** 체크 여부 확인
- 체크 안 되어 있으면 활성화 후 **Save**

### 2. User Management 이메일 확인

- Dashboard → 앱 선택 → **User Management**
- 등록된 이메일이 **Spotify 로그인 계정 이메일**과 정확히 일치하는지 확인
  - Gmail 로그인이면 Gmail 주소
  - Facebook 연동이면 Facebook에 연결된 이메일
  - `+` alias (예: `user+test@gmail.com`) 주의
- 일치하지 않으면 삭제 후 올바른 이메일로 재등록

### 3. App Status 확인

- Dashboard → 앱 선택 → 상단에 **Development Mode** 표시 확인
- Development Mode 제한사항:
  - **최대 25명**의 등록 사용자만 API 접근 가능
  - Client Credentials flow에서도 이 제한이 적용될 수 있음

### 4. Redirect URI (참고)

- Client Credentials flow에서는 불필요하지만, 설정이 잘못되면 영향을 줄 수 있음
- Settings → **Redirect URIs** 에 아무 값이라도 하나 등록되어 있는지 확인
  - 예: `http://localhost:3000/callback`

### 5. Extended Quota Mode 요청 (위 항목 모두 확인 후에도 403일 경우)

- Dashboard → 앱 선택 → **Request Extension**
- App Description, 사용 목적 등 작성 후 제출
- Spotify 심사 후 승인 (보통 며칠 소요)

---

## 검증 방법

설정 수정 후 아래 명령어로 테스트:

```bash
cd /c/Users/pjhic/Projects/Web_magazine
export $(grep -v '^#' .env | grep '=' | xargs)

# 1. 토큰 발급 테스트
curl -s -X POST https://accounts.spotify.com/api/token \
  -d "grant_type=client_credentials&client_id=$SPOTIFY_CLIENT_ID&client_secret=$SPOTIFY_CLIENT_SECRET"

# 2. 검색 API 테스트 (위에서 받은 access_token 사용)
curl -s "https://api.spotify.com/v1/search?q=thornapple&type=artist&limit=1" \
  -H "Authorization: Bearer <access_token>"
```

검색 API가 200을 반환하면 CLI 테스트:

```bash
export $(grep -v '^#' .env | grep '=' | xargs) && \
npx tsx agents/topic-intelligence/cli.ts spotify-prefetch \
  --prompt "쏜애플" \
  --out /tmp/spotify-prefetch-test.json
```
