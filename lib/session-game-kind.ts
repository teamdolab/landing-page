/** sessions.game_kind 컬럼으로 게임 종류를 구분한다. */

export type GameKind = 'game_0a' | 'game_0b' | 'game_0c';

/** sessions.game_kind 값을 정규화 (없거나 알 수 없으면 game_0a) */
export function resolveGameKind(session: {
  game_kind?: string | null;
}): GameKind {
  const kind = session.game_kind?.trim();
  if (kind === 'game_0a' || kind === 'game_0b' || kind === 'game_0c') {
    return kind;
  }
  return 'game_0a';
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
