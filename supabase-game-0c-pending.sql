-- game_0c_snapshot에 pending 컬럼 추가 (부스 일반접촉 대기 상태)

ALTER TABLE game_0c_snapshot
  ADD COLUMN IF NOT EXISTS pending JSONB;

COMMENT ON COLUMN game_0c_snapshot.pending IS '부스 대기 상태 예: {type:"normal_contact", player_a:3, at:"..."}';
