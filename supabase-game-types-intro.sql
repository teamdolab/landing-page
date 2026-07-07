-- game_types: 랜딩 게임 소개 모달용 컬럼
ALTER TABLE game_types
  ADD COLUMN IF NOT EXISTS intro_text TEXT,
  ADD COLUMN IF NOT EXISTS is_coming_soon BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN game_types.intro_text IS '랜딩 게임 소개 모달 본문';
COMMENT ON COLUMN game_types.is_coming_soon IS 'TRUE면 소개만 표시, 신청 버튼 숨김';
