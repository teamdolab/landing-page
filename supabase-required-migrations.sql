-- ============================================
-- 실제 게임용 필수 마이그레이션
-- Supabase SQL Editor에서 실행하세요.
-- timer_end, round_winners, final_winners 오류 해결
-- ============================================

-- 1. timer_end (타이머 종료 시 송출용 "종료" 표시)
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS timer_end BOOLEAN DEFAULT false;

-- 2. round_winners (라운드별 승리자)
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS round_winners JSONB DEFAULT '{}'::jsonb;

-- 3. final_winners (최종 우승자)
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS final_winners JSONB DEFAULT NULL;

-- 4. status CHECK 확장 ('결과선택중' 추가)
ALTER TABLE game_0a DROP CONSTRAINT IF EXISTS game_0a_status_check;
ALTER TABLE game_0a ADD CONSTRAINT game_0a_status_check
  CHECK (status IN ('대기중', '진행중', '결과선택중', '완료'));

-- 5. Realtime: Supabase 대시보드 Database → Replication에서 game_0a 활성화
