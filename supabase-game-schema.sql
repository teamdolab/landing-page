-- ============================================
-- 대선포커 게임 시스템 스키마
-- ============================================

-- 기존 테이블 삭제 (재생성 시)
DROP TABLE IF EXISTS game_players CASCADE;
DROP TABLE IF EXISTS game_state CASCADE;
DROP TABLE IF EXISTS game_sessions CASCADE;

-- ============================================
-- 1. game_sessions (게임 세션)
-- ============================================
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_type VARCHAR(50) DEFAULT '대선포커',
    session_date DATE NOT NULL,
    player_count INTEGER NOT NULL CHECK (player_count >= 8 AND player_count <= 12),
    current_round INTEGER DEFAULT 1 CHECK (current_round >= 1 AND current_round <= 4),
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. game_state (게임 상태 - 실시간 동기화)
-- 오프라인 게임: 커뮤니티 카드는 송출용, deck_remaining은 미사용
-- ============================================
CREATE TABLE game_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID UNIQUE NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    round INTEGER DEFAULT 1 CHECK (round >= 1 AND round <= 4),
    step INTEGER DEFAULT 1,
    phase VARCHAR(50), -- '카드 딜링', '플랍 오픈', '전략회의 I', '출마 선언' 등
    first_player INTEGER CHECK (first_player >= 1 AND first_player <= 12),
    current_player INTEGER CHECK (current_player >= 1 AND current_player <= 12),
    timer_seconds INTEGER DEFAULT 0,
    timer_active BOOLEAN DEFAULT FALSE,
    community_cards JSONB DEFAULT '[]'::jsonb, -- 송출 화면 표시용만
    deck_remaining JSONB DEFAULT '[]'::jsonb, -- 미사용 (오프라인 딜링)
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. game_players (플레이어 상태)
-- 오프라인 게임: hand_cards 제거, revealed_cards는 주장 카드
-- ============================================
CREATE TABLE game_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_number INTEGER NOT NULL CHECK (player_number >= 1 AND player_number <= 12),
    revealed_cards JSONB DEFAULT '[]'::jsonb, -- 후보자가 주장한 카드 2장 (실제와 다를 수 있음)
    status VARCHAR(20), -- 'run', 'giveup', null (아직 선언 안함)
    vote_to INTEGER, -- 투표한 후보 번호 (기권은 0)
    total_score INTEGER DEFAULT 0, -- 전체 점수
    round_score INTEGER DEFAULT 0, -- 이번 라운드 점수
    is_first_player BOOLEAN DEFAULT FALSE, -- 선 플레이어 여부
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, player_number)
);

-- ============================================
-- 4. 인덱스
-- ============================================
CREATE INDEX idx_game_state_session ON game_state(session_id);
CREATE INDEX idx_game_players_session ON game_players(session_id);
CREATE INDEX idx_game_players_number ON game_players(session_id, player_number);

-- ============================================
-- 5. 자동 업데이트 트리거
-- ============================================
-- game_sessions 업데이트 트리거
CREATE TRIGGER update_game_sessions_updated_at
    BEFORE UPDATE ON game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- game_state 업데이트 트리거
CREATE TRIGGER update_game_state_updated_at
    BEFORE UPDATE ON game_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- game_players 업데이트 트리거
CREATE TRIGGER update_game_players_updated_at
    BEFORE UPDATE ON game_players
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. 유틸리티 함수 (오프라인 게임용으로 간소화)
-- ============================================

-- 게임 초기화 함수 (카드 덱 관련 로직 제거)
CREATE OR REPLACE FUNCTION initialize_game(p_session_id UUID, p_player_count INTEGER)
RETURNS VOID AS $$
BEGIN
    -- game_state 생성 (덱은 사용하지 않음)
    INSERT INTO game_state (
        session_id, round, step, phase, 
        timer_seconds, timer_active
    ) VALUES (
        p_session_id, 1, 1, '선 정하기',
        0, FALSE
    );
    
    -- game_players 생성 (1~player_count)
    FOR i IN 1..p_player_count LOOP
        INSERT INTO game_players (
            session_id, player_number, total_score, round_score
        ) VALUES (
            p_session_id, i, 0, 0
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Row Level Security (개발용 비활성화)
-- ============================================
ALTER TABLE game_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_players DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 완료 메시지
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ 대선포커 게임 스키마 생성 완료! (오프라인 게임 버전)';
    RAISE NOTICE '테이블: game_sessions, game_state, game_players';
    RAISE NOTICE '함수: initialize_game()';
    RAISE NOTICE '💡 오프라인 게임: 카드 딜링은 딜러가 직접, 족보 계산도 딜러가 수동 선택';
END $$;
