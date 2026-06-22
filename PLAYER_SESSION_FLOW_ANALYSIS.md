# DO:LAB 플레이어 입퇴장 및 정산 흐름 분석

## 0. 문서 목적과 확인 범위

이 문서는 현재 코드베이스에서 플레이어 입장/퇴장 흐름이 어떻게 구현되어 있는지, 특히 `session_results` 테이블을 게임과 정산 사이의 표준 인터페이스로 쓸 수 있는지 판단하기 위해 작성한 분석 문서입니다.

- 분석 대상: 현재 저장소의 코드와 SQL 파일
- 코드 수정/리팩터링: 하지 않음
- 비밀키/환경변수 값/실제 회원 데이터: 확인하거나 출력하지 않음
- 실제 Supabase DB 접속: 환경변수 없음으로 확인 불가
- 주의: `player_cards`, `game_participants`의 최종 `CREATE TABLE` 문은 저장소에서 완전한 형태로 확인되지 않습니다. 따라서 해당 테이블은 코드가 요구하는 컬럼과 별도 마이그레이션에서 확인되는 컬럼을 나누어 적었습니다.

이게 뭐냐면... 이 문서는 “지금 코드가 실제로 무엇을 읽고 쓰는지”를 코드 근거만으로 정리한 현재 상태 지도입니다.

---

## 1. 포커 입장(로그인) 흐름: NFC 태깅 -> register-player API

### 전체 흐름

1. 운영자가 포커 게임 컨트롤 화면에서 로그인 화면을 엽니다.
   - 파일: `app/game/control/page.tsx`
   - 링크: `/login?gameId=${game.game_id}`
   - 같은 링크가 포커 상세 컨트롤에도 있습니다: `app/game/control/[gameId]/page.tsx`
2. 참가자는 로그인 화면에서 PIN, 닉네임, 비밀번호를 거친 뒤 NFC 카드를 태깅합니다.
   - 파일: `app/login/page.tsx`
   - 함수/흐름: `processNFC`
   - 호출 API: `POST /api/game/[gameId]/register-player`
   - 요청 본문: `{ user_id, nfc_id }`
3. 서버 API가 NFC 값을 정리하고, 카드 번호를 찾고, 포커 게임 참가자로 등록합니다.
   - 파일: `app/api/game/[gameId]/register-player/route.ts`
   - 함수: `POST`

### register-player API가 하는 일

`app/api/game/[gameId]/register-player/route.ts`의 `POST` 함수 기준입니다.

1. `gameId`, `user_id`, `nfc_id`가 모두 있는지 확인합니다.
2. NFC 입력값을 정리합니다.
   - 한글 키보드 상태에서 들어온 `ㅊ`, `ㅁ` 같은 문자를 `c`, `a` 등으로 치환합니다.
   - 그 뒤 hex 문자만 남기고 소문자로 만듭니다.
3. `player_cards`에서 NFC 카드에 대응되는 `player_number`를 조회합니다.
   - 조회 코드: `.from('player_cards').select('player_number').eq('nfc_id', nfcIdClean).single()`
   - 여기서 `player_cards`는 “실물 카드 -> 플레이어 번호” 장부로 쓰입니다.
   - 이 API는 `player_cards`에 새 값을 쓰지 않습니다.
4. `game_0a`에서 해당 포커 게임을 조회합니다.
   - 조회 코드: `.from('game_0a').select('game_id, player_count').eq('game_id', gameId).single()`
   - `player_number`가 게임의 `player_count`보다 크면 등록을 거부합니다.
5. 같은 게임에서 같은 `player_number`가 이미 `active`이면 이전 행을 `completed`로 바꿉니다.
   - 대상 테이블: `game_participants`
   - 조건: `game_id`, `player_number`, `status = 'active'`
   - 업데이트: `{ status: 'completed' }`
6. 같은 게임에서 같은 `user_id`가 이미 `active`이면 이전 행을 `completed`로 바꿉니다.
   - 조건: `game_id`, `user_id`, `status = 'active'`
