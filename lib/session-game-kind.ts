/**
 * 어드민 세션 ID: YYMMDD + 매장(1) + 시즌(1) + 게임타입(1) + 타임슬롯(1)
 * 예: 260225A0A1 → 인덱스 8이 게임 타입 (A=대선포커, B=GAME 0B)
 */
export function isSessionGame0b(sessionId: string): boolean {
  return sessionId.length >= 9 && sessionId[8] === 'B';
}
