# 프로젝트 현황 정리 (비개발자용)

> 이 문서는 `landing-page` 프로젝트의 현재 상태를 개발 지식이 없어도 이해할 수 있게 정리한 것입니다.
> 각 항목 끝에는 **"이게 뭐냐면..."** 한 줄 설명이 붙어 있습니다.

---

## 1. 기술 스택

`package.json`을 분석한 결과, 이 프로젝트가 사용하는 핵심 도구들입니다.

| 라이브러리 | 버전 | 역할 (한 줄) |
|---|---|---|
| **Next.js** | 15.x | 웹사이트의 페이지·서버 기능을 모두 담당하는 핵심 뼈대 |
| **React** | 19.x | 화면(버튼, 카드 등)을 조립하는 기본 도구 |
| **TypeScript** | 5.x | 오류를 미리 잡아주는 안전장치가 붙은 자바스크립트 |
| **Supabase (supabase-js)** | 2.x | 데이터 저장·실시간 통신을 맡는 클라우드 데이터베이스 연결 도구 |
| **Tailwind CSS** | 3.4 | 화면 디자인(색·여백·크기)을 빠르게 입히는 스타일 도구 |
| **Framer Motion** | 12.x | 화면에 움직이는 애니메이션 효과를 주는 도구 |
| **lucide-react** | 0.563 | 칼·눈·해골 같은 깔끔한 아이콘 모음 |
| **qrcode.react** | 4.x | QR 코드를 생성해 화면에 보여주는 도구 |

> **이게 뭐냐면...** 이 사이트는 "Next.js + React"라는 가장 대중적인 조합으로 만들어졌고, 데이터는 "Supabase"라는 클라우드 창고에 보관하며, 디자인은 "Tailwind", 움직임은 "Framer Motion"이 담당합니다.

---

## 2. 폴더 구조 (3레벨)

```
landing-page/
├── app/                  # 모든 화면과 서버 기능이 들어있는 메인 폴더
│   ├── admin/            # 관리자 페이지 (신청 현황·세션 관리)
│   ├── api/              # 서버 기능 (데이터 저장/조회 처리)
│   ├── feedback/         # 참가자 설문/피드백 화면
│   ├── game/             # 게임 관련 화면 전체
│   │   ├── control/      # 진행자(운영자)용 게임 컨트롤 화면
│   │   ├── display/      # 관객 송출용 화면 (포커 게임)
│   │   ├── edit/         # 게임 데이터 수정 화면
│   │   └── game_0b/      # '수송선게임' 전용 화면 모음
│   ├── login/            # 사용자 로그인 화면
│   └── logout/           # 게임 종료/퇴장 처리 화면
├── lib/                  # 여러 화면이 공통으로 쓰는 기능·계산 로직
├── public/               # 이미지·오디오 등 정적 파일 (캐릭터 그림, 효과음)
├── scripts/              # 보조 실행 스크립트
└── (각종 .sql / .md)     # 데이터베이스 설정 파일과 문서들
```

> **이게 뭐냐면...** `app` 폴더가 사이트의 심장이고, 그 안에서 `game`은 게임 화면들, `api`는 보이지 않는 서버 처리, `lib`는 공통 계산기, `public`은 그림·소리 보관함입니다.

---

## 3. 페이지(라우트) 목록

사용자/운영자가 실제로 접속할 수 있는 화면 경로들입니다.

| 경로 (URL) | 화면 설명 |
|---|---|
| `/` | 메인 랜딩 페이지 (서비스 소개) |
| `/login` | 사용자 로그인 |
| `/logout` | 게임 종료·퇴장 처리 |
| `/admin` | 관리자 대시보드 (신청·세션 관리) |
| `/feedback/deep` | 참가자 심화 피드백 설문 |
| `/game/control` | **진행자용 게임 세션 목록** (핵심) |
| `/game/control/[gameId]` | **진행자용 실시간 게임 컨트롤** (핵심) |
| `/game/control/demo` | 컨트롤 화면 데모 |
| `/game/display` | 포커 게임 관객 송출 화면 |
| `/game/display/result` | 포커 게임 결과 송출 화면 |
| `/game/edit/[gameId]` | 게임 데이터 수동 수정 |
| `/game/game_0b/host` | 수송선게임 진행자 화면 |
| `/game/game_0b/display` | 수송선게임 관객 송출 화면 |
| `/game/game_0b/testroom` | 수송선게임 플레이어 단말 (NFC 태깅·액션) |

