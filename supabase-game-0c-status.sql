-- game_0c_snapshot에 status 컬럼 추가 (control 종료와 동일 개념)

ALTER TABLE game_0c_snapshot
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT '진행중'
  CHECK (status IN ('진행중', '완료'));

COMMENT ON COLUMN game_0c_snapshot.status IS '진행중 | 완료 (control 게임 종료)';
