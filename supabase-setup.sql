-- Supabase 대시보드 > SQL Editor에서 이 스크립트를 실행하세요

-- 1. users 테이블
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  phone_pin TEXT NOT NULL,
  nickname TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. player_cards 테이블 (NFC 카드 매칭)
CREATE TABLE IF NOT EXISTS player_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfc_uid TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS 활성화 (선택사항 - 보안 강화)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_cards ENABLE ROW LEVEL SECURITY;

-- 4. 정책: anon으로 조회/삽입 허용 (키오스크용)
CREATE POLICY "Allow anon read users" ON users FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read player_cards" ON player_cards FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert player_cards" ON player_cards FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update player_cards" ON player_cards FOR UPDATE TO anon USING (true);

-- 5. 테스트 데이터 (선택사항 - PIN 1234, 닉네임 test1, 패스워드 1234)
-- password_hash는 '1234'를 bcrypt 등으로 해시한 값 (추후 실제 해시로 교체)
INSERT INTO users (phone, phone_pin, nickname, password_hash)
VALUES ('01012341234', '1234', 'test1', '1234')
ON CONFLICT (nickname) DO NOTHING;
