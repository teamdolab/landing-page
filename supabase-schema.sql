-- ============================================
-- 랜딩페이지 Supabase 스키마 (완전판)
-- ============================================

-- 기존 테이블 삭제 (재생성 시)
DROP TABLE IF EXISTS apply CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS user_info CASCADE;

-- ============================================
-- 1. user_info 테이블 (유저 정보)
-- ============================================
CREATE TABLE user_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    pin VARCHAR(4) GENERATED ALWAYS AS (RIGHT(phone, 4)) STORED,
    nickname VARCHAR(50),
    password VARCHAR(255),
    credits INTEGER DEFAULT 0 CHECK (credits >= 0),
    privacy_consent BOOLEAN DEFAULT FALSE,
    privacy_consent_at TIMESTAMPTZ,
    marketing_consent BOOLEAN DEFAULT FALSE,
    marketing_consent_at TIMESTAMPTZ,
    referrer_phone VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_user_phone ON user_info(phone);
CREATE INDEX idx_user_pin ON user_info(pin);
CREATE INDEX idx_user_nickname ON user_info(nickname);

-- 업데이트 시각 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- user_info 업데이트 트리거
CREATE TRIGGER update_user_info_updated_at
    BEFORE UPDATE ON user_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. sessions 테이블 (게임 세션 정보)
