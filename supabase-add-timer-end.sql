-- Supabase 연동 시 실행: timer_end 컬럼 추가 (종료 팝업 시 송출용 타이머에 "종료" 표시)
-- 데모 모드는 BroadcastChannel 사용으로 DB 불필요. 실제 게임용 Supabase 연동 시에만 실행하세요.
ALTER TABLE game_0a ADD COLUMN IF NOT EXISTS timer_end BOOLEAN DEFAULT false;