7. 새 참가자 행을 `game_participants`에 INSERT합니다.
   - INSERT 값:
     - `game_id`: URL의 `gameId`, 즉 `game_0a.game_id`
     - `player_number`: `player_cards`에서 찾은 번호
     - `user_id`: 로그인한 회원 ID
     - `status`: `'active'`
8. 방금 INSERT된 `active` 행이 실제로 있는지 다시 조회해 검증합니다.

### player_cards와 game_participants에 기록되는 내용

| 테이블 | 입장 시 읽기/쓰기 | 내용 |
|---|---:|---|
| `player_cards` | 읽기만 함 | `nfc_id`로 `player_number`를 찾음 |
| `game_participants` | 쓰기 함 | `game_id`, `player_number`, `user_id`, `status='active'` 새 행을 추가 |

중요한 점은 `player_cards`가 “이 카드는 몇 번 플레이어 카드인가”만 알려주고, “이 카드가 지금 누구에게 배정되어 있는가”는 `game_participants`의 `active` 행이 표현한다는 점입니다.

이게 뭐냐면... 포커 입장은 “회원이 실물 카드 번호를 빌려 게임 안의 몇 번 플레이어 자리에 들어간다”는 기록을 `game_participants`에 새로 쓰는 절차입니다.

---

## 2. 포커 퇴장(로그아웃) 흐름: logout-lookup -> logout-complete

이 항목이 이번 분석에서 가장 중요합니다.

### 전체 흐름

1. 운영자가 포커 게임 컨트롤 화면에서 로그아웃 화면을 엽니다.
   - 링크: `/logout?gameId=${game.game_id}`
2. 참가자가 NFC 카드를 태깅합니다.
   - 파일: `app/logout/page.tsx`
   - 함수/흐름: `processNFC`
   - 호출 API: `POST /api/game/[gameId]/logout-lookup`
3. `logout-lookup`은 “정산 미리보기”를 계산해 화면에 보여줍니다.
   - 닉네임
   - 게임명
   - 플레이어 번호
   - 순위
   - 총점
   - 정산 전 크레딧
   - 획득 크레딧
   - 정산 후 예상 크레딧
4. 참가자가 결과 화면을 지나 피드백 제출 또는 건너뛰기를 누르면 `logout-complete`가 호출됩니다.
   - 파일: `app/logout/page.tsx`
   - 함수/흐름: `finishFeedback`
   - 호출 API: `POST /api/game/[gameId]/logout-complete`
5. `logout-complete`가 실제 크레딧 업데이트와 퇴장 처리를 합니다.

### logout-lookup: 정산 미리보기 위치

파일: `app/api/game/[gameId]/logout-lookup/route.ts`  
함수: `POST`

처리 순서:

1. NFC 입력값 정리
2. `player_cards`에서 `player_number` 조회
3. `game_participants`에서 현재 게임의 `active` 참가자 `user_id` 조회
4. `user_info`에서 `nickname`, `credits` 조회
5. `game_0a`에서 `session_id`, `player_count`, `players`, `final_winners` 조회
6. `sessions`에서 `game_name` 조회
7. `game_0a.players`의 `total_score`를 기준으로 순위를 만들고 크레딧을 계산
8. 계산 결과를 JSON으로 반환

여기서는 DB에 크레딧을 쓰지 않습니다. 화면에 보여줄 “예상 정산표”를 만드는 단계입니다.

### logout-complete: 실제 정산 위치

파일: `app/api/game/[gameId]/logout-complete/route.ts`  
함수: `POST`

실제 정산은 이 API 안에서 일어납니다.

처리 순서:

1. NFC 입력값 정리
2. `player_cards`에서 `player_number` 조회
3. `game_participants`에서 현재 게임의 `active` 참가자 `user_id` 조회
4. `user_info`에서 현재 `credits` 조회
5. `game_0a`에서 `session_id`, `player_count`, `players`, `final_winners`, `created_at` 조회
6. 점수 순위와 우승자를 기준으로 `creditGain` 계산
7. `creditsBefore + creditGain = creditsAfter` 계산
8. `user_info`를 업데이트
   - 업데이트: `{ credits: creditsAfter }`
9. `game_participants`의 해당 active 행을 `completed`로 업데이트
   - 조건: `game_id`, `player_number`, `status='active'`
