-- ============================================
-- 예시 데이터 삽입
-- ============================================

-- ============================================
-- 1. sessions 테이블 예시 데이터
-- ============================================

-- 2026년 2월 11일 세션
INSERT INTO sessions (session_id, game_name, session_date, session_time, max_capacity, current_capacity, base_price, status)
VALUES 
    ('260211A0A1', '대선포커', '2026-02-11', '14:00:00', 12, 0, 25000, '모집중'),
    ('260211A0A2', '대선포커', '2026-02-11', '16:30:00', 12, 0, 25000, '모집중'),
    ('260211A0A3', '대선포커', '2026-02-11', '19:00:00', 12, 0, 25000, '모집중');

-- 2026년 2월 12일 세션
INSERT INTO sessions (session_id, game_name, session_date, session_time, max_capacity, current_capacity, base_price, status)
VALUES 
    ('260212A0A1', '대선포커', '2026-02-12', '14:00:00', 12, 0, 25000, '모집중'),
    ('260212A0A2', '대선포커', '2026-02-12', '16:30:00', 12, 0, 25000, '모집중'),
    ('260212A0A3', '대선포커', '2026-02-12', '19:00:00', 12, 0, 25000, '모집중');

-- 2026년 2월 13일 세션
INSERT INTO sessions (session_id, game_name, session_date, session_time, max_capacity, current_capacity, base_price, status)
VALUES 
    ('260213A0A1', '대선포커', '2026-02-13', '14:00:00', 12, 0, 25000, '모집중'),
    ('260213A0A2', '대선포커', '2026-02-13', '16:30:00', 12, 0, 25000, '모집중'),
    ('260213A0A3', '대선포커', '2026-02-13', '19:00:00', 12, 0, 25000, '모집중');

-- 2026년 2월 14일 세션 (참가자 많은 세션 예시 - apply 테이블 insert 시 자동으로 current_capacity 증가)
INSERT INTO sessions (session_id, game_name, session_date, session_time, max_capacity, current_capacity, base_price, status)
VALUES 
    ('260214A0A1', '대선포커', '2026-02-14', '14:00:00', 12, 0, 25000, '모집중'),
    ('260214A0A2', '대선포커', '2026-02-14', '16:30:00', 12, 0, 25000, '모집중'),
    ('260214A0A3', '대선포커', '2026-02-14', '19:00:00', 12, 0, 25000, '모집중');

-- 2026년 2월 15일 세션
INSERT INTO sessions (session_id, game_name, session_date, session_time, max_capacity, current_capacity, base_price, status)
VALUES 
    ('260215A0A1', '대선포커', '2026-02-15', '14:00:00', 12, 0, 25000, '모집중'),
    ('260215A0A2', '대선포커', '2026-02-15', '16:30:00', 12, 0, 25000, '모집중'),
    ('260215A0A3', '대선포커', '2026-02-15', '19:00:00', 12, 0, 25000, '모집중');

-- ============================================
-- 2. user_info 테이블 예시 데이터
-- ============================================

-- 테스트 유저 1: 마케팅 동의 + 추천인 있음 (5,000 크레딧)
INSERT INTO user_info (name, phone, nickname, password, privacy_consent, privacy_consent_at, marketing_consent, marketing_consent_at, referrer_phone)
VALUES 
    ('김철수', '010-1234-5678', '철수왕', '$2a$10$example_hashed_password_1', true, NOW(), true, NOW(), NULL);

-- 테스트 유저 2: 마케팅 동의만 (3,000 크레딧) - 철수의 추천인이 될 유저
INSERT INTO user_info (name, phone, nickname, password, privacy_consent, privacy_consent_at, marketing_consent, marketing_consent_at, referrer_phone)
VALUES 
    ('이영희', '010-9876-5432', '영희짱', '$2a$10$example_hashed_password_2', true, NOW(), true, NOW(), NULL);

-- 철수의 추천인을 영희로 업데이트 (철수에게 추가 2,000 크레딧)
UPDATE user_info 
SET referrer_phone = '010-9876-5432', credits = credits + 2000
WHERE phone = '010-1234-5678';

-- 테스트 유저 3: 크레딧 없음
INSERT INTO user_info (name, phone, nickname, password, privacy_consent, privacy_consent_at, marketing_consent, marketing_consent_at)
VALUES 
    ('박민수', '010-5555-1234', '민수123', '$2a$10$example_hashed_password_3', true, NOW(), false, NULL);

-- 테스트 유저 4: 마케팅 동의 (3,000 크레딧)
INSERT INTO user_info (name, phone, nickname, password, privacy_consent, privacy_consent_at, marketing_consent, marketing_consent_at)
VALUES 
    ('정수진', '010-7777-8888', '수진수진', '$2a$10$example_hashed_password_4', true, NOW(), true, NOW());

-- ============================================
-- 3. apply 테이블 예시 데이터
-- ============================================

-- 김철수 - 2월 11일 첫 타임 신청 (5,000 크레딧 사용)
INSERT INTO apply (user_id, session_id, used_credits, final_price, refund_policy_consent, refund_policy_consent_at, status)
VALUES 
    (
        (SELECT id FROM user_info WHERE phone = '010-1234-5678'),
        '260211A0A1',
        5000,
        20000,
        true,
        NOW(),
        '확정'
    );

-- 이영희 - 2월 11일 세 번째 타임 신청 (3,000 크레딧 사용)
INSERT INTO apply (user_id, session_id, used_credits, final_price, refund_policy_consent, refund_policy_consent_at, status)
VALUES 
    (
        (SELECT id FROM user_info WHERE phone = '010-9876-5432'),
        '260211A0A3',
        3000,
        22000,
        true,
        NOW(),
        '확정'
    );

