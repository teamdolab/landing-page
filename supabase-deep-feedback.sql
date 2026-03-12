-- 심층 피드백 테이블 (QR 코드로 접근, 송출 결과 화면 다음)
-- 제출 시 user_info에서 이름+전화번호로 조회 후 2,000 크레딧 지급
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS deep_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_info(id),
  session_id VARCHAR(20),
  game_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  feedback_data JSONB DEFAULT '{}'::jsonb,
  free_text TEXT,
  -- 회원 미조회 시에도 피드백 보존용
  submit_name VARCHAR(100),
  submit_phone VARCHAR(20)
);

-- 기존 테이블이 있다면 컬럼 추가
ALTER TABLE deep_feedback ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_info(id);
ALTER TABLE deep_feedback ADD COLUMN IF NOT EXISTS feedback_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE deep_feedback ADD COLUMN IF NOT EXISTS submit_name VARCHAR(100);
ALTER TABLE deep_feedback ADD COLUMN IF NOT EXISTS submit_phone VARCHAR(20);
-- 기존 gameplay_fun 등 컬럼이 있으면 feedback_data로 마이그레이션 후 DROP (필요 시 수동)

CREATE INDEX IF NOT EXISTS idx_deep_feedback_user ON deep_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_deep_feedback_session ON deep_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_deep_feedback_created ON deep_feedback(created_at);

COMMENT ON TABLE deep_feedback IS '심층 피드백 (QR 코드로 접근, 2000 크레딧 지급)';
