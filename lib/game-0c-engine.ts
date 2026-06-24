import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isGame0c, resolveGameKind } from '@/lib/session-game-kind';
import type {
  Game0cContactResult,
  Game0cContactType,
  Game0cEventRow,
  Game0cForcePair,
  Game0cPhase,
  Game0cPlayer,
  Game0cPlayerState,
  Game0cPublicRow,
  Game0cSnapshotRow,
  Game0cVariationChoice,
} from '@/lib/game-0c-types';

export class Game0cEngineError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = 'Game0cEngineError';
  }
}

/** 접촉 결과표 (결정론적, playerA 기준) */
export function resolveContactOutcome(
  stateA: Game0cPlayerState,
  stateB: Game0cPlayerState,
): {
  newStateA: Game0cPlayerState;
  newStateB: Game0cPlayerState;
  scoreDeltaA: number;
  scoreDeltaB: number;
} {
  if (stateA === 'human' && stateB === 'human') {
    return { newStateA: 'human', newStateB: 'human', scoreDeltaA: 1, scoreDeltaB: 1 };
  }
  if (stateA === 'human' && stateB === 'doctor') {
    return { newStateA: 'human', newStateB: 'human', scoreDeltaA: 1, scoreDeltaB: 0 };
  }
  if (stateA === 'doctor' && stateB === 'human') {
    return { newStateA: 'human', newStateB: 'human', scoreDeltaA: 0, scoreDeltaB: 1 };
  }
  if (stateA === 'human' && stateB === 'zombie') {
    return { newStateA: 'zombie', newStateB: 'zombie', scoreDeltaA: 0, scoreDeltaB: 3 };
  }
  if (stateA === 'zombie' && stateB === 'human') {
    return { newStateA: 'zombie', newStateB: 'zombie', scoreDeltaA: 3, scoreDeltaB: 0 };
  }
  if (stateA === 'doctor' && stateB === 'doctor') {
    return { newStateA: 'doctor', newStateB: 'doctor', scoreDeltaA: 0, scoreDeltaB: 0 };
  }
  if (stateA === 'doctor' && stateB === 'zombie') {
    return { newStateA: 'doctor', newStateB: 'human', scoreDeltaA: 2, scoreDeltaB: 0 };
  }
  if (stateA === 'zombie' && stateB === 'doctor') {
    return { newStateA: 'human', newStateB: 'doctor', scoreDeltaA: 0, scoreDeltaB: 2 };
  }
  return { newStateA: 'zombie', newStateB: 'zombie', scoreDeltaA: 0, scoreDeltaB: 0 };
}

function clonePlayers(players: Game0cPlayer[]): Game0cPlayer[] {
  return players.map((p) => ({ ...p }));
}

function findPlayer(players: Game0cPlayer[], num: number): Game0cPlayer {
  const player = players.find((p) => p.num === num);
  if (!player) {
    throw new Game0cEngineError(`플레이어 ${num} 없음`, 400);
  }
  return player;
}

async function assertGame0cSession(sessionId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select('game_kind')
    .eq('session_id', sessionId.trim())
    .maybeSingle();

  if (error) {
    console.error('sessions 조회:', error);
    throw new Game0cEngineError('세션 조회 실패', 500);
  }
  if (!data) {
    throw new Game0cEngineError('세션 없음', 404);
  }
  if (!isGame0c(resolveGameKind(data))) {
    throw new Game0cEngineError('game_0c 세션이 아님', 400);
  }
}

async function loadSnapshot(sessionId: string): Promise<Game0cSnapshotRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('game_0c_snapshot')
    .select('*')
    .eq('session_id', sessionId.trim())
    .maybeSingle();

  if (error) {
    console.error('game_0c_snapshot 조회:', error);
    throw new Game0cEngineError('스냅샷 조회 실패', 500);
  }
  if (!data) {
    throw new Game0cEngineError('스냅샷 없음. 게임 초기화가 필요합니다.', 404);
  }

  return {
    ...data,
    players: (data.players ?? []) as Game0cPlayer[],
    phase: data.phase as Game0cPhase | null,
  };
}