-- ============================================
CREATE TABLE sessions (
    session_id VARCHAR(20) PRIMARY KEY, -- ex: 260211A0A1
    game_name VARCHAR(100) NOT NULL,
    session_date DATE NOT NULL,
    session_time TIME NOT NULL,
    max_capacity INTEGER DEFAULT 12 CHECK (max_capacity > 0),
    current_capacity INTEGER DEFAULT 0 CHECK (current_capacity >= 0 AND current_capacity <= max_capacity),
    base_price INTEGER DEFAULT 25000 CHECK (base_price >= 0),
    status VARCHAR(20) DEFAULT '모집중' CHECK (status IN ('모집중', '마감')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_session_date ON sessions(session_date);
CREATE INDEX idx_session_status ON sessions(status);

-- sessions 업데이트 트리거
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. apply 테이블 (참가 신청 정보)
-- ============================================
CREATE TABLE apply (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_info(id) ON DELETE CASCADE,
    session_id VARCHAR(20) NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    used_credits INTEGER DEFAULT 0 CHECK (used_credits >= 0),
    final_price INTEGER NOT NULL CHECK (final_price >= 0),
    refund_policy_consent BOOLEAN DEFAULT FALSE,
    refund_policy_consent_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT '확정' CHECK (status IN ('신청중', '확정', '취소', '환불')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 중복 신청 방지
    UNIQUE(user_id, session_id)
);

-- 인덱스 생성
CREATE INDEX idx_apply_user ON apply(user_id);
CREATE INDEX idx_apply_session ON apply(session_id);
CREATE INDEX idx_apply_status ON apply(status);

-- apply 업데이트 트리거
CREATE TRIGGER update_apply_updated_at
    BEFORE UPDATE ON apply
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. 자동화 함수 및 트리거
-- ============================================

-- 4-1. 신규 가입 시 크레딧 자동 충전 함수
CREATE OR REPLACE FUNCTION add_signup_credits()
RETURNS TRIGGER AS $$
BEGIN
    -- 마케팅 동의 시 3,000 크레딧
    IF NEW.marketing_consent = TRUE THEN
        NEW.credits = NEW.credits + 3000;
    END IF;
    
    -- 추천인이 존재하고 유효한 경우 2,000 크레딧 (하이픈 제거 후 비교)
    IF NEW.referrer_phone IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM user_info 
            WHERE REPLACE(phone, '-', '') = REPLACE(NEW.referrer_phone, '-', '')
        ) THEN
            NEW.credits = NEW.credits + 2000;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 신규 가입 크레딧 트리거
CREATE TRIGGER signup_credits_trigger
    BEFORE INSERT ON user_info
    FOR EACH ROW
    EXECUTE FUNCTION add_signup_credits();

-- 4-2. 참가 신청 시 세션 참가 인원 증가 및 상태 업데이트 함수
CREATE OR REPLACE FUNCTION update_session_capacity_on_apply()
RETURNS TRIGGER AS $$
BEGIN
    -- apply 테이블에 신청이 추가될 때
    IF TG_OP = 'INSERT' AND NEW.status IN ('신청중', '확정') THEN
        UPDATE sessions 
        SET 
            current_capacity = current_capacity + 1,
            status = CASE 
                WHEN current_capacity + 1 >= max_capacity THEN '마감'
                ELSE '모집중'
            END
        WHERE session_id = NEW.session_id;
    END IF;
    
    -- apply 상태가 취소/환불로 변경될 때
    IF TG_OP = 'UPDATE' AND OLD.status IN ('신청중', '확정') AND NEW.status IN ('취소', '환불') THEN
        UPDATE sessions 
        SET 
            current_capacity = GREATEST(current_capacity - 1, 0),
            status = '모집중'
        WHERE session_id = NEW.session_id;
    END IF;
    
    -- apply가 삭제될 때
    IF TG_OP = 'DELETE' AND OLD.status IN ('신청중', '확정') THEN
        UPDATE sessions 
        SET 
            current_capacity = GREATEST(current_capacity - 1, 0),
            status = '모집중'
        WHERE session_id = OLD.session_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 참가 신청 시 세션 업데이트 트리거
CREATE TRIGGER apply_update_session_capacity
    AFTER INSERT OR UPDATE OR DELETE ON apply
    FOR EACH ROW
    EXECUTE FUNCTION update_session_capacity_on_apply();

-- 4-3. 참가 신청 시 유저 크레딧 차감 함수
CREATE OR REPLACE FUNCTION deduct_user_credits_on_apply()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.used_credits > 0 THEN
        -- 크레딧 차감
        UPDATE user_info 
        SET credits = credits - NEW.used_credits
        WHERE id = NEW.user_id;
        
        -- 크레딧 부족 시 에러
        IF NOT FOUND OR (SELECT credits FROM user_info WHERE id = NEW.user_id) < 0 THEN
            RAISE EXCEPTION '크레딧이 부족합니다.';
        END IF;
    END IF;
    
    -- 취소/환불 시 크레딧 복구
    IF TG_OP = 'UPDATE' AND OLD.status IN ('신청중', '확정') AND NEW.status IN ('취소', '환불') THEN
        UPDATE user_info 
        SET credits = credits + OLD.used_credits
        WHERE id = OLD.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 크레딧 차감 트리거
CREATE TRIGGER apply_deduct_credits
    BEFORE INSERT OR UPDATE ON apply
    FOR EACH ROW
    EXECUTE FUNCTION deduct_user_credits_on_apply();

-- ============================================
-- 5. Row Level Security (RLS) 설정
-- ============================================

-- RLS 활성화
ALTER TABLE user_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE apply ENABLE ROW LEVEL SECURITY;

-- sessions 테이블: 모두 읽기 가능
CREATE POLICY "Anyone can view sessions" ON sessions
    FOR SELECT USING (true);

-- user_info 테이블: 누구나 가입 가능, 본인만 조회/수정 가능
CREATE POLICY "Anyone can insert user_info" ON user_info
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own data" ON user_info
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own data" ON user_info
    FOR UPDATE USING (auth.uid()::text = id::text);

-- apply 테이블: 누구나 신청 가능 (개발 단계)
CREATE POLICY "Anyone can create applications" ON apply
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own applications" ON apply
    FOR SELECT USING (true);

-- ============================================
-- 6. 유틸리티 함수
-- ============================================

-- 6-1. 실시간 예약 현황 조회 함수
CREATE OR REPLACE FUNCTION get_session_availability()
RETURNS TABLE (
    session_id VARCHAR,
    game_name VARCHAR,
    session_date DATE,
    session_time TIME,
    current_capacity INTEGER,
    max_capacity INTEGER,
    available_slots INTEGER,
    base_price INTEGER,
    status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.session_id,
        s.game_name,
        s.session_date,
        s.session_time,
        s.current_capacity,
        s.max_capacity,
        (s.max_capacity - s.current_capacity) AS available_slots,
        s.base_price,
        s.status
    FROM sessions s
    WHERE s.session_date >= CURRENT_DATE
    ORDER BY s.session_date, s.session_time;
END;
$$ LANGUAGE plpgsql;

-- 6-2. 유저 크레딧 조회 함수
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
$$ LANGUAGE plpgsql;

-- 6-3. 유저 존재 여부 확인 함수
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
$$ LANGUAGE plpgsql;

-- ============================================
-- 완료 메시지
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ 스키마 생성 완료!';
    RAISE NOTICE '다음 단계: supabase-sample-data.sql 파일로 예시 데이터를 삽입하세요.';
END $$;
