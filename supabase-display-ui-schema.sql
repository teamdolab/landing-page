-- ============================================
-- 송출용 화면 UI 제어 테이블
-- ============================================

-- 기존 테이블 삭제
DROP TABLE IF EXISTS display_ui_state CASCADE;
DROP TABLE IF EXISTS display_players CASCADE;

-- 1. 송출 화면 메인 상태
CREATE TABLE display_ui_state (
    session_id VARCHAR(20) PRIMARY KEY,
    round INTEGER DEFAULT 1,
    phase VARCHAR(100) DEFAULT '대기 중',
    timer_seconds INTEGER DEFAULT 0,
    timer_active BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 플레이어별 상태 (12명)
CREATE TABLE display_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(20) NOT NULL,
    player_number INTEGER NOT NULL CHECK (player_number >= 1 AND player_number <= 12),
    score INTEGER DEFAULT 0,
    is_first BOOLEAN DEFAULT FALSE,
    is_candidate BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT FALSE,
    cards JSONB DEFAULT '[]'::jsonb, -- [{suit:'♠', rank:'8', color:'black'}, ...]
    voters JSONB DEFAULT '[]'::jsonb, -- [2, 3, 4, 5]
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, player_number)
);

-- 인덱스
CREATE INDEX idx_display_ui_session ON display_ui_state(session_id);
CREATE INDEX idx_display_players_session ON display_players(session_id);
CREATE INDEX idx_display_players_number ON display_players(session_id, player_number);

-- 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_display_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_display_ui_state_timestamp
    BEFORE UPDATE ON display_ui_state
    FOR EACH ROW
    EXECUTE FUNCTION update_display_timestamp();

CREATE TRIGGER update_display_players_timestamp
    BEFORE UPDATE ON display_players
    FOR EACH ROW
    EXECUTE FUNCTION update_display_timestamp();

-- RLS 비활성화 (개발용)
ALTER TABLE display_ui_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE display_players DISABLE ROW LEVEL SECURITY;

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE display_ui_state;
ALTER PUBLICATION supabase_realtime ADD TABLE display_players;

-- ============================================
-- 초기 데이터 삽입 함수
-- ============================================
CREATE OR REPLACE FUNCTION initialize_display(p_session_id VARCHAR, p_player_count INTEGER)
RETURNS VOID AS $$
BEGIN
    -- UI 상태 초기화
    INSERT INTO display_ui_state (session_id, round, phase, timer_seconds, timer_active)
    VALUES (p_session_id, 1, '대기 중', 0, FALSE)
    ON CONFLICT (session_id) DO UPDATE SET
        round = 1,
        phase = '대기 중',
        timer_seconds = 0,
        timer_active = FALSE;
    
    -- 플레이어 초기화 (12명 고정)
    FOR i IN 1..12 LOOP
        INSERT INTO display_players (session_id, player_number, score, is_first, is_candidate, is_active, cards, voters)
        VALUES (p_session_id, i, 0, FALSE, FALSE, FALSE, '[]'::jsonb, '[]'::jsonb)
        ON CONFLICT (session_id, player_number) DO UPDATE SET
            score = 0,
            is_first = FALSE,
            is_candidate = FALSE,
            is_active = FALSE,
            cards = '[]'::jsonb,
            voters = '[]'::jsonb;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 완료 메시지
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ 송출용 화면 UI 테이블 생성 완료!';
    RAISE NOTICE '테이블: display_ui_state, display_players';
    RAISE NOTICE '함수: initialize_display(session_id, player_count)';
END $$;
