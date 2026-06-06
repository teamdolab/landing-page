-- ============================================
-- feedback_quick 테이블 생성
-- 퇴장 화면에서 NPS + 재방문 의향 수집 (10초, 비차단)
-- Supabase SQL Editor에서 실행하세요.
-- ============================================

CREATE TABLE IF NOT EXISTS feedback_quick (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id    TEXT        NOT NULL,
  session_id VARCHAR(20),
  user_id    UUID        REFERENCES user_info(id),
  nps        INTEGER     CHECK (nps >= 0 AND nps <= 10),
  return_intent TEXT     CHECK (return_intent IN ('yes', 'maybe', 'no')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_quick_game   ON feedback_quick(game_id);
CREATE INDEX IF NOT EXISTS idx_feedback_quick_user   ON feedback_quick(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_quick_session ON feedback_quick(session_id);

ALTER TABLE feedback_quick ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon insert feedback_quick" ON feedback_quick FOR INSERT TO anon WITH CHECK (true);

COMMENT ON TABLE feedback_quick IS '퇴장 시 수집하는 가벼운 피드백 (NPS + 재방문 의향)';

-- ============================================
-- deep_feedback 테이블에 크레딧 지급 이력 컬럼 추가
-- ============================================
ALTER TABLE deep_feedback ADD COLUMN IF NOT EXISTS credit_granted     INTEGER     DEFAULT 0;
ALTER TABLE deep_feedback ADD COLUMN IF NOT EXISTS credit_granted_at  TIMESTAMPTZ;

COMMENT ON COLUMN deep_feedback.credit_granted    IS '지급된 크레딧 금액 (0이면 미지급)';
COMMENT ON COLUMN deep_feedback.credit_granted_at IS '크레딧 지급 시각';
