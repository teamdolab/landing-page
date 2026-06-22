-- ============================================
-- 공통 입퇴장·정산 모듈 토대
-- 게임별 흐름에 연결하지 않고, 공통 정산 영수증과 활성 회차 포인터만 추가합니다.
-- ============================================

-- 이 테이블은 플레이어별 정산 영수증을 한 회차·한 플레이어당 한 장만 보관합니다.
CREATE TABLE IF NOT EXISTS session_player_results (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    TEXT        NOT NULL,
  game_type     TEXT        NOT NULL,
  user_id       UUID,
  player_number INTEGER     NOT NULL,
  credit_before INTEGER     NOT NULL,
  credit_delta  INTEGER     NOT NULL,
  credit_after  INTEGER     NOT NULL,
  rank          INTEGER,
  raw           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed')),
  settled_at    TIMESTAMPTZ NOT NULL,
  claimed_at    TIMESTAMPTZ,

  CONSTRAINT session_player_results_session_player_unique UNIQUE (session_id, player_number)
);

CREATE INDEX IF NOT EXISTS idx_session_player_results_session
  ON session_player_results(session_id);

CREATE INDEX IF NOT EXISTS idx_session_player_results_user
  ON session_player_results(user_id);

CREATE INDEX IF NOT EXISTS idx_session_player_results_status
  ON session_player_results(status);

COMMENT ON TABLE session_player_results IS '회차별 플레이어 정산 영수증: pending이면 아직 수령 전, claimed이면 수령 완료';
COMMENT ON COLUMN session_player_results.credit_delta IS '게임이 계산해서 넘긴 지급/차감 크레딧 변화량';
COMMENT ON COLUMN session_player_results.raw IS '게임별 원본 결과 보관용 JSON';

-- 이 테이블은 지금 운영 중인 회차 ID 한 개만 저장하는 공통 포인터입니다.
CREATE TABLE IF NOT EXISTS active_session_pointer (
  id         BOOLEAN     PRIMARY KEY DEFAULT TRUE CHECK (id),
  session_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO active_session_pointer (id, session_id)
VALUES (TRUE, NULL)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE active_session_pointer IS '현재 활성 회차 session_id를 한 곳에 보관하는 단일 행 설정 테이블';
COMMENT ON COLUMN active_session_pointer.session_id IS '현재 활성 회차 ID. 비어 있으면 활성 회차 없음';
