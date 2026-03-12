-- game_participants에 간략 피드백 컬럼 추가
-- 로그아웃 시 수집한 Q2(만족도), Q3(추천의향) 저장
-- Supabase SQL Editor에서 실행

ALTER TABLE game_participants ADD COLUMN IF NOT EXISTS feedback_satisfaction SMALLINT;
ALTER TABLE game_participants ADD COLUMN IF NOT EXISTS feedback_recommendation SMALLINT;

COMMENT ON COLUMN game_participants.feedback_satisfaction IS 'Q2: 오늘 게임 만족도 0~10';
COMMENT ON COLUMN game_participants.feedback_recommendation IS 'Q3: 지인 추천의향 0~10';
