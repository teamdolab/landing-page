# NFC 로그인 설정 - 해야 할 일

## 1. DB 마이그레이션 실행

Supabase 대시보드 → SQL Editor에서 `supabase-nfc-login.sql` 파일 내용을 실행하세요.

- `player_cards` 테이블 생성
- `game_participants` 테이블 생성
- 12장 플레이어 카드 초기 데이터 INSERT

---

## 2. 플레이어 카드 NFC ID 등록

현장에서 각 플레이어 카드(1~12번)를 NFC 리더기에 태깅하여 실제 NFC ID를 확인한 뒤, Supabase SQL Editor에서 아래처럼 업데이트하세요.

```sql
-- 예: 2번 카드를 태깅했을 때 나온 ID가 'a1b2c3d4e5f6' 이라면
UPDATE player_cards SET nfc_id = 'a1b2c3d4e5f6' WHERE player_number = 2;

-- 3번 카드
UPDATE player_cards SET nfc_id = '실제태깅ID' WHERE player_number = 3;

-- ... 4~12번까지 동일하게 반복
```

> 1번 카드는 예시로 `04bd3c5ac01c90`가 이미 들어가 있습니다. 실제 1번 카드 ID가 다르면 위와 같이 UPDATE 하세요.

---

## 3. 확인 사항

- [ ] `supabase-nfc-login.sql` 실행 완료
- [ ] 12장 카드 NFC ID 모두 `player_cards`에 등록 완료
- [ ] 로그인 화면은 컨트롤 페이지에서 "로그인 화면" 버튼으로 열기 (URL에 `gameId` 포함됨)