10. 남은 active 참가자가 0명이면 `session_results`에 게임 결과 요약을 INSERT

### 크레딧 계산 로직은 어디에 있는가?

정확히 나누면 다음과 같습니다.

| 역할 | 위치 | 설명 |
|---|---|---|
| 보상표와 동점 분배 규칙 | `lib/credit-reward.ts`의 `getCreditReward` | 인원수/순위별 크레딧 표, 공동 순위 분배 계산 |
| 플레이어 정렬, 우승자 선택, `creditGain` 산출 | `logout-lookup` API와 `logout-complete` API 내부 | `game_0a.players`, `final_winners`를 읽어 순위표를 만듦 |
| 실제 회원 크레딧 업데이트 | `app/api/game/[gameId]/logout-complete/route.ts` | `user_info.credits`를 `creditsAfter`로 업데이트 |
| 퇴장 상태 처리 | `app/api/game/[gameId]/logout-complete/route.ts` | `game_participants.status`를 `completed`로 변경 |

즉, “상금표/동점 분배 함수”는 `lib/`에 있지만, “누구에게 얼마를 더하고 DB에 저장할지”는 `logout-complete` API 안에 있습니다.

### 보상표 요약

파일: `lib/credit-reward.ts`

`REWARD_TABLE`은 플레이어 수 8~12명에 대해 순위별 크레딧을 정의합니다.

- 8명: 1등 10000, 2등 10000, 3등 5000, 4등 3000
- 9명: 1등 10000, 2등 10000, 3등 5000, 4등 3000, 5등 3000
- 10명: 1등 10000, 2등 10000, 3등 5000, 4등 5000, 5등 3000
- 11명: 1등 10000, 2등 10000, 3등 5000, 4등 5000, 5등 3000, 6등 3000
- 12명: 1등 10000, 2등 10000, 3등 5000, 4등 5000, 5등 3000, 6등 3000, 7등 3000

동점자는 해당 등수들의 상금을 합산한 뒤 인원수로 나누고, 천원 단위로 반올림합니다.

### 중요한 운영상 특징

- `logout-lookup`은 미리보기이고, 실제 크레딧 변경은 하지 않습니다.
- 실제 정산은 `app/logout/page.tsx`의 `finishFeedback`에서 `logout-complete`를 호출할 때 일어납니다.
- 사용자가 결과 화면까지만 보고 피드백/건너뛰기 단계까지 가지 않으면, 코드상 `logout-complete` 호출이 일어나지 않습니다.
- `logout-complete`는 `session_results`를 보고 정산하지 않습니다. 직접 `game_0a`, `game_participants`, `user_info`를 읽어 정산합니다.

이게 뭐냐면... 포커 정산의 진짜 실행 버튼은 `logout-complete`이고, 계산표 일부는 `lib/`에 있지만 실제 돈 장부를 고치는 일은 API가 직접 합니다.

---

## 3. session_results 테이블 스키마와 쓰기 경로

이 항목도 이번 분석의 핵심입니다.

### 스키마 전체

근거 파일: `supabase-session-results.sql`

| 컬럼 | 타입 | 기본값/제약 | 용도 |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | 결과 행의 고유 ID |
| `session_id` | `TEXT` | nullable | 세션 ID. 주석상 소프트 FK로 쓰려는 의도 |
| `game_type` | `TEXT` | `NOT NULL` | 게임 종류. 예: `game_0a`, `game_0b` |
| `started_at` | `TIMESTAMPTZ` | nullable | 게임 시작 시각 |
| `ended_at` | `TIMESTAMPTZ` | nullable | 게임 종료 시각 |
| `duration_seconds` | `INTEGER` | nullable | `ended_at - started_at` 초 단위 |
| `player_count` | `INTEGER` | nullable | 참가 인원 수 |
| `winner_user_ids` | `UUID[]` | nullable | 우승자 `user_info.id` 배열 |
| `result_summary` | `JSONB` | `DEFAULT '{}'::jsonb` | 게임별 추가 결과 데이터 |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | 결과 행 생성 시각 |

인덱스:

- `idx_session_results_session` on `session_id`
- `idx_session_results_game_type` on `game_type`
- `idx_session_results_ended` on `ended_at DESC`

확인된 제약:

- `session_id + game_type` 같은 중복 방지 unique 제약은 없습니다.
- 실제 `sessions` 테이블과 연결되는 DB 외래키도 없습니다.
- UPDATE 경로는 확인되지 않습니다. 현재 코드는 INSERT만 합니다.

### 공통 INSERT 헬퍼

파일: `lib/session-result.ts`

함수:

- `insertSessionResult(payload)`
- `playerNumbersToUserIds(gameId, playerNumbers)`

`insertSessionResult`는 받은 payload를 `session_results`에 INSERT합니다.

INSERT되는 필드:

- `session_id`
- `game_type`
- `started_at`
- `ended_at`
- `duration_seconds`
- `player_count`
- `winner_user_ids`
- `result_summary`

`duration_seconds`는 `startedAt`이 있으면 함수 안에서 계산합니다.

### 포커(game_0a)는 언제 session_results에 INSERT하는가?

파일: `app/api/game/[gameId]/logout-complete/route.ts`  
함수: `POST`

조건:

1. 한 참가자의 로그아웃 정산이 끝난 뒤
2. `game_participants`에서 해당 `game_id`의 `status='active'`가 0명인지 확인
3. 0명이면 `insertSessionResult` 호출

포커의 `result_summary` 예:

```json
{
  "top_score": 0,
  "final_ranking": [
    {
      "player_number": 1,
      "total_score": 0
    }
  ]
}
```

즉, 포커는 “게임이 완료되는 순간”이 아니라 “마지막 플레이어가 로그아웃하는 순간”에 `session_results`를 씁니다.

### 수송선(game_0b)은 언제 session_results에 INSERT하는가?

파일: `app/api/game/game_0b/advance-phase/route.ts`  
함수: `POST`

확인된 INSERT 지점은 2곳입니다.

1. `action === 'reveal_gauge'`
   - 조건: 수송선 게이지 `ship_hull <= 50`
   - 의미: 외계인 승리
   - `result_summary`:
     - `ship_hull_final`
     - `winning_faction: '외계인'`
     - `alien_player_numbers`
2. `action === 'confirm_lifeboat'`
   - 조건: 게이지가 50 초과이고 탑승 인원을 확정
   - 의미: 생존자 또는 반군 계열 결과 확정
   - `result_summary`:
     - `ship_hull_final`
     - `winning_faction`
     - `lifeboat_seats`
     - `lifeboat_count`

수송선은 포커와 달리 로그아웃 시점이 아니라 게임 진행자의 결과 공개/탑승 확정 시점에 `session_results`를 씁니다.

### 게임 결과가 session_results로 들어오는 구조인가?

현재 상태는 “일부 들어온다”가 정확합니다.

| 게임 | 원본 게임 결과 저장소 | session_results 기록 시점 | 정산에 사용되는가 |
|---|---|---|---|
| 포커 `game_0a` | `game_0a.players`, `game_0a.final_winners`, `game_0a.round_winners` | 마지막 로그아웃 후 | 아니오. 크레딧은 `logout-complete`가 직접 계산 |
| 수송선 `game_0b` | `game_0b` 스냅샷, `game_0b_event` 이벤트 로그 | 결과 공개/탑승 확정 시 | 아니오. 현재 크레딧 정산 자체가 확인되지 않음 |

### session_results를 표준 인터페이스로 볼 수 있는가?

현재 코드 의도상으로는 “게임 종료 결과 요약 공통 장부”입니다. `lib/session-result.ts`라는 공통 헬퍼가 있고, 포커와 수송선 양쪽에서 호출합니다.

하지만 현재 구현만 보면 “정산 표준 인터페이스”로 쓰기에는 부족합니다.

이유:

1. 포커 크레딧 정산이 `session_results`를 거치지 않습니다.
2. `session_results`에는 개인별 크레딧 지급액이 없습니다.
3. `winner_user_ids`와 `result_summary`만으로 모든 참가자의 정산 내역을 복원하기 어렵습니다.
4. 중복 INSERT 방지 제약이 없습니다.
5. 포커는 마지막 로그아웃 때 INSERT하고, 수송선은 결과 공개 중 INSERT해 시점이 서로 다릅니다.
6. 수송선은 현재 `game_participants` 등록 흐름이 없어서 `winner_user_ids`가 비어 있을 가능성이 큽니다.