async function loadPublic(sessionId: string): Promise<Game0cPublicRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('game_0c_public')
    .select('*')
    .eq('session_id', sessionId.trim())
    .maybeSingle();

  if (error) {
    console.error('game_0c_public 조회:', error);
    throw new Game0cEngineError('공개 스냅샷 조회 실패', 500);
  }
  if (!data) return null;

  return {
    ...data,
    force_pairs: (data.force_pairs ?? []) as Game0cForcePair[],
    phase: data.phase as Game0cPhase | null,
  };
}

async function insertEvent(
  sessionId: string,
  round: number,
  eventType: string,
  payload: {
    actor_player?: number | null;
    target_player?: number | null;
    payload_public?: Record<string, unknown>;
    payload_private?: Record<string, unknown>;
    reverted_by?: number | null;
    created_by?: 'booth' | 'admin';
  },
): Promise<Game0cEventRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('game_0c_event')
    .insert({
      session_id: sessionId.trim(),
      round,
      event_type: eventType,
      actor_player: payload.actor_player ?? null,
      target_player: payload.target_player ?? null,
      payload_public: payload.payload_public ?? {},
      payload_private: payload.payload_private ?? {},
      reverted_by: payload.reverted_by ?? null,
      created_by: payload.created_by ?? 'booth',
    })
    .select('*')
    .single();

  if (error) {
    console.error('game_0c_event insert:', error);
    throw new Game0cEngineError(error.message, 500);
  }

  return data as Game0cEventRow;
}

function outcomeToContactResult(
  playerA: number,
  playerB: number,
  outcome: ReturnType<typeof resolveContactOutcome>,
): Game0cContactResult {
  const score_deltas: Record<string, number> = {};
  if (outcome.scoreDeltaA !== 0) score_deltas[String(playerA)] = outcome.scoreDeltaA;
  if (outcome.scoreDeltaB !== 0) score_deltas[String(playerB)] = outcome.scoreDeltaB;
  return {
    state_changes: {
      [String(playerA)]: outcome.newStateA,
      [String(playerB)]: outcome.newStateB,
    },
    score_deltas,
  };
}

function applyContactResult(players: Game0cPlayer[], result: Game0cContactResult): void {
  for (const [numStr, state] of Object.entries(result.state_changes)) {
    findPlayer(players, Number(numStr)).state = state;
  }
  for (const [numStr, delta] of Object.entries(result.score_deltas)) {
    findPlayer(players, Number(numStr)).score += delta;
  }
}

function consumeSlots(
  players: Game0cPlayer[],
  playerA: number,
  playerB: number,
  contactType: Game0cContactType,
): void {
  const a = findPlayer(players, playerA);
  const b = findPlayer(players, playerB);

  if (contactType === 'normal') {
    if (a.slots_left < 1) {
      throw new Game0cEngineError(`플레이어 ${playerA} 슬롯 부족`, 400);
    }
    if (b.slots_left < 1) {
      throw new Game0cEngineError(`플레이어 ${playerB} 슬롯 부족`, 400);
    }
    a.slots_left -= 1;
    b.slots_left -= 1;
    return;
  }

  if (a.slots_left < 1) {
    throw new Game0cEngineError(`플레이어 ${playerA} 슬롯 부족`, 400);
  }
  a.slots_left -= 1;
}

function replaySlotConsumption(
  players: Game0cPlayer[],
  playerA: number,
  playerB: number,
  contactType: Game0cContactType,
): void {
  const a = findPlayer(players, playerA);
  const b = findPlayer(players, playerB);

  if (contactType === 'normal') {
    a.slots_left -= 1;
    b.slots_left -= 1;
    return;
  }
  a.slots_left -= 1;
}

async function saveSnapshot(
  sessionId: string,
  round: number,
  phase: Game0cPhase,
  players: Game0cPlayer[],
): Promise<Game0cSnapshotRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('game_0c_snapshot')
    .upsert({
      session_id: sessionId.trim(),
      round,
      phase,
      players,
    })
    .select('*')
    .single();

  if (error) {
    console.error('game_0c_snapshot upsert:', error);
    throw new Game0cEngineError(error.message, 500);
  }

  return {
    ...data,
    players: (data.players ?? []) as Game0cPlayer[],
    phase: data.phase as Game0cPhase | null,
  };
}