핵심 파일 위치:
- `/admin` → `app/admin/page.tsx`
- `/game/control` → `app/game/control/page.tsx` (세션 목록)
- `/game/control/[gameId]` → `app/game/control/[gameId]/page.tsx` (실시간 진행)

> **이게 뭐냐면...** `[gameId]` 처럼 대괄호가 붙은 경로는 "게임마다 주소가 달라지는" 화면이라는 뜻입니다. 운영자는 주로 `/game/control`에서, 관객은 `/display` 화면을, 참가자는 `/testroom` 화면을 봅니다.

---

## 4. API / 백엔드

화면 뒤에서 데이터를 저장하고 처리하는 서버 기능 목록입니다. (총 27개)

**관리자 (`/api/admin/...`)**
| 엔드포인트 | 역할 |
|---|---|
| `admin/login` | 관리자 비밀번호 로그인 |
| `admin/sessions` | 게임 세션 목록 조회·생성 |
| `admin/sessions/[sessionId]` | 특정 세션 조회·수정·삭제 |
| `admin/apply` | 참가 신청 목록 조회 |
| `admin/apply/[applyId]` | 특정 신청 상태 변경 |

**일반 / 회원**
| 엔드포인트 | 역할 |
|---|---|
| `signup` | 회원 가입 |
| `feedback/deep` | 심화 피드백 저장 |

**게임 공통 (`/api/game/...`)**
| 엔드포인트 | 역할 |
|---|---|
| `game/create` | 새 게임 생성 |
| `game/[gameId]` | 게임 상태 조회 |
| `game/[gameId]/update` | 게임 상태 수정 |
| `game/[gameId]/edit` | 게임 데이터 편집 |
| `game/[gameId]/reset` | 게임 초기화 |
| `game/[gameId]/undo` | 직전 동작 되돌리기 |
| `game/[gameId]/go-to-step` | 특정 단계로 이동 |
| `game/[gameId]/register-player` | NFC로 플레이어 등록 |
| `game/[gameId]/logout-lookup` | 퇴장 시 카드 조회 |
| `game/[gameId]/logout-complete` | 퇴장·크레딧 정산 완료 |
| `game/session/[sessionId]` | 세션 단위 게임 조회 |

**수송선게임 전용 (`/api/game/game_0b/...`)**
| 엔드포인트 | 역할 |
|---|---|
| `game_0b/init` | 수송선게임 초기 세팅 |
| `game_0b/session/[sessionId]` | 게임 현재 상태 조회 |
| `game_0b/session/[sessionId]/events` | 게임 이벤트 기록 조회 |
| `game_0b/event` | 이벤트 기록 추가 |
| `game_0b/advance-phase` | 낮↔밤 등 단계 전환 |
| `game_0b/night-action` | 밤 액션(암살·약탈 등) 처리 |
| `game_0b/transfer` | 코어(자원) 교환 처리 |
| `game_0b/nfc-lookup` | NFC 카드 → 플레이어 번호 변환 |
| `game_0b/reset` | 수송선게임 초기화 |

> **이게 뭐냐면...** API는 "주방"이라고 보면 됩니다. 화면(손님)이 "이 동작 해줘"라고 주문하면, 이 API들이 데이터베이스(창고)에서 재료를 꺼내 처리하고 결과를 돌려줍니다.

---

## 5. 데이터베이스

데이터 저장은 **Supabase**(클라우드 데이터베이스)를 사용합니다.

