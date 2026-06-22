import { getSupabaseAdmin } from './supabase-admin';

export type SettlementStatus = 'pending' | 'claimed';

// 이 타입은 한 플레이어가 받을 정산 영수증 한 장의 표준 양식입니다.
export type PlayerSettlement = {
  user_id: string | null;
  player_number: number;
  credit_before: number;
  credit_delta: number;
  credit_after: number;
  rank: number | null;
  raw: Record<string, unknown>;
};

// 이 타입은 게임이 공통 정산 모듈에 넘기는 한 회차 결과 묶음입니다.
export type SettlementResult = {
  session_id: string;
  game_type: string;
  started_at: string | null;
  ended_at: string;
  player_count: number;
  winner_user_ids: string[];
  result_summary: Record<string, unknown>;
  players: PlayerSettlement[];
};

export type SettleSessionOutcome = {
  created: boolean;
  reason?: 'already_exists';
};

export type ClaimCreditOutcome = {
  claimed: boolean;
  alreadyClaimed: boolean;
  creditsBefore?: number;
  creditsAfter?: number;
};

type SessionPlayerResultRow = {
  id: string;
  session_id: string;
  player_number: number;
  user_id: string | null;
  credit_delta: number;
  status: SettlementStatus;
};

function getDurationSeconds(startedAt: string | null, endedAt: string): number | null {
  if (!startedAt) return null;
  const started = new Date(startedAt).getTime();
  const ended = new Date(endedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(ended)) return null;
  return Math.floor((ended - started) / 1000);
}

// 이 함수는 게임이 넘긴 회차 결과를 플레이어별 영수증과 회차 요약 장부에 처음 한 번만 적습니다.
export async function settleSession(payload: SettlementResult): Promise<SettleSessionOutcome> {
  const supabase = getSupabaseAdmin();

  const { data: existingReceipt, error: receiptCheckError } = await supabase
    .from('session_player_results')
    .select('id')
    .eq('session_id', payload.session_id)
    .limit(1)
    .maybeSingle();

  if (receiptCheckError) throw receiptCheckError;
  if (existingReceipt) return { created: false, reason: 'already_exists' };

  const { data: existingSummary, error: summaryCheckError } = await supabase
    .from('session_results')
    .select('id')
    .eq('session_id', payload.session_id)
    .limit(1)
    .maybeSingle();

  if (summaryCheckError) throw summaryCheckError;
  if (existingSummary) return { created: false, reason: 'already_exists' };

  const settledAt = payload.ended_at;
  const playerRows = payload.players.map((player) => ({
    session_id: payload.session_id,
    game_type: payload.game_type,
    user_id: player.user_id,
    player_number: player.player_number,
    credit_before: player.credit_before,
    credit_delta: player.credit_delta,
    credit_after: player.credit_after,
    rank: player.rank,
    raw: player.raw ?? {},
    status: 'pending' as const,
    settled_at: settledAt,
    claimed_at: null,
  }));

  if (playerRows.length > 0) {
    const { error: playerInsertError } = await supabase
      .from('session_player_results')
      .insert(playerRows);

    if (playerInsertError) {
      if (playerInsertError.code === '23505') return { created: false, reason: 'already_exists' };
      throw playerInsertError;
    }
  }

  const { error: summaryInsertError } = await supabase
    .from('session_results')
    .insert({
      session_id: payload.session_id,
      game_type: payload.game_type,
      started_at: payload.started_at,
      ended_at: payload.ended_at,
      duration_seconds: getDurationSeconds(payload.started_at, payload.ended_at),
      player_count: payload.player_count,
      winner_user_ids: payload.winner_user_ids,
      result_summary: payload.result_summary,
    });

  if (summaryInsertError) throw summaryInsertError;

  return { created: true };
}

// 이 함수는 아직 수령 전인 영수증의 credit_delta를 회원 크레딧에 한 번만 반영합니다.
export async function claimCredit(
  session_id: string,
  player_number: number,
): Promise<ClaimCreditOutcome> {
  const supabase = getSupabaseAdmin();

  const { data: receipt, error: receiptError } = await supabase
    .from('session_player_results')
    .select('id, session_id, player_number, user_id, credit_delta, status')
    .eq('session_id', session_id)
    .eq('player_number', player_number)
    .maybeSingle();

  if (receiptError) throw receiptError;
  if (!receipt) return { claimed: false, alreadyClaimed: false };

  const row = receipt as SessionPlayerResultRow;
  if (row.status === 'claimed') return { claimed: false, alreadyClaimed: true };
  if (!row.user_id) throw new Error('Cannot claim credit without user_id');

  const { data: user, error: userError } = await supabase
    .from('user_info')
    .select('credits')
    .eq('id', row.user_id)
    .maybeSingle();

  if (userError) throw userError;
  if (!user) throw new Error('User not found for settlement claim');

  const currentCredits = ((user as { credits: number | null }).credits ?? 0);
  const nextCredits = currentCredits + row.credit_delta;
  const claimedAt = new Date().toISOString();

  const { data: claimedReceipt, error: claimError } = await supabase
    .from('session_player_results')
    .update({ status: 'claimed', claimed_at: claimedAt })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claimedReceipt) return { claimed: false, alreadyClaimed: true };

  const { error: creditError } = await supabase
    .from('user_info')
    .update({ credits: nextCredits })
    .eq('id', row.user_id);

  if (creditError) {
    await supabase
      .from('session_player_results')
      .update({ status: 'pending', claimed_at: null })
      .eq('id', row.id)
      .eq('status', 'claimed');
    throw creditError;
  }

  return {
    claimed: true,
    alreadyClaimed: false,
    creditsBefore: currentCredits,
    creditsAfter: nextCredits,
  };
}

// 이 함수는 현재 운영 중으로 표시된 회차 ID를 읽습니다.
export async function getActiveSession(): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('active_session_pointer')
    .select('session_id')
    .eq('id', true)
    .maybeSingle();

  if (error) throw error;
  return (data as { session_id: string | null } | null)?.session_id ?? null;
}

// 이 함수는 운영자가 지금 활성으로 볼 회차 ID를 한 곳에 저장합니다.
export async function setActiveSession(session_id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('active_session_pointer')
    .upsert({
      id: true,
      session_id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) throw error;
}

// 이 함수는 현재 활성 회차 표시를 비워 새 회차가 정해지지 않은 상태로 만듭니다.
export async function clearActiveSession(): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('active_session_pointer')
    .upsert({
      id: true,
      session_id: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) throw error;
}
