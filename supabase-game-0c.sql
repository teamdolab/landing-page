-- 좀비게임(game_0c) 스키마
-- 적용: Supabase Dashboard > SQL Editor에서 실행
-- 주의: game_0c_event는 append-only. 직접 UPDATE/DELETE 금지.
--
-- 전제: sessions 테이블, update_updated_at_column() 함수가 이미 있어야 합니다.
-- publication 추가 줄에서 이미 등록됨 오류가 나면 해당 줄만 무시해도 됩니다.

-- --------------------------------------------
-- 기존 game_0c 테이블 제거 (재실행용)
-- --------------------------------------------
DROP TABLE IF EXISTS game_0c_event CASCADE;
DROP TABLE IF EXISTS game_0c_public CASCADE;
DROP TABLE IF EXISTS game_0c_snapshot CASCADE;

-- --------------------------------------------
-- [테이블 1] game_0c_event — 이벤트 로그 (진실원천, append-only)
-- --------------------------------------------
CREATE TABLE game_0c_event (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  round INT NOT NULL,
  event_type TEXT NOT NULL,
  actor_player INT,
  target_player INT,
  payload_public JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_private JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_reverted BOOLEAN NOT NULL DEFAULT FALSE,
  reverted_by BIGINT REFERENCES game_0c_event(id),
  created_by TEXT CHECK (created_by IS NULL OR created_by IN ('booth', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_game_0c_event_session_round ON game_0c_event(session_id, round);
CREATE INDEX idx_game_0c_event_session_created ON game_0c_event(session_id, created_at);

COMMENT ON TABLE game_0c_event IS '좀비게임(game_0c) 이벤트 로그 — append-only 진실원천';
COMMENT ON COLUMN game_0c_event.payload_private IS '운영자 전용 비공개 페이로드';
COMMENT ON COLUMN game_0c_event.is_reverted IS '되돌림 대상 여부 (되돌리기는 새 행 추가로만)';

-- RLS: anon/authenticated 차단, service_role만 접근 (service_role은 RLS 우회)
ALTER TABLE game_0c_event ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------
-- [테이블 2] game_0c_public — 디스플레이 전용 공개 스냅샷
-- 점수·상태·결과 컬럼은 이 테이블에 추가하지 않는다.
-- --------------------------------------------
CREATE TABLE game_0c_public (
  session_id TEXT PRIMARY KEY,
  round INT,
  phase TEXT CHECK (
    phase IS NULL OR phase IN ('ROUND_OPEN', 'BIDDING', 'FORCE', 'OPEN', 'CLOSED')
  ),
  timer_end TIMESTAMPTZ,
  force_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  bid_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  force_pairs JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_game_0c_public_updated_at
  BEFORE UPDATE ON game_0c_public
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE game_0c_public IS '좀비게임(game_0c) 디스플레이용 공개 스냅샷';
COMMENT ON COLUMN game_0c_public.force_candidates IS '[{player, order}]';
COMMENT ON COLUMN game_0c_public.bid_results IS '[{player, bids}]';
COMMENT ON COLUMN game_0c_public.force_pairs IS '[{round, pair:[A,B], at}]';

ALTER TABLE game_0c_public ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_0c_public_anon_select"
  ON game_0c_public
  FOR SELECT
  TO anon
  USING (true);

-- INSERT/UPDATE/DELETE: 정책 없음 → anon/authenticated 차단, service_role만 허용

-- --------------------------------------------
-- [테이블 3] game_0c_snapshot — 운영자 전용 풀 상태
-- --------------------------------------------
CREATE TABLE game_0c_snapshot (
  session_id TEXT PRIMARY KEY,
  round INT,
  phase TEXT CHECK (
    phase IS NULL OR phase IN ('ROUND_OPEN', 'BIDDING', 'FORCE', 'OPEN', 'CLOSED')
  ),
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_game_0c_snapshot_updated_at
  BEFORE UPDATE ON game_0c_snapshot
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE game_0c_snapshot IS '좀비게임(game_0c) 운영자 전용 풀 상태 스냅샷';
COMMENT ON COLUMN game_0c_snapshot.players IS '[{num, state, score, slots_left}]';

ALTER TABLE game_0c_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_0c_snapshot_authenticated_select"
  ON game_0c_snapshot
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "game_0c_snapshot_authenticated_update"
  ON game_0c_snapshot
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- anon: 정책 없음 → 차단
-- INSERT/DELETE: authenticated 정책 없음 → service_role만 허용

-- Realtime (디스플레이 실시간 구독용)
ALTER PUBLICATION supabase_realtime ADD TABLE game_0c_public;
