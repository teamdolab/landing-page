-- Supabase SQL Editor에서 실행: 조회 안 될 때 확인/수정용

-- 1. 테스트 데이터가 있는지 확인 (실행 후 결과 확인)
SELECT * FROM users WHERE phone_pin = '1234';

-- 2. 없으면 데이터 추가
INSERT INTO users (phone, phone_pin, nickname, password_hash)
VALUES ('01012341234', '1234', 'test1', '1234')
ON CONFLICT (nickname) DO UPDATE SET phone_pin = '1234';

-- 3. RLS가 막고 있다면: 정책 삭제 후 재생성
DROP POLICY IF EXISTS "Allow anon read users" ON users;
CREATE POLICY "Allow anon read users" ON users FOR SELECT TO anon USING (true);

-- 4. (선택) RLS 일시 비활성화해서 테스트
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- 테스트 후 다시 활성화: ALTER TABLE users ENABLE ROW LEVEL SECURITY;
