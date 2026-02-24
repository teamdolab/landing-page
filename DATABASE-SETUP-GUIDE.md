# Supabase 데이터베이스 완전 초기화 및 재설정 가이드

## 📋 실행 순서

### 1단계: 모든 테이블 삭제 (초기화)
```
파일: supabase-reset-all.sql
```
Supabase SQL Editor에서 이 파일을 열고 전체 실행하세요.
⚠️ 주의: 모든 데이터가 삭제됩니다!

---

### 2단계: 기본 스키마 생성
```
파일: supabase-schema.sql
```
다음 테이블과 함수들이 생성됩니다:
- `user_info` (유저 정보)
- `sessions` (게임 세션)
- `apply` (참가 신청)
- 관련 함수들 (check_user_exists, get_user_credits 등)
- 트리거 (크레딧 자동 적립, 세션 정원 관리)

---

### 3단계: 게임 스키마 생성 (선택사항)
```
파일: supabase-game-schema.sql
```
게임 진행용 테이블들이 생성됩니다:
- `game_sessions` (게임 세션 관리)
- `game_state` (게임 상태)
- `game_players` (게임 플레이어)
- `initialize_game` 함수

---

### 4단계: 디스플레이 UI 스키마 생성 (선택사항)
```
파일: supabase-display-ui-schema.sql
```
송출용 화면 UI 관리 테이블들이 생성됩니다:
- `display_ui_state` (디스플레이 UI 상태)
- `display_players` (디스플레이 플레이어 정보)
- `initialize_display` 함수

---

### 5단계: RLS (Row Level Security) 비활성화
```sql
-- 개발 중에는 RLS를 비활성화하는 것이 편리합니다
ALTER TABLE user_info DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE apply DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_players DISABLE ROW LEVEL SECURITY;
ALTER TABLE display_ui_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE display_players DISABLE ROW LEVEL SECURITY;
```

---

### 6단계: Realtime 활성화
Supabase 대시보드에서:
1. Database → Replication 메뉴로 이동
2. 다음 테이블들의 Realtime을 활성화:
   - ✅ `game_state`
   - ✅ `game_players`
   - ✅ `display_ui_state`
   - ✅ `display_players`

---

### 7단계: 샘플 데이터 삽입 (선택사항)
```
파일: supabase-sample-data.sql
```
테스트용 데이터가 삽입됩니다:
- 샘플 유저 3명
- 샘플 세션 3개
- 샘플 신청 데이터

---

## ✅ 확인 방법

### 1. 테이블이 제대로 생성되었는지 확인
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

예상 결과:
- apply
- display_players
- display_ui_state
- game_players
- game_sessions
- game_state
- sessions
- user_info

### 2. 함수가 제대로 생성되었는지 확인
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;
```

### 3. 크레딧 자동 적립 테스트
```sql
-- 테스트 유저 생성 (마케팅 동의 + 추천인)
INSERT INTO user_info (name, phone, nickname, password, marketing_consent, referrer_phone)
VALUES ('테스트', '01099999999', '테스터', '1234', true, '01055551234');

-- 크레딧 확인 (5000이어야 함: 마케팅 3000 + 추천인 2000)
SELECT name, phone, credits FROM user_info WHERE phone = '01099999999';
```

---

## 🚨 문제 해결

### RLS 에러가 발생하는 경우
```sql
ALTER TABLE [테이블명] DISABLE ROW LEVEL SECURITY;
```

### 외래키 제약 조건 에러
테이블을 순서대로 삭제/생성해야 합니다. `CASCADE` 옵션을 사용하면 의존성이 있는 객체도 함께 삭제됩니다.

### 함수/트리거 중복 에러
```sql
DROP FUNCTION IF EXISTS [함수명] CASCADE;
DROP TRIGGER IF EXISTS [트리거명] ON [테이블명] CASCADE;
```

---

## 📝 현재 필요한 최소 스키마

랜딩페이지와 어드민 페이지만 사용하는 경우:
1. ✅ `supabase-reset-all.sql` (초기화)
2. ✅ `supabase-schema.sql` (필수)
3. ❌ `supabase-game-schema.sql` (나중에 게임 진행용 페이지 만들 때)
4. ❌ `supabase-display-ui-schema.sql` (나중에 송출용 화면 만들 때)
5. ✅ RLS 비활성화 (개발 중)
