-- ============================================
-- stations: 매장별 팀 자리(블랙팀/화이트팀 등) 등록
-- 서버 API(service_role) 경유로만 조작합니다.
-- Supabase SQL Editor에서 실행하세요.
-- ============================================

CREATE TABLE IF NOT EXISTS stations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name        TEXT        NOT NULL DEFAULT '강남점',
  name              TEXT        NOT NULL,
  active_session_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT stations_store_name_unique UNIQUE (store_name, name)
);

CREATE INDEX IF NOT EXISTS idx_stations_store_name ON stations(store_name);
CREATE INDEX IF NOT EXISTS idx_stations_active_session ON stations(active_session_id);

COMMENT ON TABLE stations IS '매장별 팀 자리(키오스크/게임 진행 위치) 등록';
COMMENT ON COLUMN stations.store_name IS '매장 이름 (예: 강남점)';
COMMENT ON COLUMN stations.name IS '팀 이름 (예: 블랙팀, 화이트팀)';
COMMENT ON COLUMN stations.active_session_id IS '현재 이 자리에서 진행 중인 session_id. 없으면 NULL';

-- RLS: anon/authenticated 차단, service_role은 RLS 우회로 접근
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
