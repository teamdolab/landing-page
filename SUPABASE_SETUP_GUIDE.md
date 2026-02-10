# Supabase 스키마 적용 가이드

랜딩페이지와 로그인 페이지가 완전하게 Supabase와 연동되었습니다!

## 🚀 Supabase 설정 순서

### 1단계: Supabase SQL Editor 접속
1. Supabase 대시보드(https://supabase.com)에 로그인
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭

### 2단계: 스키마 생성
1. `supabase-schema.sql` 파일의 전체 내용을 복사
2. SQL Editor에 붙여넣기
3. **Run** 버튼 클릭하여 실행

✅ 다음 테이블들이 생성됩니다:
- `user_info` - 유저 정보
- `sessions` - 게임 세션 정보
- `apply` - 참가 신청 정보

✅ 다음 기능들이 자동으로 설정됩니다:
- PIN 자동 생성 (전화번호 뒷 4자리)
- 마케팅 동의 시 3,000 크레딧 자동 적립
- 추천인 입력 시 2,000 크레딧 자동 적립
- 참가 신청 시 크레딧 자동 차감
- 참가 신청 시 세션 참가 인원 자동 증가
- 세션 마감 상태 자동 업데이트

### 3단계: 예시 데이터 삽입
1. `supabase-sample-data.sql` 파일의 전체 내용을 복사
2. SQL Editor에 붙여넣기
3. **Run** 버튼 클릭하여 실행

✅ 다음 데이터가 삽입됩니다:
- 15개의 게임 세션 (2026-02-11 ~ 2026-02-15)
- 33명의 테스트 유저
- 33건의 참가 신청

### 4단계: 테스트 로그인 정보
다음 계정으로 로그인 페이지(`/login`)에서 테스트할 수 있습니다:

| 이름 | 전화번호 | PIN | 닉네임 | 패스워드 | 크레딧 |
|------|----------|-----|--------|----------|--------|
| 김철수 | 010-1234-5678 | 5678 | 철수왕 | (설정필요) | 5,000 |
| 이영희 | 010-9876-5432 | 5432 | 영희짱 | (설정필요) | 3,000 |
| 박민수 | 010-5555-1234 | 1234 | 민수123 | (설정필요) | 0 |
| 정수진 | 010-7777-8888 | 8888 | 수진수진 | (설정필요) | 3,000 |

> **참고**: 예시 데이터의 패스워드는 `$2a$10$example_hashed_password_X` 형식으로 되어있습니다. 
> 실제 테스트를 위해서는 SQL Editor에서 패스워드를 업데이트하거나, 랜딩페이지에서 신규 가입을 진행하세요.

**패스워드 업데이트 예시:**
```sql
UPDATE user_info SET password = '1234' WHERE phone = '010-1234-5678';
UPDATE user_info SET password = '5432' WHERE phone = '010-9876-5432';
UPDATE user_info SET password = '1234' WHERE phone = '010-5555-1234';
UPDATE user_info SET password = '8888' WHERE phone = '010-7777-8888';
```

## 📋 주요 기능 흐름

### 신규 유저 가입 플로우
1. 랜딩페이지 접속 → 전원 버튼 클릭
2. **게임 참가하기** 클릭
3. 성명 + 전화번호 입력 → **계속** 클릭
4. 시스템이 자동으로 신규/기존 유저 구분
5. **신규 유저인 경우**:
   - 닉네임, 패스워드(4자리) 입력
   - 개인정보 수집 동의 (필수) ✓
   - 마케팅 정보 동의 (선택) ✓ → **3,000 크레딧 적립**
   - 추천인 전화번호 입력 (선택) → **2,000 크레딧 적립**
   - **가입 및 신청하기** 클릭
6. 참가 일정 선택, 크레딧 사용, 환불 규정 동의
7. **참가 신청 완료** 클릭
8. apply 테이블에 데이터 저장, 크레딧 차감, 세션 참가 인원 증가

### 기존 유저 신청 플로우
1. 랜딩페이지 접속 → 전원 버튼 클릭
2. **게임 참가하기** 클릭
3. 성명 + 전화번호 입력 → **계속** 클릭
4. **기존 유저인 경우**:
   - 바로 참가 신청 페이지로 이동
5. 참가 일정 선택, 크레딧 사용, 환불 규정 동의
6. **참가 신청 완료** 클릭

### 실시간 예약 현황 확인
1. 랜딩페이지에서 **실시간 예약 확인** 버튼 클릭
2. 모든 세션의 현재 참가 인원 및 잔여 석 확인

### 로그인 플로우
1. `/login` 페이지 접속
2. PIN(전화번호 뒷 4자리) 입력
3. 닉네임 선택 (같은 PIN을 가진 유저가 여러 명일 수 있음)
4. 패스워드(4자리) 입력
5. NFC 카드 태그 화면 (추후 구현)
6. 로그인 완료

## 🔧 데이터 확인 쿼리

### 실시간 예약 현황 조회
```sql
SELECT * FROM get_session_availability();
```

### 유저별 크레딧 확인
```sql
SELECT name, phone, credits FROM user_info ORDER BY credits DESC;
```

### 참가 신청 현황 확인
```sql
SELECT 
    u.name,
    u.phone,
    s.session_id,
    s.game_name,
    s.session_date,
    s.session_time,
    a.used_credits,
    a.final_price,
    a.status
FROM apply a
JOIN user_info u ON a.user_id = u.id
JOIN sessions s ON a.session_id = s.session_id
ORDER BY s.session_date, s.session_time, u.name;
```

### 세션별 참가 인원 확인
```sql
SELECT 
    session_id,
    game_name,
    session_date,
    session_time,
    current_capacity,
    max_capacity,
    status
FROM sessions
ORDER BY session_date, session_time;
```

## ⚠️ 주의사항

1. **패스워드 보안**
   - 현재는 평문으로 저장됩니다 (테스트용)
   - 실제 배포 시 bcrypt 해싱 필요

2. **RLS (Row Level Security)**
   - user_info: 본인 데이터만 조회/수정 가능
   - sessions: 모두 조회 가능
   - apply: 본인 신청만 조회 가능

3. **크레딧 정책**
   - 마케팅 동의: 3,000 크레딧 (가입 시 1회)
   - 추천인 입력: 2,000 크레딧 (가입 시 1회)
   - 크레딧은 비현금성 포인트로 현금 환급 불가

4. **세션 ID 규칙**
   - 형식: `YYMMDDXYZN`
   - 예시: `260211A0A1`
   - YY: 연도, MM: 월, DD: 일
   - X: 매장 (A, B, C...)
   - Y: 시즌 (0, 1, 2...)
   - Z: 게임 (A, B, C...)
   - N: 타임 (1, 2, 3...)

## 🎉 완료!

이제 랜딩페이지와 로그인 페이지가 Supabase와 완전하게 연동되었습니다.

- 랜딩페이지: `/` (루트)
- 로그인 페이지: `/login`

모든 기능이 실시간으로 데이터베이스와 동기화됩니다!
