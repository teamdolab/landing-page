-- ============================================
-- apply 테이블 업데이트 (name/phone, status, 입금, 12시간 자동취소)
-- ============================================
-- Supabase SQL Editor에서 실행하세요.

-- 1. user_id에 맞는 name, phone 컬럼 추가 (INSERT 시 트리거로 자동 채움)
ALTER TABLE apply ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(50);
ALTER TABLE apply ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(20);

-- 2. 입금 확인 컬럼 (체크박스)
ALTER TABLE apply ADD COLUMN IF NOT EXISTS deposit_confirmed BOOLEAN DEFAULT FALSE;

-- 3. status에 '미입금 취소' 추가
ALTER TABLE apply DROP CONSTRAINT IF EXISTS apply_status_check;
ALTER TABLE apply ADD CONSTRAINT apply_status_check 
  CHECK (status IN ('신청중', '확정', '취소', '환불', '미입금 취소'));

-- 4. 기본 status를 '신청중'으로 변경
ALTER TABLE apply ALTER COLUMN status SET DEFAULT '신청중';

-- 5. INSERT 시 recipient_name, recipient_phone 자동 채우기
CREATE OR REPLACE FUNCTION apply_set_recipient_info()
RETURNS TRIGGER AS $$
BEGIN
  SELECT u.name, u.phone INTO NEW.recipient_name, NEW.recipient_phone
  FROM user_info u WHERE u.id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_apply_set_recipient ON apply;
CREATE TRIGGER trigger_apply_set_recipient
  BEFORE INSERT ON apply
  FOR EACH ROW
  EXECUTE FUNCTION apply_set_recipient_info();

-- 6. 미입금 취소 시 capacity 감소 (트리거 수정)
CREATE OR REPLACE FUNCTION update_session_capacity_on_apply()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status IN ('신청중', '확정') THEN
        UPDATE sessions 
        SET current_capacity = current_capacity + 1,
            status = CASE WHEN current_capacity + 1 >= max_capacity THEN '마감' ELSE '모집중' END
        WHERE session_id = NEW.session_id;
    END IF;
    
    -- 취소/환불/미입금 취소 시 capacity 감소
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
$$ LANGUAGE plpgsql;

-- 7. deduct_user_credits_on_apply도 미입금 취소 시 크레딧 복구
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
$$ LANGUAGE plpgsql;

-- 8. 12시간 미입금 자동 취소 함수 (pg_cron 또는 수동/외부 호출용)
CREATE OR REPLACE FUNCTION cancel_unpaid_applies()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE apply
  SET status = '미입금 취소'
  WHERE status = '신청중'
    AND (deposit_confirmed = FALSE OR deposit_confirmed IS NULL)
    AND created_at < NOW() - INTERVAL '12 hours';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- pg_cron 사용 시 (Supabase 대시보드에서 pg_cron 확장 활성화 후):
-- SELECT cron.schedule('cancel-unpaid-applies', '*/15 * * * *', 'SELECT cancel_unpaid_applies()');
-- (15분마다 실행)
