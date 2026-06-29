-- game_participants: session_id 기반 공통 입장 등록
-- (기존 game_id 컬럼·포커 흐름은 유지)

ALTER TABLE game_participants ADD COLUMN IF NOT EXISTS session_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_participants_session_player
  ON game_participants(session_id, player_number)
  WHERE session_id IS NOT NULL;

COMMENT ON COLUMN game_participants.session_id IS '세션 ID (공통 입장 등록용). 포커(game_0a)는 game_id 경로 유지';
