-- ============================================
-- 로그인 페이지 PIN 조회 RPC
-- RLS로 인해 anon이 user_info SELECT 불가 → RPC로 우회
-- Supabase SQL Editor에서 실행하세요.
-- ============================================

-- 반환 타입 변경 시 CREATE OR REPLACE 불가 → 기존 함수 삭제 후 재생성
DROP FUNCTION IF EXISTS get_users_by_pin(VARCHAR);

CREATE OR REPLACE FUNCTION get_users_by_pin(p_pin VARCHAR)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    phone VARCHAR,
    pin VARCHAR,
    nickname VARCHAR,
    credits INTEGER,
    privacy_consent BOOLEAN,
    privacy_consent_at TIMESTAMPTZ,
    marketing_consent BOOLEAN,
    marketing_consent_at TIMESTAMPTZ,
    referrer_phone VARCHAR,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.name,
        u.phone,
        u.pin,
        u.nickname,
        u.credits,
        u.privacy_consent,
        u.privacy_consent_at,
        u.marketing_consent,
        u.marketing_consent_at,
        u.referrer_phone,
        u.created_at,
        u.updated_at
    FROM user_info u
    WHERE u.pin = p_pin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
