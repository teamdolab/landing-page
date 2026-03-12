-- ============================================
-- 로그인 페이지 PIN 조회 RPC
-- RLS로 인해 anon이 user_info SELECT 불가 → RPC로 우회
-- Supabase SQL Editor에서 실행하세요.
-- ============================================

CREATE OR REPLACE FUNCTION get_users_by_pin(p_pin VARCHAR)
RETURNS SETOF user_info AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM user_info
    WHERE pin = p_pin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