async function savePublic(
  sessionId: string,
  patch: Partial<Pick<Game0cPublicRow, 'round' | 'phase' | 'force_pairs'>>,
): Promise<Game0cPublicRow> {
  const supabase = getSupabaseAdmin();
  const existing = await loadPublic(sessionId);
  const row = {
    session_id: sessionId.trim(),
    round: patch.round ?? existing?.round ?? null,
    phase: patch.phase ?? existing?.phase ?? null,
    force_candidates: existing?.force_candidates ?? [],
    bid_results: existing?.bid_results ?? [],
    force_pairs: patch.force_pairs ?? existing?.force_pairs ?? [],
  };

  const { data, error } = await supabase
    .from('game_0c_public')
    .upsert(row)
    .select('*')
    .single();

  if (error) {
    console.error('game_0c_public upsert:', error);
    throw new Game0cEngineError(error.message, 500);
  }

  return {
    ...data,
    force_pairs: (data.force_pairs ?? []) as Game0cForcePair[],
    phase: data.phase as Game0cPhase | null,
  };
}

/** is_reverted=false인 이벤트를 id 순으로 fold해 스냅샷·공개 스냅샷 재계산 */
export async function rebuildSnapshot(sessionId: string): Promise<{
  snapshot: Game0cSnapshotRow;
  public: Game0cPublicRow;
}> {
  await assertGame0cSession(sessionId);

  const supabase = getSupabaseAdmin();
  const { data: events, error } = await supabase
    .from('game_0c_event')
    .select('*')
    .eq('session_id', sessionId.trim())
    .eq('is_reverted', false)
    .order('id', { ascending: true });

  if (error) {
    console.error('game_0c_event 조회:', error);
    throw new Game0cEngineError('이벤트 조회 실패', 500);
  }

  let players: Game0cPlayer[] | null = null;
  let round = 0;
  let phase: Game0cPhase = 'ROUND_OPEN';
  const forcePairs: Game0cForcePair[] = [];

  for (const raw of events ?? []) {
    const ev = raw as Game0cEventRow;
    const priv = ev.payload_private ?? {};

    if (ev.event_type === 'ROUND_OPEN') {
      players = clonePlayers((priv.players as Game0cPlayer[]) ?? []);
      round = ev.round;
      phase = 'ROUND_OPEN';
      continue;
    }

    if (!players) continue;

    if (ev.event_type === 'CONTACT_RESOLVE') {
      const playerA = priv.a as number;
      const playerB = priv.b as number;
      const contactType = priv.contact_type as Game0cContactType;
      replaySlotConsumption(players, playerA, playerB, contactType);
      applyContactResult(players, priv.result as Game0cContactResult);

      if (contactType === 'force') {
        const at = (ev.payload_public?.at as string) ?? ev.created_at;
        forcePairs.push({ round: ev.round, pair: [playerA, playerB], at });
      }
      round = ev.round;
      continue;
    }

    if (ev.event_type === 'VARIATION_RESOLVE') {
      const playerNum = priv.player as number;
      const player = findPlayer(players, playerNum);
      player.slots_left -= 1;
      if (priv.success === true) {
        player.state = priv.choice as Game0cPlayerState;
      }
      round = ev.round;
    }
  }

  if (!players) {
    throw new Game0cEngineError('ROUND_OPEN 이벤트 없음. rebuild 불가', 400);
  }

  const snapshot = await saveSnapshot(sessionId, round, phase, players);
  const publicRow = await savePublic(sessionId, { round, phase, force_pairs: forcePairs });
  return { snapshot, public: publicRow };
}

