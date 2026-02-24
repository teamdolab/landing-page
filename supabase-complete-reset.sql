-- ============================================
-- 완전 초기화 스크립트 (모든 것을 강제 삭제)
-- ============================================
-- 주의: 이 스크립트는 모든 데이터를 완전히 삭제합니다!

-- 1단계: 모든 정책(Policy) 삭제
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I CASCADE', 
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 2단계: 모든 트리거 삭제
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
    ) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I CASCADE', 
            r.trigger_name, r.event_object_table);
    END LOOP;
END $$;

-- 3단계: 모든 함수 삭제
DROP FUNCTION IF EXISTS check_user_exists(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_user_credits(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS get_session_availability() CASCADE;
DROP FUNCTION IF EXISTS add_signup_credits() CASCADE;
DROP FUNCTION IF EXISTS update_session_capacity_on_apply() CASCADE;
DROP FUNCTION IF EXISTS deduct_user_credits_on_apply() CASCADE;
DROP FUNCTION IF EXISTS decrease_session_capacity_on_apply_delete() CASCADE;
DROP FUNCTION IF EXISTS initialize_game(TEXT, TEXT[], TEXT) CASCADE;
DROP FUNCTION IF EXISTS initialize_display(TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- 4단계: 모든 테이블 삭제 (CASCADE로 강제)
DROP TABLE IF EXISTS apply CASCADE;
DROP TABLE IF EXISTS game_players CASCADE;
DROP TABLE IF EXISTS game_state CASCADE;
DROP TABLE IF EXISTS game_sessions CASCADE;
DROP TABLE IF EXISTS display_players CASCADE;
DROP TABLE IF EXISTS display_ui_state CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS user_info CASCADE;

-- 기타 남아있는 테이블들도 삭제
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS election_poker_game_state CASCADE;
DROP TABLE IF EXISTS game_participations CASCADE;
DROP TABLE IF EXISTS game_results CASCADE;
DROP TABLE IF EXISTS nfc_cards CASCADE;
DROP TABLE IF EXISTS player_cards CASCADE;
DROP TABLE IF EXISTS trinity_force_game_state CASCADE;

-- 5단계: 확인용 쿼리
DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
BEGIN
    -- 남아있는 테이블 개수 확인
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
    
    -- 남아있는 함수 개수 확인
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines
    WHERE routine_schema = 'public';
    
    RAISE NOTICE '=========================================';
    RAISE NOTICE '✅ 완전 초기화 완료!';
    RAISE NOTICE '남은 public 테이블: % 개', table_count;
    RAISE NOTICE '남은 함수: % 개', function_count;
    RAISE NOTICE '=========================================';
    RAISE NOTICE '';
    RAISE NOTICE '다음 단계:';
    RAISE NOTICE '1. supabase-schema.sql 실행';
    RAISE NOTICE '2. RLS 비활성화 실행';
    RAISE NOTICE '=========================================';
END $$;
