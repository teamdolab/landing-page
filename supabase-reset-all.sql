-- ============================================
-- 모든 테이블 삭제 및 초기화
-- ============================================
-- 주의: 이 스크립트는 모든 데이터를 삭제합니다!
-- Supabase SQL Editor에서 실행하세요.

-- 1단계: 모든 테이블 삭제 (의존성 순서대로)
DROP TABLE IF EXISTS apply CASCADE;
DROP TABLE IF EXISTS game_players CASCADE;
DROP TABLE IF EXISTS game_state CASCADE;
DROP TABLE IF EXISTS game_sessions CASCADE;
DROP TABLE IF EXISTS display_players CASCADE;
DROP TABLE IF EXISTS display_ui_state CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS user_info CASCADE;

-- 2단계: 함수 삭제
DROP FUNCTION IF EXISTS check_user_exists(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_user_credits(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_session_availability() CASCADE;
DROP FUNCTION IF EXISTS add_signup_credits() CASCADE;
DROP FUNCTION IF EXISTS update_session_capacity_on_apply() CASCADE;
DROP FUNCTION IF EXISTS decrease_session_capacity_on_apply_delete() CASCADE;
DROP FUNCTION IF EXISTS initialize_game(TEXT, TEXT[], TEXT) CASCADE;
DROP FUNCTION IF EXISTS initialize_display(TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- 3단계: 트리거 삭제
DROP TRIGGER IF EXISTS trigger_add_signup_credits ON user_info CASCADE;
DROP TRIGGER IF EXISTS trigger_update_capacity_on_apply ON apply CASCADE;
DROP TRIGGER IF EXISTS trigger_decrease_capacity_on_apply_delete ON apply CASCADE;
DROP TRIGGER IF EXISTS update_game_state_updated_at ON game_state CASCADE;
DROP TRIGGER IF EXISTS update_display_ui_state_updated_at ON display_ui_state CASCADE;

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ 모든 테이블, 함수, 트리거가 삭제되었습니다.';
  RAISE NOTICE '이제 스키마 파일들을 순서대로 실행하세요:';
  RAISE NOTICE '1. supabase-schema.sql (기본 스키마)';
  RAISE NOTICE '2. supabase-game-schema.sql (게임 스키마)';
  RAISE NOTICE '3. supabase-display-ui-schema.sql (디스플레이 UI 스키마)';
  RAISE NOTICE '4. supabase-sample-data.sql (샘플 데이터 - 선택사항)';
END $$;
