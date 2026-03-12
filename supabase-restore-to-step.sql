-- ============================================
-- restore_to_step: action_history 로그를 읽어 목표 (round, step) 상태로 직접 복원
-- undo 반복 호출 대신, 로그 기반으로 상태를 구현
-- supabase-undo-v2.sql 실행 후 적용
-- ============================================

CREATE OR REPLACE FUNCTION restore_to_step(p_game_id UUID, p_target_round INT, p_target_step INT)
RETURNS JSONB AS $$
DECLARE
  v_history JSONB;
  v_len INT;
  v_idx INT;
  v_action JSONB;
  v_action_type TEXT;
  v_player_number INT;
  v_current_round INT;
  v_current_step INT;
  v_first_num INT;
  v_decl JSONB;
  v_player_count INT;
  v_prev_num INT;
  v_candidates JSONB;
  v_prev_candidate INT;
  v_round_key TEXT;
  v_current_votes JSONB;
  v_voters JSONB;
  v_prev_voter INT;
  v_prev_first INT;
  v_new_first INT;
  v_max_iter INT := 100;
  v_iter INT := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM game_0a WHERE game_id = p_game_id) THEN
    RAISE EXCEPTION '게임을 찾을 수 없습니다.';
  END IF;

  -- action_history에서 목표 (round, step)에 도달할 때까지 뒤에서부터 액션 제거하며 상태 복원
  LOOP
    v_iter := v_iter + 1;
    IF v_iter > v_max_iter THEN
      RAISE EXCEPTION '최대 %회까지 되돌리기 가능', v_max_iter;
    END IF;

    SELECT current_round, current_step INTO v_current_round, v_current_step
    FROM game_0a WHERE game_id = p_game_id;

    IF v_current_round = p_target_round AND v_current_step = p_target_step THEN
      RETURN (SELECT to_jsonb(g.*) FROM game_0a g WHERE game_id = p_game_id);
    END IF;

    SELECT action_history INTO v_history FROM game_0a WHERE game_id = p_game_id;
    v_len := jsonb_array_length(COALESCE(v_history, '[]'::jsonb));
    IF v_len = 0 THEN
      RAISE EXCEPTION '되돌릴 액션이 없습니다. (현재 %라운드 %단계)', v_current_round, v_current_step;
    END IF;

    v_action := v_history->(v_len - 1);
    v_action_type := v_action->>'action_type';
    v_player_number := COALESCE((v_action->>'player_number')::INT, 0);

    SELECT first_player_number, COALESCE(declaration_results, '{}'::jsonb), COALESCE(player_count, 8)
    INTO v_first_num, v_decl, v_player_count
    FROM game_0a WHERE game_id = p_game_id;

    -- 액션 타입별 상태 복원 (undo 로직)
    CASE v_action_type
      WHEN 'start_round' THEN
        v_prev_first := CASE WHEN v_current_round > 1
          THEN ((COALESCE(v_first_num, 1) - 4 + v_player_count) % v_player_count) + 1
          ELSE NULL END;
        UPDATE game_0a SET
          current_round = GREATEST(1, v_current_round - 1),
          current_step = CASE WHEN v_current_round <= 1 THEN 0 ELSE 10 END,
          first_player_number = v_prev_first,
          info_text = CASE WHEN v_current_round <= 1 THEN '1라운드를 시작하세요.' ELSE '이번 라운드 승리자를 선택하세요.' END,
          declaration_results = COALESCE(declaration_results, '{}'::jsonb),
          candidate_revealed_cards = COALESCE(candidate_revealed_cards, '{}'::jsonb),
          current_player = NULL,
          timer_active = false,
          timer_seconds = 0,
          timer_end = false,
          dealing_completed = true
        WHERE game_id = p_game_id;

      WHEN 'select_first' THEN
        UPDATE game_0a SET current_step = 1, first_player_number = NULL, info_text = '선 정하기'
        WHERE game_id = p_game_id;

      WHEN 'dealing_complete' THEN
        UPDATE game_0a SET current_step = 2, dealing_completed = false, info_text = '카드 딜링'
        WHERE game_id = p_game_id;

      WHEN 'strategy_meeting_1_start' THEN
        UPDATE game_0a SET current_step = 3, timer_active = false, timer_seconds = 0, info_text = '전략회의 I'
        WHERE game_id = p_game_id;

      WHEN 'strategy_meeting_1_end' THEN
        UPDATE game_0a SET current_step = 3, timer_active = true, timer_seconds = 480, current_player = NULL, info_text = '전략회의 I'
        WHERE game_id = p_game_id;

      WHEN 'candidacy' THEN
        UPDATE game_0a SET declaration_results = declaration_results - v_player_number::TEXT WHERE game_id = p_game_id;
        v_prev_num := v_player_number - 1;
        IF v_prev_num < 1 THEN v_prev_num := v_player_count; END IF;
        IF v_player_number = COALESCE(v_first_num, 1) THEN
          UPDATE game_0a SET current_step = 3, current_player = NULL, timer_active = false, timer_seconds = 0, info_text = '전략회의 I' WHERE game_id = p_game_id;
        ELSE
          UPDATE game_0a SET current_player = v_prev_num, timer_seconds = 20, info_text = '출마 선언' WHERE game_id = p_game_id;
        END IF;

      WHEN 'reveal_cards' THEN
        UPDATE game_0a SET candidate_revealed_cards = candidate_revealed_cards - v_player_number::TEXT WHERE game_id = p_game_id;
        SELECT jsonb_agg((k)::INT ORDER BY (k)::INT) INTO v_candidates
          FROM jsonb_object_keys(COALESCE(v_decl, '{}'::jsonb)) k
          WHERE (v_decl->>k)::BOOLEAN = true AND k::INT != v_player_number;
        SELECT (elem#>>'{}')::INT INTO v_prev_candidate FROM jsonb_array_elements(COALESCE(v_candidates, '[]'::jsonb)) elem
          WHERE (elem#>>'{}')::INT < v_player_number ORDER BY (elem#>>'{}')::INT DESC LIMIT 1;
        IF v_prev_candidate IS NULL THEN
          SELECT (elem#>>'{}')::INT INTO v_prev_candidate FROM jsonb_array_elements(COALESCE(v_candidates, '[]'::jsonb)) elem
            ORDER BY (elem#>>'{}')::INT DESC LIMIT 1;
        END IF;
        IF v_prev_candidate IS NULL THEN
          UPDATE game_0a SET current_step = 4, current_player = NULL, timer_seconds = 20, info_text = '출마 선언' WHERE game_id = p_game_id;
        ELSE
          UPDATE game_0a SET current_player = v_prev_candidate, timer_seconds = 20, info_text = '후보자 연설' WHERE game_id = p_game_id;
        END IF;

      WHEN 'turn_open' THEN
        UPDATE game_0a SET current_step = 5, info_text = '후보자 연설' WHERE game_id = p_game_id;

      WHEN 'strategy_meeting_2_start' THEN
        UPDATE game_0a SET current_step = 7, timer_active = false, timer_seconds = 0, info_text = '전략회의 II'
        WHERE game_id = p_game_id;

      WHEN 'strategy_meeting_2_end' THEN
        UPDATE game_0a SET current_step = 7, timer_active = true, timer_seconds = 480, current_player = NULL, info_text = '전략회의 II'
        WHERE game_id = p_game_id;

      WHEN 'vote' THEN
        v_round_key := v_current_round::TEXT;
        SELECT votes->v_round_key INTO v_current_votes FROM game_0a WHERE game_id = p_game_id;
        UPDATE game_0a SET votes = votes || jsonb_build_object(v_round_key,
          (SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) FROM jsonb_array_elements(COALESCE(v_current_votes, '[]'::jsonb)) elem WHERE (elem->>'voter')::INT != v_player_number))
        WHERE game_id = p_game_id;
        SELECT jsonb_agg((k)::INT ORDER BY (k)::INT) INTO v_voters
          FROM jsonb_object_keys(v_decl) k WHERE (v_decl->>k)::BOOLEAN = false;
        SELECT (elem#>>'{}')::INT INTO v_prev_voter FROM jsonb_array_elements(COALESCE(v_voters, '[]'::jsonb)) elem
          WHERE (elem#>>'{}')::INT < v_player_number ORDER BY (elem#>>'{}')::INT DESC LIMIT 1;
        IF v_prev_voter IS NULL THEN
          SELECT (elem#>>'{}')::INT INTO v_prev_voter FROM jsonb_array_elements(COALESCE(v_voters, '[]'::jsonb)) elem
            ORDER BY (elem#>>'{}')::INT DESC LIMIT 1;
        END IF;
        IF v_prev_voter IS NULL THEN
          UPDATE game_0a SET current_step = 7, current_player = NULL, timer_active = false, timer_seconds = 0, info_text = '전략회의 II' WHERE game_id = p_game_id;
        ELSE
          UPDATE game_0a SET current_player = v_prev_voter, timer_seconds = 20, info_text = '유권자 투표' WHERE game_id = p_game_id;
        END IF;

      WHEN 'calculate_scores' THEN
        v_round_key := v_current_round::TEXT;
        UPDATE game_0a SET
          current_step = 8,
          round_winners = round_winners - v_round_key,
          round_scores = (
            SELECT COALESCE(jsonb_object_agg(k, (
              SELECT jsonb_agg(ar.elem ORDER BY ar.idx)
              FROM jsonb_array_elements(sub.rnd->k) WITH ORDINALITY ar(elem, idx)
              WHERE ar.idx < jsonb_array_length(sub.rnd->k)
            )), '{}'::jsonb)
            FROM (SELECT round_scores AS rnd FROM game_0a WHERE game_id = p_game_id) sub,
            jsonb_object_keys(sub.rnd) k
          ),
          votes = votes - v_round_key,
          info_text = '유권자 투표'
        WHERE game_id = p_game_id;

      ELSE
        RAISE NOTICE '알 수 없는 액션: %, 스킵', v_action_type;
    END CASE;

    -- action_history에서 마지막 액션 제거
    UPDATE game_0a SET action_history = (
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      FROM jsonb_array_elements(action_history) WITH ORDINALITY arr(elem, idx)
      WHERE idx < jsonb_array_length(action_history)
    ) WHERE game_id = p_game_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