이게 뭐냐면... `session_results`는 현재 “결과 요약 보고서”에 가깝고, 아직 “정산팀이 그대로 처리할 표준 서류”라고 보기에는 개인별 지급 정보와 쓰기 시점이 부족합니다.

---

## 4. player_cards 매핑 구조

### 코드상 확인되는 구조

현재 실행 코드가 기대하는 `player_cards` 컬럼:

| 컬럼 | 코드상 타입 추정 | 용도 | 근거 |
|---|---|---|---|
| `nfc_id` | 문자열 | NFC 카드 UID | register/logout/game_0b nfc-lookup에서 조회 |
| `player_number` | 숫자 | 1~12번 플레이어 카드 번호 | 각 API에서 `player_number`로 사용 |

관련 파일:

- `app/api/game/[gameId]/register-player/route.ts`
- `app/api/game/[gameId]/logout-lookup/route.ts`
- `app/api/game/[gameId]/logout-complete/route.ts`
- `app/api/game/game_0b/nfc-lookup/route.ts`
- `app/api/feedback/quick/route.ts`

### SQL 파일에서 확인되는 불일치

- `NFC_LOGIN_SETUP.md`는 `supabase-nfc-login.sql`을 실행하라고 설명합니다.
- 하지만 현재 `supabase-nfc-login.sql` 파일은 내용이 비어 있습니다.
- `supabase-setup.sql`에는 오래된 형태로 보이는 `player_cards`가 있습니다.
  - 컬럼: `id`, `nfc_uid`, `user_id`, `linked_at`
  - 현재 코드가 쓰는 `nfc_id`, `player_number`와 맞지 않습니다.

따라서 저장소만 기준으로는 최종 DB의 정확한 `player_cards CREATE TABLE` 문은 확인 불가입니다.

### 카드 단위 상태인가, 세션과 묶여 있는가?

현재 코드상 `player_cards`는 세션과 묶이지 않습니다.

- `player_cards`는 “실물 NFC 카드 -> 플레이어 번호”의 고정 매핑입니다.
- 특정 회원이 특정 세션에서 이 카드를 사용 중인지 여부는 `player_cards`가 아니라 `game_participants`가 표현합니다.
- 로그인 시 `player_cards`에는 쓰지 않습니다.
- 로그아웃 시에도 `player_cards`는 초기화하지 않습니다.

### 로그아웃 시 매핑 정리 방식

로그아웃 완료 시 정리되는 것은 `player_cards`가 아니라 `game_participants`입니다.

파일: `app/api/game/[gameId]/logout-complete/route.ts`

처리:

```ts
game_participants
  .update({ status: 'completed' })
  .eq('game_id', gameId)
  .eq('player_number', card.player_number)
  .eq('status', 'active')
```

즉, 카드 자체가 “빈 카드”로 바뀌는 것이 아니라, 해당 게임의 참가 기록이 `active`에서 `completed`로 바뀝니다.

이게 뭐냐면... 카드는 사람에게 붙는 장부가 아니라 “1번 카드, 2번 카드” 같은 물건 번호표이고, 누가 그 번호표를 사용 중인지는 별도 참가자 장부가 관리합니다.

---

## 5. game_participants 스키마와 세션-참가자 관계

### 최종 CREATE TABLE 확인 여부

저장소에서 `game_participants`의 완전한 `CREATE TABLE` 문은 확인되지 않았습니다.

확인된 SQL 마이그레이션:

- `supabase-game-participants-status.sql`
  - `status VARCHAR(20) DEFAULT 'active'`
  - 의미: `active`는 카드 사용 중, `completed`는 로그아웃 완료
- `supabase-game-participants-feedback.sql`
  - `feedback_satisfaction SMALLINT`
  - `feedback_recommendation SMALLINT`

### 코드상 요구되는 컬럼