**연결 초기화 위치:**
- `lib/supabase.ts` — 브라우저(화면)용 연결. 일반 권한.
- `lib/supabase-admin.ts` — 서버(API)용 연결. 보안 규칙을 우회하는 강력 권한(`service_role`).

**주요 테이블과 용도:**
| 테이블 | 용도 |
|---|---|
| `sessions` | 게임 세션(회차) 정보 |
| `user_info` | 회원 정보 (이름·전화·크레딧 등) |
| `apply` | 참가 신청 내역 |
| `player_cards` | NFC 카드 ↔ 플레이어 번호 매칭 |
| `game_participants` | 각 게임의 참가자 명단 |
| `deep_feedback` | 참가자 심화 피드백 |
| `game_0a` | 포커 게임의 진행 상태 |
| `game_0b` | 수송선게임의 진행 상태(스냅샷) |
| `game_0b_event` | 수송선게임의 모든 동작 기록(되돌리기·히스토리용) |

> **이게 뭐냐면...** 데이터는 9개 정도의 "장부(테이블)"에 나눠 적힙니다. 회원 장부, 신청 장부, 게임 진행 장부 등이 따로 있고, 특히 수송선게임은 현재 상태(`game_0b`)와 모든 행동 기록(`game_0b_event`)을 따로 보관합니다.

---

## 6. 인증 / 로그인

이 프로젝트에는 **3가지 로그인 방식**이 섞여 있습니다.

1. **관리자/진행자 로그인** — 비밀번호(`ADMIN_PASSWORD`) 입력 → 서명된 쿠키(`admin_session`)로 24시간 유지.
   - 핵심 파일: `lib/admin-auth.ts`, `app/api/admin/login/route.ts`
2. **일반 회원 로그인** — 닉네임/비밀번호로 로그인.
   - 핵심 파일: `app/login/page.tsx`, `app/api/signup/route.ts`
3. **NFC 카드 태깅** — 게임 현장에서 카드를 리더기에 태깅 → 플레이어 식별.
   - 핵심 파일: `app/api/game/game_0b/nfc-lookup/route.ts`

> **이게 뭐냐면...** 운영자는 "비밀번호", 회원은 "닉네임+비번", 게임 현장 참가자는 "NFC 카드 태깅"으로 각각 들어옵니다. 이메일/소셜/매직링크 같은 방식은 쓰지 않습니다.

> ⚠️ 참고: 일반 회원 비밀번호는 현재 **평문 비교**(암호화 안 됨) 상태이며, 코드에 "배포 시 암호화 필요" TODO가 남아 있습니다. (아래 10번 참고)

---

## 7. 상태 관리

별도의 상태 관리 라이브러리(Redux, Zustand 등)는 **사용하지 않습니다.**

- 기본적으로 React의 **`useState` / `useEffect`** 로 화면별 상태를 관리합니다.
- 게임 실시간 데이터는 **커스텀 훅 `lib/use-game-0b.ts`** 가 담당합니다.
  - Supabase 실시간 구독 + 3초마다 자동 새로고침(폴링)을 함께 사용해 안정적으로 최신 상태를 가져옵니다.

> **이게 뭐냐면...** 복잡한 전역 상태 도구 없이, React 기본 기능과 직접 만든 훅 하나로 게임 상태를 실시간 동기화합니다. 단순하지만 이 프로젝트 규모엔 충분한 방식입니다.

---

## 8. 게임 진행 툴 (`/game/control`) 핵심 파일

운영자가 게임을 실시간으로 진행하는 데 관련된 주요 파일들입니다.

