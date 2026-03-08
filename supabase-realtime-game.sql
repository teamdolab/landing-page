-- game_0a 테이블 Realtime 활성화
-- 이미 supabase-poker-schema.sql을 실행했다면 이 파일만 실행하세요.
-- (테이블이 이미 publication에 있으면 에러가 날 수 있습니다 - 무시해도 됩니다)

ALTER PUBLICATION supabase_realtime ADD TABLE game_0a;
