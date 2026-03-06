-- ============================================
-- RLS 정책 (Admin API + anon 제한)
-- ============================================
-- Supabase SQL Editor에서 실행하세요.
-- 사전 요구: SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD 환경변수 설정

-- 1. 기존 정책 삭제 (재실행 시에도 동작하도록)
DROP POLICY IF EXISTS "Anyone can view sessions" ON sessions;
DROP POLICY IF EXISTS "anon_select_sessions" ON sessions;
DROP POLICY IF EXISTS "Anyone can insert user_info" ON user_info;
DROP POLICY IF EXISTS "anon_insert_user_info" ON user_info;
DROP POLICY IF EXISTS "Users can view own data" ON user_info;
DROP POLICY IF EXISTS "Users can update own data" ON user_info;
DROP POLICY IF EXISTS "Anyone can create applications" ON apply;
DROP POLICY IF EXISTS "Users can view own applications" ON apply;
DROP POLICY IF EXISTS "anon_insert_apply" ON apply;

-- 2. RLS 활성화 (이미 되어 있으면 무시)
ALTER TABLE user_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE apply ENABLE ROW LEVEL SECURITY;

-- 3. 새 정책: anon은 최소 권한만
-- sessions: 읽기만 (실시간 예약 현황용)
CREATE POLICY "anon_select_sessions" ON sessions
    FOR SELECT TO anon USING (true);

-- user_info: 가입(INSERT)만, 조회/수정 불가
CREATE POLICY "anon_insert_user_info" ON user_info
    FOR INSERT TO anon WITH CHECK (true);

-- apply: 신청(INSERT)만, 조회/수정 불가
CREATE POLICY "anon_insert_apply" ON apply
    FOR INSERT TO anon WITH CHECK (true);

-- 4. 트리거 함수: add_signup_credits가 user_info SELECT/UPDATE하므로 SECURITY DEFINER 필요
CREATE OR REPLACE FUNCTION add_signup_credits()
RETURNS TRIGGER AS $$
DECLARE
    ref_phone_norm TEXT;
BEGIN
    IF NEW.marketing_consent = TRUE THEN
        NEW.credits = NEW.credits + 3000;
    END IF;
    
    IF NEW.referrer_phone IS NOT NULL THEN
        ref_phone_norm := regexp_replace(NEW.referrer_phone, '[^0-9]', '', 'g');
        IF ref_phone_norm != '' AND EXISTS (
            SELECT 1 FROM user_info 
            WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ref_phone_norm
        ) THEN
            -- 추천받는 사람(신규): +2,000
            NEW.credits = NEW.credits + 2000;
            -- 추천인: +2,000
            UPDATE user_info 
            SET credits = credits + 2000 
            WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ref_phone_norm;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4-2. update_session_capacity_on_apply: sessions UPDATE하므로 SECURITY DEFINER 필요
CREATE OR REPLACE FUNCTION update_session_capacity_on_apply()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status IN ('신청중', '확정') THEN
        UPDATE sessions 
        SET current_capacity = current_capacity + 1,
            status = CASE WHEN current_capacity + 1 >= max_capacity THEN '마감' ELSE '모집중' END
        WHERE session_id = NEW.session_id;
    END IF;
    
    IF TG_OP = 'UPDATE' AND OLD.status IN ('신청중', '확정') AND NEW.status IN ('취소', '환불', '미입금 취소') THEN
        UPDATE sessions 
        SET current_capacity = GREATEST(current_capacity - 1, 0),
            status = '모집중'
        WHERE session_id = NEW.session_id;
    END IF;
    
    IF TG_OP = 'DELETE' AND OLD.status IN ('신청중', '확정') THEN
        UPDATE sessions 
        SET current_capacity = GREATEST(current_capacity - 1, 0),
            status = '모집중'
        WHERE session_id = OLD.session_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. SECURITY DEFINER: RPC가 RLS 우회하여 user_info 읽기
-- check_user_exists, get_user_credits는 anon이 호출하므로 RLS 우회 필요
CREATE OR REPLACE FUNCTION get_user_credits(p_phone VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    user_credits INTEGER;
BEGIN
    SELECT credits INTO user_credits
    FROM user_info
    WHERE phone = p_phone;
    
    RETURN COALESCE(user_credits, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_user_exists(p_name VARCHAR, p_phone VARCHAR)
RETURNS TABLE (
    user_exists BOOLEAN,
    user_id UUID,
    nickname VARCHAR,
    credits INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        true AS user_exists,
        u.id AS user_id,
        u.nickname,
        u.credits
    FROM user_info u
    WHERE u.name = p_name AND u.phone = p_phone;
    
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT false, NULL::UUID, NULL::VARCHAR, 0;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 추천인 존재 여부 확인 (RLS 우회) - 전화번호로 기존 회원인지 검증
CREATE OR REPLACE FUNCTION verify_referrer_exists(p_phone VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM user_info WHERE phone = p_phone);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 회원 패스워드 검증 (RLS 우회)
CREATE OR REPLACE FUNCTION verify_user_password(p_user_id UUID, p_password VARCHAR)
RETURNS TABLE (user_id UUID, credits INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.credits
    FROM user_info u
    WHERE u.id = p_user_id AND u.password = p_password;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. get_session_availability는 anon이 sessions SELECT 가능하므로 SECURITY INVOKER 유지
-- (별도 수정 불필요)

-- 7. deduct_user_credits_on_apply: user_info UPDATE하므로 SECURITY DEFINER 필요
CREATE OR REPLACE FUNCTION deduct_user_credits_on_apply()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.used_credits > 0 THEN
        UPDATE user_info SET credits = credits - NEW.used_credits WHERE id = NEW.user_id;
        IF (SELECT credits FROM user_info WHERE id = NEW.user_id) < 0 THEN
            RAISE EXCEPTION '크레딧이 부족합니다.';
        END IF;
    END IF;
    
    IF TG_OP = 'UPDATE' AND OLD.status IN ('신청중', '확정') AND NEW.status IN ('취소', '환불', '미입금 취소') THEN
        UPDATE user_info SET credits = credits + OLD.used_credits WHERE id = OLD.user_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. apply_set_recipient_info: user_info SELECT하므로 SECURITY DEFINER 필요 (apply-apply-update.sql에서 추가된 경우)
CREATE OR REPLACE FUNCTION apply_set_recipient_info()
RETURNS TRIGGER AS $$
BEGIN
    SELECT u.name, u.phone INTO NEW.recipient_name, NEW.recipient_phone
    FROM user_info u WHERE u.id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
    RAISE NOTICE '✅ RLS 정책 적용 완료!';
    RAISE NOTICE 'anon: sessions SELECT, user_info INSERT, apply INSERT';
    RAISE NOTICE 'Admin: API 라우트(service_role)로 전체 접근';
END $$;