-- 박민수 - 2월 12일 첫 타임 신청 (크레딧 미사용)
INSERT INTO apply (user_id, session_id, used_credits, final_price, refund_policy_consent, refund_policy_consent_at, status)
VALUES 
    (
        (SELECT id FROM user_info WHERE phone = '010-5555-1234'),
        '260212A0A1',
        0,
        25000,
        true,
        NOW(),
        '확정'
    );

-- 정수진 - 2월 13일 두 번째 타임 신청 (1,000 크레딧 사용)
INSERT INTO apply (user_id, session_id, used_credits, final_price, refund_policy_consent, refund_policy_consent_at, status)
VALUES 
    (
        (SELECT id FROM user_info WHERE phone = '010-7777-8888'),
        '260213A0A2',
        1000,
        24000,
        true,
        NOW(),
        '확정'
    );

-- 2월 14일 거의 마감된 세션에 여러 유저 신청 (세션 상태 테스트용)
-- 추가 테스트 유저들 생성 및 신청
DO $$
DECLARE
    i INTEGER;
    test_phone VARCHAR;
    test_user_id UUID;
BEGIN
    -- 2월 14일 첫 타임에 11명 신청 (거의 마감 - 1자리 남음)
    FOR i IN 1..11 LOOP
        test_phone := '010-1111-' || LPAD(i::TEXT, 4, '0');
        
        -- 유저 생성
        INSERT INTO user_info (name, phone, nickname, password, privacy_consent, privacy_consent_at)
        VALUES (
            '테스트유저' || i,
            test_phone,
            'test' || i,
            '$2a$10$example_hashed_password',
            true,
            NOW()
        )
        RETURNING id INTO test_user_id;
        
        -- 신청
        INSERT INTO apply (user_id, session_id, used_credits, final_price, refund_policy_consent, refund_policy_consent_at, status)
        VALUES (
            test_user_id,
            '260214A0A1',
            0,
            25000,
            true,
            NOW(),
            '확정'
        );
    END LOOP;
    
    -- 2월 14일 두 번째 타임은 완전 마감 (12명)
    FOR i IN 12..23 LOOP
        test_phone := '010-2222-' || LPAD(i::TEXT, 4, '0');
        
        -- 유저 생성
        INSERT INTO user_info (name, phone, nickname, password, privacy_consent, privacy_consent_at)
        VALUES (
            '테스트유저' || i,
            test_phone,
            'test' || i,
            '$2a$10$example_hashed_password',
            true,
            NOW()
        )
        RETURNING id INTO test_user_id;
        
        -- 신청
        INSERT INTO apply (user_id, session_id, used_credits, final_price, refund_policy_consent, refund_policy_consent_at, status)
        VALUES (
            test_user_id,
            '260214A0A2',
            0,
            25000,
            true,
            NOW(),
            '확정'
        );
    END LOOP;
    
    -- 2월 14일 세 번째 타임에 8명 신청 (여유 있음)
    FOR i IN 24..31 LOOP
        test_phone := '010-3333-' || LPAD(i::TEXT, 4, '0');
        
        -- 유저 생성
        INSERT INTO user_info (name, phone, nickname, password, privacy_consent, privacy_consent_at)
        VALUES (
            '테스트유저' || i,
            test_phone,
            'test' || i,
            '$2a$10$example_hashed_password',
            true,
            NOW()
        )
        RETURNING id INTO test_user_id;
        
        -- 신청
        INSERT INTO apply (user_id, session_id, used_credits, final_price, refund_policy_consent, refund_policy_consent_at, status)
        VALUES (
            test_user_id,
            '260214A0A3',
            0,
            25000,
            true,
            NOW(),
            '확정'
        );
    END LOOP;
END $$;

-- ============================================
-- 4. 데이터 확인 쿼리
-- ============================================

-- 실시간 예약 현황 확인
SELECT * FROM get_session_availability();

-- 유저 정보 확인
SELECT 
    name,
    phone,
    pin,
    nickname,
    credits,
    marketing_consent,
    referrer_phone
FROM user_info
WHERE phone IN ('010-1234-5678', '010-9876-5432', '010-5555-1234', '010-7777-8888');

-- 신청 현황 확인
SELECT 
    u.name,
    u.phone,
    s.session_id,
    s.game_name,
    s.session_date,
    s.session_time,
    a.used_credits,
    a.final_price,
    a.status
FROM apply a
JOIN user_info u ON a.user_id = u.id
JOIN sessions s ON a.session_id = s.session_id
ORDER BY s.session_date, s.session_time, u.name;

-- ============================================
-- 완료 메시지
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ 예시 데이터 삽입 완료!';
    RAISE NOTICE '📊 세션: 15개 생성';
    RAISE NOTICE '👥 유저: 35명 생성 (테스트 유저 포함)';
    RAISE NOTICE '📝 신청: 35건 생성';
    RAISE NOTICE '';
    RAISE NOTICE '🔐 테스트 로그인 정보:';
    RAISE NOTICE '  - 김철수: 010-1234-5678 (PIN: 5678, 크레딧 차감됨)';
    RAISE NOTICE '  - 이영희: 010-9876-5432 (PIN: 5432, 크레딧 차감됨)';
    RAISE NOTICE '  - 박민수: 010-5555-1234 (PIN: 1234, 크레딧: 0)';
    RAISE NOTICE '  - 정수진: 010-7777-8888 (PIN: 8888, 크레딧 차감됨)';
    RAISE NOTICE '';
    RAISE NOTICE '💡 패스워드 설정 필요: UPDATE user_info SET password = ''1234'' WHERE phone = ''010-1234-5678'';';
END $$;
