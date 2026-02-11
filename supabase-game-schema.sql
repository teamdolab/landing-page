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
    community_cards JSONB DEFAULT '[]'::jsonb, -- ['S2', 'D5', 'H9', 'C10', 'S8']
    deck_remaining JSONB DEFAULT '[]'::jsonb, -- 남은 카드 덱
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. game_players (플레이어 상태)
-- ============================================
CREATE TABLE game_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_number INTEGER NOT NULL CHECK (player_number >= 1 AND player_number <= 12),
    hand_cards JSONB DEFAULT '[]'::jsonb, -- 손패 2장: ['S7', 'H10']
    revealed_cards JSONB DEFAULT '[]'::jsonb, -- 공개한 카드 2장 (후보자 연설)
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
-- 6. 유틸리티 함수
-- ============================================

-- 6-1. 카드 덱 생성 함수
CREATE OR REPLACE FUNCTION create_card_deck()
RETURNS JSONB AS $$
DECLARE
    deck JSONB := '[]'::jsonb;
    suits TEXT[] := ARRAY['S', 'D', 'H', 'C']; -- Spade, Diamond, Heart, Club
    ranks TEXT[] := ARRAY['2', '3', '4', '5', '6', '7', '8', '9', '10'];
    suit TEXT;
    rank TEXT;
BEGIN
    FOREACH suit IN ARRAY suits LOOP
        FOREACH rank IN ARRAY ranks LOOP
            deck := deck || jsonb_build_array(suit || rank);
        END LOOP;
    END LOOP;
    RETURN deck;
END;
$$ LANGUAGE plpgsql;

-- 6-2. 카드 덱 셔플 함수
CREATE OR REPLACE FUNCTION shuffle_deck(deck JSONB)
RETURNS JSONB AS $$
DECLARE
    shuffled JSONB := '[]'::jsonb;
    deck_array TEXT[];
    i INTEGER;
    j INTEGER;
    temp TEXT;
BEGIN
    -- JSONB를 배열로 변환
    SELECT ARRAY_AGG(value::text) INTO deck_array
    FROM jsonb_array_elements_text(deck);
    
    -- Fisher-Yates shuffle
    FOR i IN REVERSE array_length(deck_array, 1)..2 LOOP
        j := floor(random() * i + 1)::integer;
        temp := deck_array[i];
        deck_array[i] := deck_array[j];
        deck_array[j] := temp;
    END LOOP;
    
    -- 배열을 JSONB로 변환
    SELECT jsonb_agg(card) INTO shuffled
    FROM unnest(deck_array) AS card;
    
    RETURN shuffled;
END;
$$ LANGUAGE plpgsql;

-- 6-3. 게임 초기화 함수
CREATE OR REPLACE FUNCTION initialize_game(p_session_id UUID, p_player_count INTEGER)
RETURNS VOID AS $$
DECLARE
    shuffled_deck JSONB;
BEGIN
    -- 카드 덱 생성 및 셔플
    shuffled_deck := shuffle_deck(create_card_deck());
    
    -- game_state 생성
    INSERT INTO game_state (
        session_id, round, step, phase, 
        deck_remaining, timer_seconds, timer_active
    ) VALUES (
        p_session_id, 1, 1, '선 정하기',
        shuffled_deck, 0, FALSE
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
    RAISE NOTICE '✅ 대선포커 게임 스키마 생성 완료!';
    RAISE NOTICE '테이블: game_sessions, game_state, game_players';
    RAISE NOTICE '함수: create_card_deck(), shuffle_deck(), initialize_game()';
END $$;
