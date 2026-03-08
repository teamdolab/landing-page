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
