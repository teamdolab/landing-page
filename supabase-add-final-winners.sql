-- ============================================
-- game_0a: final_winners 컬럼 및 status 확장
-- 최종 결과 화면 지원
-- ============================================

-- 1. final_winners 컬럼 추가 (최종 우승자 플레이어 번호 배열)
ALTER TABLE game_0a
ADD COLUMN IF NOT EXISTS final_winners JSONB DEFAULT NULL;

COMMENT ON COLUMN game_0a.final_winners IS '최종 우승자 플레이어 번호 배열 [1, 3]';

-- 2. status CHECK 제약 수정: '결과선택중' 추가
ALTER TABLE game_0a DROP CONSTRAINT IF EXISTS game_0a_status_check;
ALTER TABLE game_0a ADD CONSTRAINT game_0a_status_check
  CHECK (status IN ('대기중', '진행중', '결과선택중', '완료'));

-- ※ Supabase Realtime: Database → Replication에서 game_0a 테이블 Realtime 활성화 필요
