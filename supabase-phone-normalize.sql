-- ============================================
-- 전화번호: 숫자만 허용, 하이픈 없이 저장
-- ============================================
-- Supabase SQL Editor에서 실행하세요.

-- 1. 기존 데이터 하이픈 제거 (숫자만 남김)
UPDATE user_info SET phone = REGEXP_REPLACE(phone, '[^0-9]', '', 'g') WHERE phone ~ '[^0-9]';
UPDATE user_info SET referrer_phone = REGEXP_REPLACE(referrer_phone, '[^0-9]', '', 'g') 
  WHERE referrer_phone IS NOT NULL AND referrer_phone ~ '[^0-9]';

-- 2. apply.recipient_phone도 있으면 정리
UPDATE apply SET recipient_phone = REGEXP_REPLACE(recipient_phone, '[^0-9]', '', 'g') 
  WHERE recipient_phone IS NOT NULL AND recipient_phone ~ '[^0-9]';

-- 3. user_info.phone: 숫자만 허용 CHECK 추가
ALTER TABLE user_info DROP CONSTRAINT IF EXISTS user_info_phone_format;
ALTER TABLE user_info ADD CONSTRAINT user_info_phone_format CHECK (phone ~ '^[0-9]+$');

-- 4. user_info.referrer_phone: 숫자만 허용 (NULL 허용)
ALTER TABLE user_info DROP CONSTRAINT IF EXISTS user_info_referrer_phone_format;
ALTER TABLE user_info ADD CONSTRAINT user_info_referrer_phone_format 
  CHECK (referrer_phone IS NULL OR referrer_phone ~ '^[0-9]+$');
