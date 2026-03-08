-- Supabase 연동 시 실행: round_winners 컬럼 추가 (라운드별 승리자)
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS round_winners JSONB DEFAULT '{}'::jsonb;