| 컬럼 | 코드상 타입 추정 | 용도 |
|---|---|---|
| `id` | UUID 또는 숫자 ID, 확인 불가 | register-player에서 기존 행/INSERT 결과 확인용으로 조회 |
| `game_id` | UUID 문자열 | `game_0a.game_id` 또는 `game_0b.game_id`와 연결 |
| `player_number` | 숫자 | 게임 안의 1~12번 자리 |
| `user_id` | UUID 문자열 | `user_info.id`와 연결 |
| `status` | `VARCHAR(20)` | `active`/`completed` |
| `created_at` | timestamp 추정 | 피드백 저장 시 최신 참가자 행 조회에 사용 |
| `feedback_satisfaction` | `SMALLINT` | 간략 피드백 컬럼 |
| `feedback_recommendation` | `SMALLINT` | 간략 피드백 컬럼 |

### 포커에서의 관계

포커 로그인 시:

- `game_participants.game_id = game_0a.game_id`
- `game_participants.user_id = user_info.id`
- `game_participants.player_number = player_cards.player_number`
- `game_participants.status = 'active'`

포커 로그아웃 시:

- 같은 `game_id + player_number + active` 행을 찾아 `completed`로 바꿉니다.

포커 세션과 참가자의 연결은 직접 `session_id`를 저장하는 방식이 아닙니다.

연결 경로:

```text
sessions.session_id
  -> game_0a.session_id
  -> game_0a.game_id
  -> game_participants.game_id
```

### 수송선에서의 관계

현재 수송선 `nfc-lookup`은 `player_cards`와 `game_0b`만 조회합니다. `game_participants`에 참가자를 INSERT하지 않습니다.

다만 수송선 reset API와 `session_results` helper는 `game_participants`를 쓰려는 흔적이 있습니다.

- `app/api/game/game_0b/reset/route.ts`
  - `game_0b.game_id`에 해당하는 active 참가자를 `completed` 처리
- `lib/session-result.ts`
  - `playerNumbersToUserIds(gameId, playerNumbers)`가 `game_participants`에서 `user_id`를 찾음
- `app/api/game/game_0b/advance-phase/route.ts`
  - 이 함수에 `game.game_id`를 넘겨 winner user ID를 찾으려 함

하지만 현재 확인된 수송선 입장 흐름에는 `game_participants` INSERT가 없습니다. 따라서 수송선 우승자 번호를 `user_info.id`로 바꾸는 경로는 현재 코드만 보면 작동한다고 보기 어렵습니다.

이게 뭐냐면... 포커는 “세션 -> 게임 -> 참가자” 연결 장부가 실제로 채워지지만, 수송선은 현재 플레이어 번호만 쓰고 회원 연결 장부는 채우지 않는 상태입니다.

---

## 6. 현재 활성 세션을 코드가 식별하는 방식

### sessions 테이블의 status 의미

근거 파일:

- `supabase-schema.sql`
- `supabase-schema-clean.sql`
- `supabase-admin-overhaul.sql`

`sessions` 기본 컬럼:

| 컬럼 | 타입/의미 |
|---|---|
| `session_id` | `VARCHAR(20) PRIMARY KEY` |
| `game_name` | 게임 이름 |
| `session_date` | 날짜 |
| `session_time` | 시간 |
| `max_capacity` | 최대 인원 |
| `current_capacity` | 신청 인원 |
| `base_price` | 기본 가격 |
| `status` | `모집중` 또는 `마감` |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

운영성 개편 마이그레이션에서 추가:

| 컬럼 | 의미 |
|---|---|
| `deleted_at` | 세션 soft delete |
| `game_kind` | `game_0a`, `game_0b`, `game_0c` 같은 게임 종류 |

여기서 `sessions.status`는 예약/모집 상태입니다. 게임 진행의 active 여부가 아닙니다.

### 코드가 활성 게임을 찾는 방식

현재 코드는 “오늘의 활성 세션”을 자동으로 찾지 않습니다. 화면에서 선택한 세션 또는 URL로 전달된 ID를 계속 들고 다닙니다.

포커:

- 컨트롤 목록에서 세션을 선택합니다.
- `app/api/game/session/[sessionId]/route.ts`가 `game_0a`에서 해당 `session_id`의 최신 게임을 조회합니다.
  - 조건: `.eq('session_id', sessionId)`
  - 정렬: `created_at desc`
  - 1개만 사용
- 로그인/로그아웃 화면에는 `game_id`가 URL로 전달됩니다.
  - `/login?gameId=...`
  - `/logout?gameId=...`
- `register-player`, `logout-lookup`, `logout-complete`는 `gameId`를 직접 받아 `game_0a.game_id`로 조회합니다.

수송선:

- 컨트롤 목록에서 세션을 선택합니다.
- `app/api/game/game_0b/session/[sessionId]/route.ts`가 `game_0b`에서 `session_id`로 1행을 조회합니다.
- `game_0b` 테이블은 `UNIQUE(session_id)`입니다.
- host/testroom/display URL은 `session` query parameter를 들고 다닙니다.

### game_0a/game_0b 자체의 status

`game_0a`에는 게임 진행 상태 컬럼이 있습니다.

- `대기중`
- `진행중`
- `결과선택중`
- `완료`

`game_0b`에도 게임 진행 상태 컬럼이 있습니다.

- `대기중`
- `진행중`
- `완료`

하지만 로그인/로그아웃 API가 “현재 status가 진행중인지”를 공통 규칙으로 검사하는 구조는 확인되지 않습니다.

이게 뭐냐면... 예약 세션 장부에는 “모집중/마감”만 있고, 실제 입퇴장은 URL에 실려 온 `game_id` 또는 `session_id`를 믿고 해당 게임을 찾아갑니다.

---

## 7. 수송선(game_0b) 입퇴장 구현 상태

### 결론

수송선은 “NFC로 플레이어 번호를 식별”하는 기능은 있습니다. 하지만 포커처럼 “회원 로그인 -> game_participants 등록 -> 로그아웃 -> 크레딧 정산” 흐름은 현재 구현되어 있지 않습니다.

### game_0b/nfc-lookup은 등록까지 하는가?

파일: `app/api/game/game_0b/nfc-lookup/route.ts`  
함수: `POST`

하는 일:

1. `nfc_id`, `session_id` 필수 확인
2. NFC 값 정리
3. `player_cards`에서 `nfc_id`로 `player_number` 조회
4. 정확 매칭이 실패하면 모든 `player_cards`를 읽어 부분 문자열 매칭 시도
5. `game_0b`에서 `session_id`로 게임 조회
6. `player_number`가 `game.player_count`보다 크면 거부
7. `{ player_number }` 반환

하지 않는 일:

- `game_participants` INSERT 없음
- `user_info` 조회 없음
- `user_id` 연결 없음
- 크레딧 계산 없음
- 로그아웃 처리 없음

따라서 `nfc-lookup`은 이름 그대로 조회입니다. 등록까지 하지 않습니다.

### testroom에서 플레이어를 어떻게 잡는가?

파일: `app/game/game_0b/testroom/page.tsx`

흐름:

1. `NfcGate` 컴포넌트가 NFC 태깅을 받습니다.
2. `/api/game/game_0b/nfc-lookup`을 호출합니다.
3. 응답의 `player_number`를 React local state인 `playerNum`에 저장합니다.
4. 이후 화면은 `playerNum`으로 `game_0b` 행의 역할/코어 값을 읽습니다.
   - 역할/코어 조회: `getPlayerRoleCore(game, playerNum)`
5. 역할 확인 완료 또는 액션 종료 시 `playerNum`을 다시 `null`로 바꿉니다.

즉, 수송선 테스트룸의 플레이어 식별은 브라우저 화면 안의 일시 상태입니다.

### host에서 플레이어를 어떻게 잡는가?

파일: `app/game/game_0b/host/page.tsx`

host 화면은 NFC나 회원을 사용하지 않습니다.

- `playerOptions = 1..player_count`
- 보내는 플레이어/받는 플레이어를 select box에서 번호로 고릅니다.
- 탑승 인원도 번호 체크박스로 고릅니다.
- 역할/코어는 `game_0b` 스냅샷의 `player_01_role`, `player_01_core` 같은 컬럼에서 읽습니다.

