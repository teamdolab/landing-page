-- ============================================
-- apply 테이블: 문자 발송 연동용 컬럼 추가
-- ============================================
-- Supabase SQL Editor에서 실행하세요.
-- 다른 서비스(Make 등)에서 칼럼 텍스트 매핑해 문자 보내기 쉽도록 추가

-- 1. apply 테이블에 컬럼 추가
ALTER TABLE apply ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMPTZ;
ALTER TABLE apply ADD COLUMN IF NOT EXISTS sms_status VARCHAR(20) DEFAULT 'pending';

-- 2. 문자 발송용 VIEW (조인된 데이터로 매핑 편리)
CREATE OR REPLACE VIEW apply_for_sms AS
SELECT
  a.id,
  a.user_id,
  a.session_id,
  a.final_price,
  a.used_credits,
  a.status,
  a.created_at,
  a.sms_sent_at,
  a.sms_status,
  u.name AS recipient_name,
  u.phone AS recipient_phone,
  s.game_name,
  s.session_date,
  s.session_time
FROM apply a
JOIN user_info u ON u.id = a.user_id
JOIN sessions s ON s.session_id = a.session_id;