/** 게임 초기화: 스냅샷·공개 스냅샷 생성 (중복 시 에러) */
export async function initGame(
  sessionId: string,
  playerCount: number,
): Promise<{
  snapshot: Game0cSnapshotRow;
  public: Game0cPublicRow;
}> {
  await assertGame0cSession(sessionId);

  if (!Number.isInteger(playerCount) || playerCount < 8 || playerCount > 12) {
    throw new Game0cEngineError('player_count는 8~12 사이 정수여야 합니다', 400);
  }

  const supabase = getSupabaseAdmin();
  const sid = sessionId.trim();

  const { data: existingSnap } = await supabase
    .from('game_0c_snapshot')
    .select('session_id')
    .eq('session_id', sid)
    .maybeSingle();

  if (existingSnap) {
    throw new Game0cEngineError('이미 초기화된 게임입니다', 400);
  }

  const { data: existingPublic } = await supabase
    .from('game_0c_public')
    .select('session_id')
    .eq('session_id', sid)
    .maybeSingle();

  if (existingPublic) {
    throw new Game0cEngineError('이미 초기화된 게임입니다', 400);
  }

  const players: Game0cPlayer[] = Array.from({ length: playerCount }, (_, i) => ({
    num: i + 1,
    state: 'human',
    score: 0,
    slots_left: 3,
  }));

  const { data: snapshotData, error: snapErr } = await supabase
    .from('game_0c_snapshot')
    .insert({
      session_id: sid,
      round: 0,
      phase: 'WAITING',
      players,
    })
    .select('*')
    .single();

  if (snapErr) {
    console.error('game_0c_snapshot insert:', snapErr);
    throw new Game0cEngineError(snapErr.message, 500);
  }

  const { data: publicData, error: pubErr } = await supabase
    .from('game_0c_public')
    .insert({
      session_id: sid,
      round: 0,
      phase: 'WAITING',
      force_candidates: [],
      bid_results: [],
      force_pairs: [],
    })
    .select('*')
    .single();

  if (pubErr) {
    console.error('game_0c_public insert:', pubErr);
    throw new Game0cEngineError(pubErr.message, 500);
  }

  return {
    snapshot: {
      ...snapshotData,
      players: (snapshotData.players ?? []) as Game0cPlayer[],
      phase: snapshotData.phase as Game0cPhase | null,
    },
    public: {
      ...publicData,
      force_pairs: (publicData.force_pairs ?? []) as Game0cForcePair[],
      phase: publicData.phase as Game0cPhase | null,
    },
  };
}

/** 라운드 시작: 슬롯 3으로 초기화, phase ROUND_OPEN, 이벤트 기록 */
export async function initRound(sessionId: string, round: number): Promise<{
  snapshot: Game0cSnapshotRow;
  public: Game0cPublicRow;
  event: Game0cEventRow;
}> {
  await assertGame0cSession(sessionId);

  const current = await loadSnapshot(sessionId);
  const players = clonePlayers(current.players).map((p) => ({ ...p, slots_left: 3 }));

  const event = await insertEvent(sessionId, round, 'ROUND_OPEN', {
    payload_private: { players },
    created_by: 'booth',
  });

  const snapshot = await saveSnapshot(sessionId, round, 'ROUND_OPEN', players);
  const publicRow = await savePublic(sessionId, { round, phase: 'ROUND_OPEN' });

  return { snapshot, public: publicRow, event };
}