### 수송선 결과와 session_results

수송선에는 입퇴장/크레딧 정산은 없지만, 게임 결과 요약을 `session_results`에 넣는 코드는 있습니다.

- 파일: `app/api/game/game_0b/advance-phase/route.ts`
- 지점:
  - 게이지 공개 후 외계인 승리
  - 탑승 확정 후 생존자/반군 결과

하지만 `winner_user_ids`를 만들 때 `game_participants`에서 `user_id`를 찾으므로, 현재 수송선 입장 등록이 없는 상태에서는 우승자 회원 ID가 제대로 채워질지 확인 불가입니다. 코드상으로는 비어 있을 가능성이 큽니다.

이게 뭐냐면... 수송선은 현재 “카드를 찍으면 몇 번 플레이어인지 알려주는 문패 확인”만 있고, 포커 같은 “회원 입장/퇴장 장부와 크레딧 정산”은 붙어 있지 않습니다.

---

## 8. 한 줄 결론: 공통화 가능한 부분과 게임별로 달라지는 부분의 경계

현재 코드상 경계는 다음과 같습니다.

- 공통화 가능한 부분:
  - NFC 입력 정리
  - `player_cards.nfc_id -> player_number` 조회
  - `game_participants`에 `game_id + player_number + user_id + status`로 입장/퇴장 상태를 기록하는 패턴
  - `session_results`에 게임 종료 요약을 INSERT하는 형식
- 게임마다 다를 수밖에 없는 부분:
  - 누가 이겼는지 판단하는 게임 결과 계산
  - 점수/진영/탑승자 같은 게임별 결과 데이터 만들기
  - 크레딧 지급액 계산 규칙

가장 중요한 현재 사실은, 포커의 크레딧 정산이 `session_results`를 통해 처리되지 않고 `logout-complete` API에서 직접 처리된다는 점입니다. 따라서 공통 모듈로 분리하려면 “입퇴장 상태 관리”와 “게임별 결과/보상 계산”을 분리하고, `session_results`를 정산 표준 인터페이스로 삼을지 여부는 개인별 지급 내역과 idempotency를 보강한 뒤 결정해야 합니다.

이게 뭐냐면... 공통 모듈은 “카드 찍고 참가자 장부를 여닫는 일”까지 맡을 수 있지만, “이 게임에서 누가 얼마를 받아야 하는가”는 각 게임 규칙이 만든 결과표를 받아 처리해야 합니다.

---

## 부록 A. 핵심 파일 경로 모음

### 포커 입장

- `app/login/page.tsx`
  - `processNFC`: NFC 태깅 후 register-player API 호출
- `app/api/game/[gameId]/register-player/route.ts`
  - `POST`: 포커 참가자 등록

### 포커 퇴장/정산

- `app/logout/page.tsx`
  - `processNFC`: logout-lookup 호출
  - `finishFeedback`: logout-complete 호출
- `app/api/game/[gameId]/logout-lookup/route.ts`
  - `POST`: 정산 미리보기 계산
- `app/api/game/[gameId]/logout-complete/route.ts`
  - `POST`: 실제 크레딧 업데이트, 참가자 completed 처리, 마지막 로그아웃 시 session_results INSERT
- `lib/credit-reward.ts`
  - `getCreditReward`: 인원/순위별 보상 계산

### session_results

- `supabase-session-results.sql`
  - 테이블 정의
- `lib/session-result.ts`
  - `insertSessionResult`
  - `playerNumbersToUserIds`

### 수송선

- `app/api/game/game_0b/nfc-lookup/route.ts`
  - NFC -> player_number 조회
- `app/game/game_0b/testroom/page.tsx`
  - 테스트룸 NFC 식별과 playerNum local state
- `app/game/game_0b/host/page.tsx`
  - 진행자 번호 선택 기반 진행
- `app/api/game/game_0b/advance-phase/route.ts`
  - 수송선 단계 전환과 session_results INSERT
- `supabase-game-0b-schema.sql`
  - `game_0b`, `game_0b_event` 스키마

이게 뭐냐면... 실제로 다음 설계를 시작할 때 먼저 봐야 할 파일 목록입니다.
