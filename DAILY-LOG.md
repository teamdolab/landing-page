# 일일 작업 로그

---

## 2025.03.06 (금)

### 완료
- **game_0a 스키마 v2**: 칼럼 분리 (`first_player_number`, `declaration_results`, `candidate_revealed_cards`, `round_scores` 등)
- **API 변환 레이어**: `lib/game-transform.ts` - `dbRowToApi`, `apiUpdateToDb`
- **GET/PATCH/Create API**: 새 칼럼 기준으로 업데이트
- **Undo RPC v2**: `supabase-undo-v2.sql` - 새 칼럼 기반 Undo
- **Edit 기능**: 송출 레이아웃 + 인라인 편집
  - `app/game/edit/[gameId]/page.tsx`. 후보/카드/투표/점수/승자 편집
  - `lib/edit-smart.ts` - 스마트 Edit (연관 필드 자동 조정)
  - `app/api/game/[gameId]/edit/route.ts`
  - 컨트롤 페이지 Edit 버튼 추가
- **Undo info_text**: 진행단계 표시를 STEP_LABELS와 통일 (딜링/플랍 문구 등)

### 논의
- game_action_log (BI/분석용): MVP 이후로 펜딩
- 데이터 구조: game_0a = 1게임 1row, action_history = 배열 append

### 내일 할 일
- [ ] 로컬 Undo, Edit 테스트
- [ ] 깃 푸시 + 배포
- [ ] 로그인 페이지 제작 시작

---
