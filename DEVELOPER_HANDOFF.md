# 개발자 인수인계 문서

## 📋 작업 요약

랜딩페이지와 로그인 페이지를 Supabase와 완전하게 연동하여 실제 서비스 운영이 가능하도록 구현했습니다.

---

## 🎯 구현된 핵심 기능

### 1. 데이터베이스 스키마 설계 및 구축
**파일:** `supabase-schema.sql`

#### 테이블 구조
- **`user_info`**: 유저 정보 관리
  - PIN 자동 생성 (전화번호 뒷 4자리)
  - 크레딧 시스템
  - 개인정보/마케팅 동의 관리
  - 추천인 시스템

- **`sessions`**: 게임 세션 관리
  - 커스텀 세션 ID 형식: `YYMMDDXYZN`
  - 실시간 참가 인원 추적
  - 자동 마감 상태 관리

- **`apply`**: 참가 신청 관리
  - 중복 신청 방지
  - 크레딧 사용 내역 추적

#### 자동화 시스템
- ✅ 신규 가입 시 크레딧 자동 적립
  - 마케팅 동의: 3,000 크레딧
  - 추천인 입력: 2,000 크레딧 (하이픈 있든 없든 작동)
- ✅ 참가 신청 시 크레딧 자동 차감
- ✅ 세션 참가 인원 실시간 업데이트
- ✅ 세션 마감 상태 자동 관리

### 2. 랜딩페이지 완전 연동
**파일:** `app/page.tsx`

#### 신규 기능
- **실시간 예약 확인** 버튼 및 모달
  - 모든 세션의 현재 참가 인원 확인
  - 잔여 석 실시간 표시
  - 세션 상태 확인 (모집중/마감)

- **신규/기존 유저 자동 구분**
  - 성명 + 전화번호 입력 시 DB 조회
  - 기존 유저: 바로 참가 신청 페이지로
  - 신규 유저: 가입 페이지로 이동

- **신규 가입 플로우**
  - 닉네임, 패스워드 입력
  - 개인정보/마케팅 동의 체크
  - 추천인 입력 (선택)
  - 크레딧 자동 적립

- **참가 신청 시스템**
  - DB에서 실시간 세션 목록 로드
  - 크레딧 사용 기능
  - 잔여 크레딧 확인
  - 최종 결제 금액 자동 계산
  - apply 테이블에 신청 저장

### 3. 로그인 페이지 연동
**파일:** `app/login/page.tsx`

- `user_info` 테이블과 완전 연동
- PIN (전화번호 뒷 4자리) 기반 인증
- 닉네임 선택
- 패스워드 확인

### 4. 타입 정의 및 유틸리티
**파일:** `lib/supabase.ts`

- TypeScript 타입 정의 (UserInfo, Session, Apply 등)
- 유틸리티 함수
  - `checkUserExists()`: 유저 존재 여부 확인
  - `getSessionAvailability()`: 실시간 예약 현황 조회
  - `getUserCredits()`: 유저 크레딧 조회

---

## 🗂️ 파일 구조

```
landing-page/
├── supabase-schema.sql          # DB 스키마 (필수)
├── supabase-sample-data.sql     # 예시 데이터 (35명, 15개 세션)
├── SUPABASE_SETUP_GUIDE.md      # Supabase 설정 가이드
├── lib/
│   └── supabase.ts              # Supabase 클라이언트 및 유틸리티
├── app/
│   ├── page.tsx                 # 랜딩페이지 (완전 연동)
│   └── login/
│       └── page.tsx             # 로그인 페이지 (완전 연동)
└── .env.local                   # Supabase 환경 변수 (gitignore)
```

---

## 🚀 Supabase 초기 설정

### 1단계: 스키마 생성
Supabase SQL Editor에서 실행:
```bash
1. supabase-schema.sql 전체 복사 → 붙여넣기 → Run
```

### 2단계: RLS 비활성화 (개발용)
```sql
ALTER TABLE user_info DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE apply DISABLE ROW LEVEL SECURITY;
```

### 3단계: 예시 데이터 삽입
```bash
1. supabase-sample-data.sql 전체 복사 → 붙여넣기 → Run
```

### 4단계: 환경 변수 설정
`.env.local` 파일:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

---

## 📊 데이터 구조

### 세션 ID 규칙
- 형식: `YYMMDDXYZN`
- 예시: `260211A0A1`
  - `260211`: 2026년 02월 11일
  - `A`: A 매장
  - `0`: 시즌 0
  - `A`: A 게임 (대선포커)
  - `1`: 첫 번째 타임