| 파일 | 역할 |
|---|---|
| `app/game/control/page.tsx` | 게임 세션 목록 + 진입점 (포커/수송선 구분) |
| `app/game/control/[gameId]/page.tsx` | 포커 게임 실시간 진행 컨트롤 (약 2,000줄, 가장 큰 파일) |
| `app/game/game_0b/host/page.tsx` | 수송선게임 진행자 컨트롤 화면 |
| `lib/use-game-0b.ts` | 수송선게임 실시간 상태 동기화 훅 |
| `lib/game-0b-resolve.ts` | 밤 액션 우선순위 처리·결과 계산 로직 |
| `lib/game-0b-result.ts` | 게임 최종 결과(탑승자·승패) 계산 |
| `lib/game-0b-types.ts` | 수송선게임 데이터 타입·액션 정의 |
| `lib/score-utils.ts` | 포커 게임 라운드 점수 계산 |
| `lib/session-game-kind.ts` | 세션이 포커인지 수송선인지 구분 |

> **이게 뭐냐면...** 운영자 화면의 핵심은 `control/[gameId]/page.tsx`(포커)와 `game_0b/host`(수송선)이고, 실제 게임 규칙 계산은 `lib/` 폴더의 `game-0b-resolve`·`game-0b-result` 같은 파일들이 도맡습니다.

---

## 9. 환경변수 (`.env`)

`.env.example` 기준, 필요한 키 이름은 다음과 같습니다. **(값은 보안상 비공개)**

| 키 이름 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 데이터베이스 주소 (브라우저용) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 일반 접근 키 (브라우저용) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 관리자 접근 키 (서버 전용, 매우 민감) |
| `ADMIN_PASSWORD` | 관리자/진행자 로그인 비밀번호 |

> **이게 뭐냐면...** 이 4개는 "비밀번호·열쇠 모음"입니다. `NEXT_PUBLIC_`이 붙은 건 브라우저에 공개돼도 되는 것이고, 나머지 2개(`SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`)는 절대 외부에 노출되면 안 되는 민감 정보입니다.

---

## 10. 알려진 문제 (기술 부채)

코드에서 발견된 명시적 표시 및 명백한 개선 필요 지점입니다.

1. **회원 비밀번호 평문 비교** — `app/login/page.tsx` 120번째 줄
   - 주석: `// TODO: 실제 배포 시 bcrypt로 해시 비교. 테스트용 평문 비교`
   - 비밀번호가 암호화되지 않은 채 비교되고 있어, 실제 운영 전 반드시 해시 처리 필요.
2. **거대 단일 파일** — `app/game/control/[gameId]/page.tsx`가 약 2,000줄로 매우 큼. 유지보수가 어려워 분리(리팩터링) 권장.
3. **실시간 + 폴링 중복** — `use-game-0b.ts`가 실시간 구독과 3초 폴링을 동시에 사용. 안정성은 높지만 불필요한 서버 요청이 발생할 수 있음.
4. **빈 SQL 파일** — `supabase-nfc-login.sql` 등 일부 설정 파일이 비어 있어, 실제 DB 구조와 문서가 어긋날 수 있음.
5. **분산된 문서** — `DEPLOY.md`, `WORK_SUMMARY.md`, `TODO-TOMORROW.md` 등 문서가 여러 개로 흩어져 있어 최신 정보 파악이 어려움.

> **이게 뭐냐면...** 가장 시급한 건 "회원 비밀번호 암호화"이고, 그다음은 너무 커진 진행 화면 파일을 잘게 나누는 일입니다. 나머지는 당장 위험하진 않지만 정리하면 좋은 항목들입니다.

---

## 11. 한 줄 요약

> 이 프로젝트는 **오프라인 보드게임/방탈출 형식의 이벤트를 운영하기 위한 웹 플랫폼**으로, 참가자 모집·신청·로그인부터 현장에서 진행되는 두 가지 게임(**포커형 `game_0a`**, **수송선게임 `game_0b`**)의 실시간 진행·관객 송출·NFC 카드 인증·결과 정산까지를 하나로 묶은 시스템입니다. Next.js와 React로 만들어졌고 Supabase 클라우드에 데이터를 저장하며, 운영자용 컨트롤 화면·관객용 송출 화면·참가자용 단말 화면이 실시간으로 동기화되어 동작합니다.
