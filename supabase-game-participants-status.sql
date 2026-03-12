-- game_participants에 status 컬럼 추가
-- active: 로그인됨 (카드 사용중), completed: 로그아웃됨 (이력 보존, 카드 공카드)
-- Supabase SQL Editor에서 실행

ALTER TABLE game_participants ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

UPDATE game_participants SET status = 'active' WHERE status IS NULL;

COMMENT ON COLUMN game_participants.status IS 'active: 카드 사용중, completed: 로그아웃 완료(이력 보존)';
