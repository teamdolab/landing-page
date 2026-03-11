-- ============================================
-- game_0a 스키마 v2: 칼럼 분리 설계
-- Undo/Edit 용이, 오류 없이 단계 적용
-- ============================================
-- 기존 칼럼 유지 + 새 칼럼 추가 (호환성)
-- Supabase SQL Editor에서 실행

-- 1. 새 칼럼 추가 (IF NOT EXISTS로 안전하게)
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS first_player_number INTEGER;
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS dealing_completed BOOLEAN DEFAULT false;
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS strategy_1_started_at TIMESTAMPTZ;
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS strategy_1_ended_at TIMESTAMPTZ;
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS strategy_2_started_at TIMESTAMPTZ;
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS strategy_2_ended_at TIMESTAMPTZ;
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS declaration_results JSONB DEFAULT '{}'::jsonb;
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS candidate_revealed_cards JSONB DEFAULT '{}'::jsonb;
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS round_scores JSONB DEFAULT '{}'::jsonb;

-- 2. timer_end, round_winners, final_winners (이미 있을 수 있음)
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS timer_end BOOLEAN DEFAULT false;
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS round_winners JSONB DEFAULT '{}'::jsonb;
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS final_winners JSONB DEFAULT NULL;

-- 3. status CHECK 확장
ALTER TABLE game_0a DROP CONSTRAINT IF EXISTS game_0a_status_check;
ALTER TABLE game_0a ADD CONSTRAINT game_0a_status_check
  CHECK (status IN ('대기중', '진행중', '결과선택중', '완료'));

-- 4. 코멘트
COMMENT ON COLUMN game_0a.first_player_number IS '선 플레이어 번호 (Step 1)';
COMMENT ON COLUMN game_0a.dealing_completed IS '카드 딜링 완료 여부 (Step 2)';
COMMENT ON COLUMN game_0a.declaration_results IS '출마 선언 결과 {플레이어번호: true(출마)/false(포기)}';
COMMENT ON COLUMN game_0a.candidate_revealed_cards IS '후보자별 공개 카드 {플레이어번호: ["S2","H3"]}';
COMMENT ON COLUMN game_0a.round_scores IS '플레이어별 라운드별 점수 {플레이어번호: [r1,r2,r3,r4]}';
