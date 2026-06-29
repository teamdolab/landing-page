export type StationActiveInfo =
  | { active: false }
  | { active: true; session_id: string; game_kind: string };

export type StationAccessState =
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'no_game' }
  | { status: 'ready'; gameId: string; sessionId: string };

export async function fetchStationActiveInfo(
  stationId: string,
): Promise<StationActiveInfo | 'not_found' | 'error'> {
  const res = await fetch(`/api/stations/${encodeURIComponent(stationId)}`);
  if (res.status === 404) return 'not_found';
  if (!res.ok) return 'error';
  return res.json() as Promise<StationActiveInfo>;
}

export async function resolveGameIdFromSession(
  sessionId: string,
  gameKind: string,
): Promise<string | null> {
  if (gameKind === 'game_0b') {
    const res = await fetch(`/api/game/game_0b/session/${encodeURIComponent(sessionId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.game_id === 'string' ? data.game_id : null;
  }

  const res = await fetch(`/api/game/session/${encodeURIComponent(sessionId)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data?.game_id === 'string' ? data.game_id : null;
}

export async function resolveStationAccess(stationId: string): Promise<StationAccessState> {
  const info = await fetchStationActiveInfo(stationId);
  if (info === 'not_found' || info === 'error') {
    return { status: 'invalid' };
  }
  if (!info.active) {
    return { status: 'no_game' };
  }

  const gameId = await resolveGameIdFromSession(info.session_id, info.game_kind);
  if (!gameId) {
    return { status: 'no_game' };
  }

  return {
    status: 'ready',
    gameId,
    sessionId: info.session_id,
  };
}
