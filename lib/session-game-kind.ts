/** sessions.game_kind 및 session_id 패턴으로 게임 종류를 구분한다. */

export type GameKind = 'game_0a' | 'game_0b' | 'game_0c';

const GAME_TYPE_CODE_TO_KIND: Record<string, GameKind> = {
  A: 'game_0a',
  B: 'game_0b',
  C: 'game_0c',
};

/** session_id 9번째 문자(게임타입 코드)로 game_kind 추론 */
export function inferGameKindFromSessionId(sessionId: string): GameKind {
  const code = sessionId.length >= 9 ? sessionId.charAt(8).toUpperCase() : '';
  return GAME_TYPE_CODE_TO_KIND[code] ?? 'game_0a';
}

/** DB game_kind 값을 정규화 (없으면 session_id에서 추론) */
export function resolveGameKind(session: {
  session_id: string;
  game_kind?: string | null;
}): GameKind {
  const kind = session.game_kind?.trim();
  if (kind === 'game_0a' || kind === 'game_0b' || kind === 'game_0c') {
    return kind;
  }
  return inferGameKindFromSessionId(session.session_id);
}

export function isGame0a(kind: string): kind is 'game_0a' {
  return kind === 'game_0a';
}

export function isGame0b(kind: string): kind is 'game_0b' {
  return kind === 'game_0b';
}

export function isGame0c(kind: string): kind is 'game_0c' {
  return kind === 'game_0c';
}
