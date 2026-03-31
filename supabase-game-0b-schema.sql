-- ============================================
-- 수송선게임 (game_0b) — 스냅샷 + 이벤트 로그
--
-- [필수] Supabase 대시보드 → SQL Editor → New query → 이 파일 전체 실행 후 Run
--   · "Could not find the table public.game_0b" 오류는 이 스크립트 미실행 시 발생합니다.
--   · 전제: sessions 테이블, update_updated_at_column() 함수가 이미 있어야 합니다.
--   · publication 추가 줄에서 이미 등록됨 오류가 나면 해당 줄만 무시해도 됩니다.
-- ============================================

DROP TABLE IF EXISTS game_0b_event CASCADE;
DROP TABLE IF EXISTS game_0b CASCADE;

-- --------------------------------------------
-- 스냅샷: 세션당 1행
-- --------------------------------------------
CREATE TABLE game_0b (
  game_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(20) NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,

  status VARCHAR(20) NOT NULL DEFAULT '대기중'
    CHECK (status IN ('대기중', '진행중', '완료')),

  player_count INTEGER NOT NULL DEFAULT 12 CHECK (player_count >= 8 AND player_count <= 12),
  current_round INTEGER NOT NULL DEFAULT 1 CHECK (current_round >= 1 AND current_round <= 5),
  phase VARCHAR(20) NOT NULL DEFAULT 'setup'
    CHECK (phase IN ('setup', 'day', 'night', 'morning')),
  first_player_number INTEGER CHECK (first_player_number IS NULL OR (first_player_number >= 1 AND first_player_number <= 12)),
  phase_deadline_at TIMESTAMPTZ,

  -- 수송선: 0 이하 가능 (음수까지 하락)
  ship_hull INTEGER NOT NULL DEFAULT 100,

  -- 밤 액션 처리용
  night_action_count INTEGER NOT NULL DEFAULT 0,
  detected_actions JSONB NOT NULL DEFAULT '[]'::jsonb,

  commander_player_number INTEGER CHECK (commander_player_number IS NULL OR (commander_player_number >= 1 AND commander_player_number <= 12)),
  revolutionary_player_number INTEGER CHECK (revolutionary_player_number IS NULL OR (revolutionary_player_number >= 1 AND revolutionary_player_number <= 12)),
  former_commander_player_number INTEGER CHECK (former_commander_player_number IS NULL OR (former_commander_player_number >= 1 AND former_commander_player_number <= 12)),

  info_text TEXT,
  last_public_transfer_from INTEGER CHECK (last_public_transfer_from IS NULL OR (last_public_transfer_from >= 1 AND last_public_transfer_from <= 12)),
  last_public_transfer_at TIMESTAMPTZ,

  result_locked BOOLEAN NOT NULL DEFAULT FALSE,
  lifeboat_seat_1 INTEGER CHECK (lifeboat_seat_1 IS NULL OR (lifeboat_seat_1 >= 1 AND lifeboat_seat_1 <= 12)),
  lifeboat_seat_2 INTEGER CHECK (lifeboat_seat_2 IS NULL OR (lifeboat_seat_2 >= 1 AND lifeboat_seat_2 <= 12)),
  lifeboat_seat_3 INTEGER CHECK (lifeboat_seat_3 IS NULL OR (lifeboat_seat_3 >= 1 AND lifeboat_seat_3 <= 12)),
  lifeboat_seat_4 INTEGER CHECK (lifeboat_seat_4 IS NULL OR (lifeboat_seat_4 >= 1 AND lifeboat_seat_4 <= 12)),
  lifeboat_seat_5 INTEGER CHECK (lifeboat_seat_5 IS NULL OR (lifeboat_seat_5 >= 1 AND lifeboat_seat_5 <= 12)),

  player_01_role VARCHAR(32), player_01_core INTEGER NOT NULL DEFAULT 0,
  player_02_role VARCHAR(32), player_02_core INTEGER NOT NULL DEFAULT 0,
  player_03_role VARCHAR(32), player_03_core INTEGER NOT NULL DEFAULT 0,
  player_04_role VARCHAR(32), player_04_core INTEGER NOT NULL DEFAULT 0,
  player_05_role VARCHAR(32), player_05_core INTEGER NOT NULL DEFAULT 0,
  player_06_role VARCHAR(32), player_06_core INTEGER NOT NULL DEFAULT 0,
  player_07_role VARCHAR(32), player_07_core INTEGER NOT NULL DEFAULT 0,
  player_08_role VARCHAR(32), player_08_core INTEGER NOT NULL DEFAULT 0,
  player_09_role VARCHAR(32), player_09_core INTEGER NOT NULL DEFAULT 0,
  player_10_role VARCHAR(32), player_10_core INTEGER NOT NULL DEFAULT 0,
  player_11_role VARCHAR(32), player_11_core INTEGER NOT NULL DEFAULT 0,
  player_12_role VARCHAR(32), player_12_core INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (session_id)
);

CREATE INDEX idx_game_0b_session ON game_0b(session_id);
CREATE INDEX idx_game_0b_status ON game_0b(status);

CREATE TRIGGER update_game_0b_updated_at
  BEFORE UPDATE ON game_0b
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE game_0b IS 'GAME 0B 스냅샷 (송출/진행/테스트룸 공통 현재 상태)';
COMMENT ON COLUMN game_0b.ship_hull IS '수송선 체력 (0 이하·음수 가능)';

-- --------------------------------------------
-- 이벤트 로그 (append, undo/히스토리용)
-- --------------------------------------------
CREATE TABLE game_0b_event (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES game_0b(game_id) ON DELETE CASCADE,
  -- 0 = 미할당(트리거가 max+1로 채움). 수동 삽입 시 1 이상 직접 지정 가능
  seq INTEGER NOT NULL DEFAULT 0,
  event_type VARCHAR(64) NOT NULL,
  source VARCHAR(16) NOT NULL CHECK (source IN ('host', 'testroom', 'system')),
  actor_player_number INTEGER CHECK (actor_player_number IS NULL OR (actor_player_number >= 1 AND actor_player_number <= 12)),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  voided_at TIMESTAMPTZ,
  superseded_by BIGINT REFERENCES game_0b_event(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (game_id, seq)
);

CREATE INDEX idx_game_0b_event_game_seq ON game_0b_event(game_id, seq);
CREATE INDEX idx_game_0b_event_created ON game_0b_event(created_at);

-- seq 자동 부여 (INSERT 시 생략 가능하도록: 앱에서 seq 넣지 않으면 자동)
CREATE OR REPLACE FUNCTION game_0b_event_assign_seq()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.seq = 0 THEN
    SELECT COALESCE(MAX(seq), 0) + 1 INTO NEW.seq FROM game_0b_event WHERE game_id = NEW.game_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_game_0b_event_seq
  BEFORE INSERT ON game_0b_event
  FOR EACH ROW
  EXECUTE FUNCTION game_0b_event_assign_seq();

COMMENT ON TABLE game_0b_event IS 'GAME 0B 이벤트 로그 (event_data JSON)';
COMMENT ON COLUMN game_0b_event.event_data IS '이벤트별 상세 필드 (JSON)';

-- Realtime (이미 있으면 에러 무시 가능)
ALTER PUBLICATION supabase_realtime ADD TABLE game_0b;
ALTER PUBLICATION supabase_realtime ADD TABLE game_0b_event;
