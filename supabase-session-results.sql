-- ============================================
-- session_results 테이블 생성
-- 게임 종료 시 공통 포맷으로 세션 결과 저장 (game_0a, game_0b 모두 사용)
-- Supabase SQL Editor에서 실행하세요.
-- ============================================

CREATE TABLE IF NOT EXISTS session_results (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       TEXT,                              -- sessions.id 참조 (소프트 FK)
  game_type        TEXT        NOT NULL,              -- 'game_0a' | 'game_0b' | 향후 추가
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  duration_seconds INTEGER,                           -- ended_at - started_at (초)
  player_count     INTEGER,
  winner_user_ids  UUID[],                            -- 우승자 user_info.id 배열
  result_summary   JSONB       DEFAULT '{}'::jsonb,   -- 게임별 추가 데이터
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_results_session   ON session_results(session_id);
CREATE INDEX IF NOT EXISTS idx_session_results_game_type ON session_results(game_type);
CREATE INDEX IF NOT EXISTS idx_session_results_ended     ON session_results(ended_at DESC);

COMMENT ON TABLE  session_results                     IS '게임 종료 시 1회 저장하는 세션 결과 요약 테이블';
COMMENT ON COLUMN session_results.game_type           IS '''game_0a'' (포커) | ''game_0b'' (수송선)';
COMMENT ON COLUMN session_results.winner_user_ids     IS '우승자 user_info.id UUID 배열';
COMMENT ON COLUMN session_results.result_summary      IS '게임별 추가 숫자: 포커=최고점수, 수송선=ship_hull/탑승인원 등';
