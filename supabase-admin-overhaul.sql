-- ============================================
-- 어드민 운영성 개편 마이그레이션
-- 1) sessions soft delete
-- 2) sessions.game_kind 컬럼 + 백필
-- 3) 마스터 테이블 (stores / seasons / game_types) + 시드
-- 4) 감사 로그 (admin_audit_log)
-- 5) get_session_availability() RPC에 deleted_at 필터 추가
--
-- 실행: Supabase SQL Editor에서 전체 실행 (코드 배포 전에 먼저 실행할 것)
-- ============================================

-- ============================================
-- 1. sessions soft delete
-- ============================================
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_session_deleted ON sessions(deleted_at);

-- ============================================
-- 2. sessions.game_kind + 기존 데이터 백필
--    session_id 9번째 문자(게임타입)로 1회 백필
-- ============================================
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS game_kind VARCHAR(20) DEFAULT 'game_0a';

UPDATE sessions
SET game_kind = CASE
    WHEN LENGTH(session_id) >= 9 AND SUBSTRING(session_id, 9, 1) = 'B' THEN 'game_0b'
    WHEN LENGTH(session_id) >= 9 AND SUBSTRING(session_id, 9, 1) = 'C' THEN 'game_0c'
    ELSE 'game_0a'
END
WHERE game_kind IS NULL OR game_kind = 'game_0a';

-- ============================================
-- 3. 마스터 테이블 + 시드
-- ============================================
CREATE TABLE IF NOT EXISTS stores (
    code CHAR(1) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seasons (
    code CHAR(1) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_types (
    code CHAR(1) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    game_kind VARCHAR(20) NOT NULL DEFAULT 'game_0a',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO stores (code, name) VALUES
    ('A', 'A 매장'),
    ('B', 'B 매장'),
    ('C', 'C 매장')
ON CONFLICT (code) DO NOTHING;

INSERT INTO seasons (code, name) VALUES
    ('0', '시즌 0'),
    ('1', '시즌 1'),
    ('2', '시즌 2')
ON CONFLICT (code) DO NOTHING;

INSERT INTO game_types (code, name, game_kind) VALUES
    ('A', '대선포커', 'game_0a'),
    ('B', '수송선게임', 'game_0b'),
    ('C', '게임3', 'game_0c')
ON CONFLICT (code) DO NOTHING;

-- RLS: 마스터 테이블은 service role로만 접근 (admin API 경유)
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_types ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. 감사 로그
-- ============================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(50) NOT NULL,        -- session_create / session_status / session_delete / deposit_toggle / master_update ...
    target_type VARCHAR(30) NOT NULL,   -- session / apply / store / season / game_type
    target_id VARCHAR(50),
    detail JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. get_session_availability(): 삭제된 세션 제외
-- ============================================
CREATE OR REPLACE FUNCTION get_session_availability()
RETURNS TABLE (
    session_id VARCHAR,
    game_name VARCHAR,
    session_date DATE,
    session_time TIME,
    current_capacity INTEGER,
    max_capacity INTEGER,
    available_slots INTEGER,
    base_price INTEGER,
    status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.session_id,
        s.game_name,
        s.session_date,
        s.session_time,
        s.current_capacity,
        s.max_capacity,
        (s.max_capacity - s.current_capacity) AS available_slots,
        s.base_price,
        s.status
    FROM sessions s
    WHERE s.session_date >= CURRENT_DATE
      AND s.deleted_at IS NULL
    ORDER BY s.session_date, s.session_time;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 완료
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '어드민 운영성 개편 마이그레이션 완료';
END $$;