/** 접촉 즉시 판정 */
export async function processContact(
  sessionId: string,
  round: number,
  playerA: number,
  playerB: number,
  contactType: Game0cContactType,
): Promise<{
  snapshot: Game0cSnapshotRow;
  public: Game0cPublicRow | null;
  event: Game0cEventRow;
}> {
  await assertGame0cSession(sessionId);

  if (playerA === playerB) {
    throw new Game0cEngineError('같은 플레이어 간 접촉 불가', 400);
  }

  const current = await loadSnapshot(sessionId);
  const players = clonePlayers(current.players);
  const a = findPlayer(players, playerA);
  const b = findPlayer(players, playerB);

  consumeSlots(players, playerA, playerB, contactType);

  const outcome = resolveContactOutcome(a.state, b.state);
  a.state = outcome.newStateA;
  b.state = outcome.newStateB;
  a.score += outcome.scoreDeltaA;
  b.score += outcome.scoreDeltaB;

  const contactResult = outcomeToContactResult(playerA, playerB, outcome);

  const payloadPrivate = {
    a: playerA,
    b: playerB,
    contact_type: contactType,
    result: contactResult,
  };

  const payloadPublic: Record<string, unknown> = {};
  let publicRow: Game0cPublicRow | null = null;

  if (contactType === 'force') {
    const at = new Date().toISOString();
    payloadPublic.pair = [playerA, playerB];
    payloadPublic.at = at;

    const existing = await loadPublic(sessionId);
    const forcePairs = [...(existing?.force_pairs ?? [])];
    forcePairs.push({ round, pair: [playerA, playerB], at });
    publicRow = await savePublic(sessionId, { round, force_pairs: forcePairs });
  }

  const event = await insertEvent(sessionId, round, 'CONTACT_RESOLVE', {
    actor_player: playerA,
    target_player: playerB,
    payload_public: payloadPublic,
    payload_private: payloadPrivate,
    created_by: 'booth',
  });

  const snapshot = await saveSnapshot(
    sessionId,
    round,
    current.phase ?? 'ROUND_OPEN',
    players,
  );

  return { snapshot, public: publicRow, event };
}

/** 변신(또는 probe) 즉시 처리 */
export async function processVariation(
  sessionId: string,
  round: number,
  player: number,
  choice: Game0cVariationChoice,
): Promise<{
  snapshot: Game0cSnapshotRow;
  event: Game0cEventRow;
}> {
  await assertGame0cSession(sessionId);

  const current = await loadSnapshot(sessionId);
  const players = clonePlayers(current.players);
  const target = findPlayer(players, player);
  const probedState = target.state;

  if (target.slots_left < 1) {
    throw new Game0cEngineError(`플레이어 ${player} 슬롯 부족`, 400);
  }
  target.slots_left -= 1;

  const success = probedState === 'human';
  if (success) {
    target.state = choice;
  }

  const event = await insertEvent(sessionId, round, 'VARIATION_RESOLVE', {
    actor_player: player,
    payload_private: {
      player,
      choice,
      success,
      probed_state: probedState,
    },
    created_by: 'booth',
  });

  const snapshot = await saveSnapshot(
    sessionId,
    round,
    current.phase ?? 'ROUND_OPEN',
    players,
  );

  return { snapshot, event };
}

/** 이벤트 되돌리기: is_reverted 플래그 + REVERT 이벤트 + rebuild */
export async function revertEvent(
  sessionId: string,
  targetEventId: number,
  reason: string,
): Promise<{
  revertEvent: Game0cEventRow;
  snapshot: Game0cSnapshotRow;
  public: Game0cPublicRow;
}> {
  await assertGame0cSession(sessionId);

  const supabase = getSupabaseAdmin();
  const { data: target, error: targetErr } = await supabase
    .from('game_0c_event')
    .select('*')
    .eq('id', targetEventId)
    .eq('session_id', sessionId.trim())
    .maybeSingle();

  if (targetErr) {
    console.error('game_0c_event 조회:', targetErr);
    throw new Game0cEngineError('이벤트 조회 실패', 500);
  }
  if (!target) {
    throw new Game0cEngineError('대상 이벤트 없음', 404);
  }
  if (target.is_reverted) {
    throw new Game0cEngineError('이미 되돌린 이벤트', 400);
  }
  if (target.event_type === 'REVERT') {
    throw new Game0cEngineError('REVERT 이벤트는 되돌릴 수 없음', 400);
  }

  const { error: updateErr } = await supabase
    .from('game_0c_event')
    .update({ is_reverted: true })
    .eq('id', targetEventId)
    .eq('session_id', sessionId.trim());

  if (updateErr) {
    console.error('game_0c_event is_reverted 업데이트:', updateErr);
    throw new Game0cEngineError(updateErr.message, 500);
  }

  const revertEv = await insertEvent(sessionId, target.round, 'REVERT', {
    reverted_by: targetEventId,
    payload_private: { target_event_id: targetEventId, reason },
    created_by: 'admin',
  });

  const rebuilt = await rebuildSnapshot(sessionId);
  return { revertEvent: revertEv, ...rebuilt };
}
