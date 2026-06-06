/**
 * session_results 테이블에 게임 종료 결과를 1회 INSERT하는 헬퍼.
 * 실패해도 정산/게임 흐름을 막지 않도록 try-catch 내에서 사용한다.
 */
import { getSupabaseAdmin } from './supabase-admin';

export type GameType = 'game_0a' | 'game_0b';

export interface SessionResultPayload {
  sessionId: string | null;
  gameType: GameType;
  startedAt: string | null;
  endedAt: string;
  playerCount: number;
  winnerUserIds: string[];
  resultSummary: Record<string, unknown>;
}

export async function insertSessionResult(payload: SessionResultPayload): Promise<void> {
  const {
    sessionId,
    gameType,
    startedAt,
    endedAt,
    playerCount,
    winnerUserIds,
    resultSummary,
  } = payload;

  const durationSeconds =
    startedAt
      ? Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
      : null;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('session_results').insert({
    session_id: sessionId ?? null,
    game_type: gameType,
    started_at: startedAt ?? null,
    ended_at: endedAt,
    duration_seconds: durationSeconds,
    player_count: playerCount,
    winner_user_ids: winnerUserIds,
    result_summary: resultSummary,
  });

  if (error) {
    console.error(`session_results INSERT (${gameType}):`, error);
  }
}

/**
 * game_participants에서 player_number 목록을 user_id 배열로 변환.
 * 매칭 안 되는 번호는 무시한다.
 */
export async function playerNumbersToUserIds(
  gameId: string,
  playerNumbers: number[],
): Promise<string[]> {
  if (playerNumbers.length === 0) return [];

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('game_participants')
    .select('user_id')
    .eq('game_id', gameId)
    .in('player_number', playerNumbers);

  if (!data) return [];
  return (data as { user_id: string }[])
    .map((r) => r.user_id)
    .filter(Boolean);
}