### 크레딧 정책
- 마케팅 동의: 3,000 크레딧 (가입 시 1회)
- 추천인 입력: 2,000 크레딧 (가입 시 1회, 추천인이 DB에 존재해야 함)
- 크레딧은 비현금성 포인트로 참가비에서 차감

---

## 🔧 주요 로직 흐름

### 신규 유저 가입
```
1. 랜딩페이지 → 게임 참가하기
2. 성명 + 전화번호 입력 → DB 조회
3. 신규 유저 판정 → 가입 페이지로
4. 닉네임, 패스워드, 약관 동의, 추천인 입력
5. user_info 테이블에 INSERT
6. 트리거 작동: 크레딧 자동 적립
7. 참가 신청 페이지로 이동
```

### 참가 신청
```
1. sessions 테이블에서 모집중인 세션 목록 로드
2. 세션 선택 + 크레딧 사용 입력
3. apply 테이블에 INSERT
4. 트리거 작동:
   - user_info: 크레딧 차감
   - sessions: current_capacity +1
   - sessions: 상태 자동 업데이트 (마감 여부)
```

### 로그인
```
1. PIN (전화번호 뒷 4자리) 입력
2. user_info 테이블에서 PIN으로 조회
3. 닉네임 선택 (같은 PIN이 여러 명일 수 있음)
4. 패스워드 확인
5. 로그인 완료
```

---

## ⚠️ 알아야 할 사항

### 1. Row Level Security (RLS)
- **현재 상태**: 모든 테이블 RLS 비활성화 (개발용)
- **실제 배포 시**: Supabase Auth와 연동하여 RLS 활성화 필요
- **파일 참고**: `supabase-schema.sql` 하단에 RLS 정책 코드 있음

### 2. 패스워드 보안
- **현재**: 평문 저장 (테스트용)
- **실제 배포 시**: bcrypt 해싱 필요
- **수정 위치**: 
  - `app/page.tsx` - 가입 시 해싱
  - `app/login/page.tsx` - 로그인 시 비교

### 3. 전화번호 형식
- DB 저장: `010-1234-5678` (하이픈 포함)
- 유저 입력: 하이픈 있든 없든 작동 (트리거에서 처리)

### 4. 테스트 계정
예시 데이터에 포함된 계정:
- 박민수: `010-5555-1234` (PIN: `1234`)
- 김철수: `010-1234-5678` (PIN: `5678`)
- 이영희: `010-9876-5432` (PIN: `5432`)
- 정수진: `010-7777-8888` (PIN: `8888`)

**패스워드는 별도 설정 필요**

---

## 🐛 알려진 이슈 및 해결 방법

### 이슈 1: RLS 정책 에러
**증상**: `new row violates row-level security policy`  
**해결**: SQL Editor에서 RLS 비활성화
```sql
ALTER TABLE user_info DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE apply DISABLE ROW LEVEL SECURITY;
```

### 이슈 2: 추천인 크레딧 미적립
**원인**: 입력한 추천인 전화번호가 DB에 없음  
**해결**: 존재하는 전화번호 입력 (예시 데이터 참고)

### 이슈 3: 중복 키 에러
**원인**: 예시 데이터를 중복으로 삽입  
**해결**: 
```sql
TRUNCATE TABLE apply, sessions, user_info CASCADE;
-- 그 다음 supabase-sample-data.sql 재실행
```

---

## 🎯 다음 단계 (TODO)

### 보안 강화
- [ ] bcrypt 패스워드 해싱 구현
- [ ] Supabase Auth 연동
- [ ] RLS 정책 활성화

### 기능 추가
- [ ] 어드민 페이지 (세션 생성/관리)
- [ ] 결제 시스템 연동
- [ ] 이메일/SMS 알림
- [ ] 환불 처리 기능

### 최적화
- [ ] 에러 핸들링 강화
- [ ] 로딩 상태 개선
- [ ] 반응형 디자인 보완

---

## 📞 문의 사항

코드나 로직에 대해 궁금한 점이 있으면:
- 모든 주요 함수에 주석 포함
- `SUPABASE_SETUP_GUIDE.md` 참고
- SQL 쿼리 예시 포함

---

**작업 완료일**: 2026-02-11  
**작업자**: AI Assistant  
**테스트 완료**: ✅ 신규 가입, 참가 신청, 실시간 예약 확인
