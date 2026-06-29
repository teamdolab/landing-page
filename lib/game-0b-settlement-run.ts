import { getSupabaseAdmin } from './supabase-admin';
import { calcGame0bCredits } from './game-0b-credit';
import { getPlayerRoleCore } from './game-0b-types';
import { settleSession, type PlayerSettlement, type SettlementResult } from './settlement';
import { playerNumbersToUserIds } from './session-result';
import type { Game0bRow } from './game-0b-types';

export async function runGame0bSettleSession(params: {
  game: Game0bRow;
  winnerUserIds: string[];
  winnerPlayerNumbers: number[];
  resultSummary: Record<string, unknown>;
}): Promise<void> {
  const { game, winnerUserIds, winnerPlayerNumbers, resultSummary } = params;
  const sessionId = game.session_id?.trim();
  if (!sessionId) return;

  const supabase = getSupabaseAdmin();
  const { data: sessionRow, error: sessionError } = await supabase
    .from('sessions')
    .select('base_price')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (sessionError) throw sessionError;

  const sessionPrice = (sessionRow?.base_price as number | null) ?? 25000;
  const creditRows = calcGame0bCredits({ game, sessionPrice });
  const endedAt = new Date().toISOString();

  const { data: participants } = await supabase
    .from('game_participants')
    .select('player_number, user_id')
    .eq('session_id', sessionId);

  const userIdByPlayer = new Map<number, string>();
  for (const row of participants ?? []) {
    if (row.user_id) userIdByPlayer.set(row.player_number as number, row.user_id as string);
  }

  const userIds = [...new Set(userIdByPlayer.values())];
  const creditsByUserId = new Map<string, number>();
  if (userIds.length > 0) {
    const { data: creditInfo } = await supabase
      .from('user_info')
      .select('id, credits')
      .in('id', userIds);
    for (const row of creditInfo ?? []) {
      creditsByUserId.set(row.id as string, (row.credits as number) ?? 0);
    }
  }

  const players: PlayerSettlement[] = creditRows.map((row) => {
    const uid = userIdByPlayer.get(row.player_number) ?? null;
    const creditBefore = uid ? (creditsByUserId.get(uid) ?? 0) : 0;
    return {
      user_id: uid,
      player_number: row.player_number,
      credit_before: creditBefore,
      credit_delta: row.credit_delta,
      credit_after: creditBefore + row.credit_delta,
      rank: row.rank,
      raw: {
        role: getPlayerRoleCore(game, row.player_number).role,
      },
    };
  });

  const payload: SettlementResult = {
    session_id: sessionId,
    game_type: 'game_0b',
    started_at: game.created_at ?? null,
    ended_at: endedAt,
    player_count: game.player_count,
    winner_user_ids: winnerUserIds.length > 0
      ? winnerUserIds
      : await playerNumbersToUserIds(game.game_id, winnerPlayerNumbers),
    result_summary: resultSummary,
    players,
  };

  await settleSession(payload);
}
