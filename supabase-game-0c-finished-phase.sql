-- game_0c phase에 FINISHED 추가 (기존 DB 마이그레이션)

ALTER TABLE game_0c_public DROP CONSTRAINT IF EXISTS game_0c_public_phase_check;
ALTER TABLE game_0c_public ADD CONSTRAINT game_0c_public_phase_check
  CHECK (phase IS NULL OR phase IN ('WAITING', 'ROUND_OPEN', 'BIDDING', 'FORCE', 'OPEN', 'CLOSED', 'FINISHED'));

ALTER TABLE game_0c_snapshot DROP CONSTRAINT IF EXISTS game_0c_snapshot_phase_check;
ALTER TABLE game_0c_snapshot ADD CONSTRAINT game_0c_snapshot_phase_check
  CHECK (phase IS NULL OR phase IN ('WAITING', 'ROUND_OPEN', 'BIDDING', 'FORCE', 'OPEN', 'CLOSED', 'FINISHED'));
