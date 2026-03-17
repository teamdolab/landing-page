# 배포 가이드 (Vercel)

## 1. Vercel 연결

1. [vercel.com](https://vercel.com) 로그인
2. **Add New** → **Project**
3. GitHub 저장소 선택 후 **Import**

## 2. 환경 변수 설정

Vercel 프로젝트 → **Settings** → **Environment Variables**에서 추가:

| 이름 | 값 | 비고 |
|------|-----|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase API → service_role secret |
| `ADMIN_PASSWORD` | (비밀번호) | Admin/Control 로그인용 |

> Supabase 대시보드 → Project Settings → API에서 확인

## 3. 배포

- GitHub push 시 자동 배포
- 또는 Vercel 대시보드에서 **Redeploy**

## 4. 배포 후 URL

- Admin: `https://your-app.vercel.app/admin`
- Control: `https://your-app.vercel.app/game/control`
- Display: `https://your-app.vercel.app/game/display`
- Demo: `https://your-app.vercel.app/game/control/demo` (데모 컨트롤)

## 5. NFC 로그인 배포 시 안 될 때

**증상**: 로컬에서는 NFC 태그 시 등록되는데, 배포 환경에서는 안 됨.

**확인 사항**:
1. **Vercel 환경 변수**  
   Settings → Environment Variables에서 다음이 **모두** 설정되어 있는지 확인:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` ← API 라우트용 (필수)

2. **변경 후 재배포**  
   환경 변수 추가/수정 후에는 **Redeploy**가 필요합니다.

3. **에러 메시지 확인**  
   NFC 화면에 표시되는 메시지를 확인하세요:
   - "Supabase 연결 오류..." → 환경 변수 누락/오류
   - "등록되지 않은 플레이어 카드입니다." → `player_cards` 테이블에 NFC ID 미등록
   - "게임을 찾을 수 없습니다." → gameId 불일치 또는 게임 미생성
