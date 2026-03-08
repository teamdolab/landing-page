-- ============================================
-- 대선포커(GAME 0A) 스키마
-- ============================================

DROP TABLE IF EXISTS game_0a CASCADE;

-- ============================================
-- game_0a 테이블 (대선포커 게임 전체 정보)
-- ============================================
CREATE TABLE game_0a (
    game_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(20) NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    
    -- 게임 메타 정보
    player_count INTEGER NOT NULL CHECK (player_count >= 8 AND player_count <= 12),
    current_round INTEGER DEFAULT 1 CHECK (current_round >= 1 AND current_round <= 4),
    current_step INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT '대기중' CHECK (status IN ('대기중', '진행중', '완료')),
    
    -- 플레이어 정보 (JSON 배열)
    -- [{player_number: 1, is_first: true, is_candidate: false, revealed_cards: [], total_score: 0, round_scores: [0,0,0,0]}]
    players JSONB DEFAULT '[]'::jsonb,
    
    -- 현재 라운드 상태
    timer_seconds INTEGER DEFAULT 0,
    timer_active BOOLEAN DEFAULT false,
    current_player INTEGER, -- 현재 액션 차례인 플레이어 번호
    info_text TEXT, -- 송출용 화면의 info session 텍스트
    
    -- 커뮤니티 카드 (플랍, 턴, 리버)
    community_cards JSONB DEFAULT '[]'::jsonb, -- ['S2', 'D5', 'H10'] 형식
    
    -- 투표 기록 (라운드별)
    -- {1: [{voter: 1, voted_for: 3}, {voter: 2, voted_for: null}], 2: [...]}
    votes JSONB DEFAULT '{}'::jsonb,
    
    -- 액션 히스토리 (Undo용)
    -- [{timestamp, action_type, player_number, data}, ...]
    action_history JSONB DEFAULT '[]'::jsonb,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_game_0a_session ON game_0a(session_id);
CREATE INDEX idx_game_0a_status ON game_0a(status);

-- 코멘트
COMMENT ON TABLE game_0a IS '대선포커 게임 정보 (GAME 0A)';
COMMENT ON COLUMN game_0a.players IS '플레이어 정보 배열 (JSON)';
COMMENT ON COLUMN game_0a.votes IS '라운드별 투표 기록 (JSON)';
COMMENT ON COLUMN game_0a.action_history IS 'Undo를 위한 액션 히스토리 (JSON)';
COMMENT ON COLUMN game_0a.community_cards IS '커뮤니티 카드 (플랍, 턴, 리버)';
COMMENT ON COLUMN game_0a.info_text IS '송출용 화면 info session 텍스트';

-- ============================================
-- 자동화 트리거
-- ============================================

-- updated_at 자동 갱신
CREATE TRIGGER update_game_0a_updated_at
    BEFORE UPDATE ON game_0a
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 유틸리티 함수
-- ============================================

-- 게임 초기화 함수
CREATE OR REPLACE FUNCTION initialize_poker_game(
    p_session_id VARCHAR,
    p_player_count INTEGER
)
RETURNS UUID AS $$
DECLARE
    v_game_id UUID;
    v_players JSONB;
    i INTEGER;
BEGIN
    -- 플레이어 배열 생성
    v_players := '[]'::jsonb;
    FOR i IN 1..p_player_count LOOP
        v_players := v_players || jsonb_build_object(
            'player_number', i,
            'is_first', false,
            'is_candidate', false,
            'revealed_cards', '[]'::jsonb,
            'total_score', 0,
            'round_scores', '[0,0,0,0]'::jsonb
        );
    END LOOP;
    
    -- 게임 생성
    INSERT INTO game_0a (
        session_id,
        player_count,
        players,
        info_text
    ) VALUES (
        p_session_id,
        p_player_count,
        v_players,
        '플레이어 수 설정 완료. 1라운드를 시작하세요.'
    ) RETURNING game_id INTO v_game_id;
    
    RETURN v_game_id;
END;
$$ LANGUAGE plpgsql;

-- 액션 추가 함수 (Undo를 위한 히스토리)
CREATE OR REPLACE FUNCTION add_poker_action(
    p_game_id UUID,
    p_action_type VARCHAR,
    p_player_number INTEGER,
    p_action_data JSONB
)
RETURNS void AS $$
BEGIN
    UPDATE game_0a
    SET action_history = action_history || jsonb_build_object(
        'timestamp', NOW(),
        'action_type', p_action_type,
        'player_number', p_player_number,
        'data', p_action_data
    )
    WHERE game_id = p_game_id;
END;
$$ LANGUAGE plpgsql;

-- 마지막 액션 Undo 함수
CREATE OR REPLACE FUNCTION undo_last_action(p_game_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_last_action JSONB;
    v_action_type TEXT;
    v_player_number INT;
    v_action_data JSONB;
    v_current_round INT;
    v_current_step INT;
BEGIN
    -- 현재 상태 가져오기
    SELECT current_round, current_step INTO v_current_round, v_current_step
    FROM game_0a
    WHERE game_id = p_game_id;
    
    -- 마지막 액션 가져오기
    SELECT action_history->-1 INTO v_last_action
    FROM game_0a
    WHERE game_id = p_game_id;
    
    IF v_last_action IS NULL THEN
        RAISE EXCEPTION 'Undo할 액션이 없습니다.';
    END IF;
    
    v_action_type := v_last_action->>'action_type';
    v_player_number := (v_last_action->>'player_number')::INT;
    v_action_data := v_last_action->'action_data';
    
    -- 액션 타입별로 상태 복원
    CASE v_action_type
        -- Step 0 → 1: 라운드 시작
        WHEN 'start_round' THEN
            UPDATE game_0a SET 
                current_step = 0,
                info_text = v_current_round || '라운드를 시작하세요.'
            WHERE game_id = p_game_id;
        
        -- Step 1 → 2: 선 플레이어 선택
        WHEN 'select_first' THEN
            UPDATE game_0a SET 
                current_step = 1,
                players = (
                    SELECT jsonb_agg(
                        CASE 
                            WHEN (elem->>'player_number')::INT = v_player_number 
                            THEN elem - 'is_first' || jsonb_build_object('is_first', false)
                            ELSE elem
                        END
                    )
                    FROM jsonb_array_elements(players) elem
                ),
                info_text = '선 플레이어를 선택하세요'
            WHERE game_id = p_game_id;
        
        -- Step 2 → 3: 카드 딜링 완료
        WHEN 'dealing_complete' THEN
            UPDATE game_0a SET 
                current_step = 2,
                info_text = '딜러가 카드를 딜링하고 플랍을 오픈하세요'
            WHERE game_id = p_game_id;
        
        -- Step 3 시작: 전략회의 I 시작
        WHEN 'strategy_meeting_1_start' THEN
            UPDATE game_0a SET 
                current_step = 3,
                timer_active = false,
                timer_seconds = 0,
                info_text = '전략회의 I을 시작하세요'
            WHERE game_id = p_game_id;
        
        -- Step 3 → 4: 전략회의 I 종료
        WHEN 'strategy_meeting_1_end' THEN
            UPDATE game_0a SET 
                current_step = 3,
                timer_active = true,
                timer_seconds = 480,
                current_player = NULL,
                info_text = '전략회의 I 진행 중'
            WHERE game_id = p_game_id;
        
        -- Step 4: 후보 출마
        WHEN 'candidacy' THEN
            DECLARE
                v_first_player_num INT;
                v_all_players JSONB;
                v_prev_player_num INT;
            BEGIN
                -- 선 플레이어 찾기
                SELECT (elem->>'player_number')::INT INTO v_first_player_num
                FROM jsonb_array_elements(players) elem
                WHERE (elem->>'is_first')::BOOLEAN = true
                LIMIT 1;
                
                -- 이 플레이어의 후보 상태 해제
                UPDATE game_0a SET 
                    players = (
                        SELECT jsonb_agg(
                            CASE 
                                WHEN (elem->>'player_number')::INT = v_player_number 
                                THEN elem - 'is_candidate' || jsonb_build_object('is_candidate', false)
                                ELSE elem
                            END
                        )
                        FROM jsonb_array_elements(players) elem
                    )
                WHERE game_id = p_game_id;
                
                -- 이전 플레이어로 current_player 되돌리기
                SELECT players INTO v_all_players FROM game_0a WHERE game_id = p_game_id;
                
                -- 이전 플레이어 번호 계산 (순환)
                v_prev_player_num := v_player_number - 1;
                IF v_prev_player_num < v_first_player_num THEN
                    v_prev_player_num := (SELECT MAX((elem->>'player_number')::INT) FROM jsonb_array_elements(v_all_players) elem);
                END IF;
                
                -- v_player_number가 첫 번째였다면 step을 3으로
                IF v_player_number = v_first_player_num THEN
                    UPDATE game_0a SET 
                        current_step = 3,
                        current_player = NULL,
                        timer_active = false,
                        timer_seconds = 0,
                        info_text = '전략회의 I을 시작하세요'
                    WHERE game_id = p_game_id;
                ELSE
                    UPDATE game_0a SET 
                        current_player = v_prev_player_num,
                        timer_seconds = 20,
                        info_text = '후보 출마 선언 중'
                    WHERE game_id = p_game_id;
                END IF;
            END;
        
        -- Step 5: 카드 공개
        WHEN 'reveal_cards' THEN
            DECLARE
                v_candidates JSONB;
                v_prev_candidate INT;
            BEGIN
                -- 이 플레이어의 공개 카드 제거
                UPDATE game_0a SET 
                    players = (
                        SELECT jsonb_agg(
                            CASE 
                                WHEN (elem->>'player_number')::INT = v_player_number 
                                THEN elem - 'revealed_cards' || jsonb_build_object('revealed_cards', '[]'::jsonb)
                                ELSE elem
                            END
                        )
                        FROM jsonb_array_elements(players) elem
                    )
                WHERE game_id = p_game_id;
                
                -- 후보자 목록 가져오기
                SELECT jsonb_agg(elem ORDER BY (elem->>'player_number')::INT) INTO v_candidates
                FROM jsonb_array_elements((SELECT players FROM game_0a WHERE game_id = p_game_id)) elem
                WHERE (elem->>'is_candidate')::BOOLEAN = true;
                
                -- 이전 후보자 찾기
                SELECT (elem->>'player_number')::INT INTO v_prev_candidate
                FROM jsonb_array_elements(v_candidates) WITH ORDINALITY arr(elem, idx)
                WHERE idx < (
                    SELECT arr_idx.idx
                    FROM jsonb_array_elements(v_candidates) WITH ORDINALITY arr_idx(elem_idx, idx)
                    WHERE (elem_idx->>'player_number')::INT = v_player_number
                )
                ORDER BY idx DESC
                LIMIT 1;
                
                -- 첫 번째 후보였다면 step 4로
                IF v_prev_candidate IS NULL THEN
                    UPDATE game_0a SET 
                        current_step = 4,
                        current_player = NULL,
                        timer_seconds = 20,
                        info_text = '후보 출마 선언 중'
                    WHERE game_id = p_game_id;
                ELSE
                    UPDATE game_0a SET 
                        current_player = v_prev_candidate,
                        timer_seconds = 20,
                        info_text = '후보 ' || v_prev_candidate || '번 연설 중'
                    WHERE game_id = p_game_id;
                END IF;
            END;
        
        -- Step 6: 턴 오픈
        WHEN 'turn_open' THEN
            UPDATE game_0a SET 
                current_step = 5,
                info_text = '후보자 연설 중'
            WHERE game_id = p_game_id;
        
        -- Step 7 시작: 전략회의 II 시작
        WHEN 'strategy_meeting_2_start' THEN
            UPDATE game_0a SET 
                current_step = 7,
                timer_active = false,
                timer_seconds = 0,
                info_text = '전략회의 II를 시작하세요'
            WHERE game_id = p_game_id;
        
        -- Step 7 → 8: 전략회의 II 종료
        WHEN 'strategy_meeting_2_end' THEN
            UPDATE game_0a SET 
                current_step = 7,
                timer_active = true,
                timer_seconds = 480,
                current_player = NULL,
                info_text = '전략회의 II 진행 중'
            WHERE game_id = p_game_id;
        
        -- Step 8: 투표
        WHEN 'vote' THEN
            DECLARE
                v_voters JSONB;
                v_prev_voter INT;
                v_round_key TEXT;
                v_current_votes JSONB;
            BEGIN
                v_round_key := v_current_round::TEXT;
                
                -- 이 투표 제거
                SELECT votes->v_round_key INTO v_current_votes
                FROM game_0a WHERE game_id = p_game_id;
                
                UPDATE game_0a SET 
                    votes = votes || jsonb_build_object(
                        v_round_key,
                        (SELECT jsonb_agg(elem)
                         FROM jsonb_array_elements(v_current_votes) elem
                         WHERE (elem->>'voter')::INT != v_player_number)
                    )
                WHERE game_id = p_game_id;
                
                -- 유권자 목록 가져오기
                SELECT jsonb_agg(elem ORDER BY (elem->>'player_number')::INT) INTO v_voters
                FROM jsonb_array_elements((SELECT players FROM game_0a WHERE game_id = p_game_id)) elem
                WHERE (elem->>'is_candidate')::BOOLEAN = false;
                
                -- 이전 유권자 찾기
                SELECT (elem->>'player_number')::INT INTO v_prev_voter
                FROM jsonb_array_elements(v_voters) WITH ORDINALITY arr(elem, idx)
                WHERE idx < (
                    SELECT arr_idx.idx
                    FROM jsonb_array_elements(v_voters) WITH ORDINALITY arr_idx(elem_idx, idx)
                    WHERE (elem_idx->>'player_number')::INT = v_player_number
                )
                ORDER BY idx DESC
                LIMIT 1;
                
                -- 첫 번째 유권자였다면 step 7로
                IF v_prev_voter IS NULL THEN
                    UPDATE game_0a SET 
                        current_step = 7,
                        current_player = NULL,
                        timer_active = false,
                        timer_seconds = 0,
                        info_text = '전략회의 II를 시작하세요'
                    WHERE game_id = p_game_id;
                ELSE
                    UPDATE game_0a SET 
                        current_player = v_prev_voter,
                        timer_seconds = 20,
                        info_text = '유권자 투표 중'
                    WHERE game_id = p_game_id;
                END IF;
            END;
        
        -- Step 9: 점수 계산
        WHEN 'calculate_scores' THEN
            DECLARE
                v_round_key TEXT;
            BEGIN
                v_round_key := v_current_round::TEXT;
                
                -- 이번 라운드 점수 초기화
                UPDATE game_0a SET 
                    current_step = 8,
                    players = (
                        SELECT jsonb_agg(
                            elem || jsonb_build_object(
                                'round_scores', 
                                (SELECT jsonb_agg(COALESCE(score_elem, 0))
                                 FROM jsonb_array_elements((elem->'round_scores')) WITH ORDINALITY arr(score_elem, score_idx)
                                 WHERE score_idx < v_current_round)
                            ) || jsonb_build_object(
                                'total_score',
                                (SELECT SUM((score_elem)::INT)
                                 FROM jsonb_array_elements((elem->'round_scores')) WITH ORDINALITY arr(score_elem, score_idx)
                                 WHERE score_idx < v_current_round)
                            )
                        )
                        FROM jsonb_array_elements(players) elem
                    ),
                    votes = votes - v_round_key,
                    info_text = '유권자 투표 중'
                WHERE game_id = p_game_id;
            END;
        
        ELSE
            RAISE NOTICE '알 수 없는 액션 타입: %', v_action_type;
    END CASE;
    
    -- 히스토리에서 마지막 액션 제거
    UPDATE game_0a
    SET action_history = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements(action_history) WITH ORDINALITY arr(elem, idx)
        WHERE idx < jsonb_array_length(action_history)
    )
    WHERE game_id = p_game_id;
    
    RETURN v_last_action;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS 비활성화 (개발용)
-- ============================================
ALTER TABLE game_0a DISABLE ROW LEVEL SECURITY;

-- ============================================
-- Realtime 활성화
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE game_0a;

-- ============================================
-- Realtime 활성화 안내
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=========================================';
    RAISE NOTICE '✅ 대선포커(GAME 0A) 스키마 생성 완료!';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '생성된 테이블:';
    RAISE NOTICE '  - game_0a (대선포커 게임 전체 정보)';
    RAISE NOTICE '';
    RAISE NOTICE '생성된 함수:';
    RAISE NOTICE '  - initialize_poker_game() (게임 초기화)';
    RAISE NOTICE '  - add_poker_action() (액션 히스토리 추가)';
    RAISE NOTICE '  - undo_last_action() (마지막 액션 취소)';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  다음 단계:';
    RAISE NOTICE '1. Supabase Dashboard → Database → Replication';
    RAISE NOTICE '2. game_0a 테이블의 Realtime 활성화';
    RAISE NOTICE '=========================================';
END $$;
