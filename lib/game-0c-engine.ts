import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isGame0c, resolveGameKind } from '@/lib/session-game-kind';
import type {
  Game0cBidResult,
  Game0cContactResult,
  Game0cContactType,
  Game0cEventRow,
  Game0cForceCandidate,
  Game0cForcePair,
  Game0cPhase,
  Game0cPlayer,
  Game0cPlayerState,
  Game0cPublicRow,
  Game0cSnapshotRow,
  Game0cFinalResult,
  Game0cPendingContact,
  Game0cBoothState,
  Game0cVariationChoice,
} from '@/lib/game-0c-types';

const FORCE_CANDIDATE_COUNT: Record<number, number> = {
  8: 2,
  9: 3,
  10: 3,
  11: 3,
  12: 4,
};

function addMinutes(date: Date, minutes: number): string {
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
}

/** 점수 하위 N명 선정. 동점 그룹이 N 초과면 해당 그룹 통째 제외 */
export function selectForceCandidates(players: Game0cPlayer[]): Game0cPlayer[] {
  const n = FORCE_CANDIDATE_COUNT[players.length];
  if (!n) {
    throw new Game0cEngineError(`지원하지 않는 인원수: ${players.length}`, 400);
  }

  const sorted = [...players].sort((a, b) => a.score - b.score || a.num - b.num);
  const selected: Game0cPlayer[] = [];

  let i = 0;
  while (i < sorted.length) {
    const score = sorted[i].score;
    const group: Game0cPlayer[] = [];
    while (i < sorted.length && sorted[i].score === score) {
      group.push(sorted[i]);
      i += 1;
    }
    if (selected.length + group.length > n) {
      break;
    }
    selected.push(...group);
  }

  return selected;
}

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

function parsePending(raw: unknown): Game0cPendingContact | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.type !== 'normal_contact') return null;
  const playerA = Number(o.player_a);
  if (!Number.isInteger(playerA)) return null;
  const at = typeof o.at === 'string' ? o.at : null;
  if (!at) return null;
  return { type: 'normal_contact', player_a: playerA, at };
}

function mapSnapshotRow(data: Record<string, unknown>): Game0cSnapshotRow {
  const status = data.status === '완료' ? '완료' : '진행중';
  return {
    ...data,
    players: (data.players ?? []) as Game0cPlayer[],
    phase: data.phase as Game0cPhase | null,
    pending: parsePending(data.pending),
    status,
  } as Game0cSnapshotRow;
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

  return mapSnapshotRow(data);
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
  const sid = sessionId.trim();

  const { data: existing } = await supabase
    .from('game_0c_snapshot')
    .select('pending, status')
    .eq('session_id', sid)
    .maybeSingle();

  const { data, error } = await supabase
    .from('game_0c_snapshot')
    .upsert({
      session_id: sid,
      round,
      phase,
      players,
      pending: existing?.pending ?? null,
      status: existing?.status ?? '진행중',
    })
    .select('*')
    .single();

  if (error) {
    console.error('game_0c_snapshot upsert:', error);
    throw new Game0cEngineError(error.message, 500);
  }

  return mapSnapshotRow(data);
}

async function savePublic(
  sessionId: string,
  patch: Partial<
    Pick<
      Game0cPublicRow,
      'round' | 'phase' | 'timer_end' | 'force_candidates' | 'bid_results' | 'force_pairs'
    >
  >,
): Promise<Game0cPublicRow> {
  const supabase = getSupabaseAdmin();
  const existing = await loadPublic(sessionId);
  const row = {
    session_id: sessionId.trim(),
    round: patch.round ?? existing?.round ?? null,
    phase: patch.phase ?? existing?.phase ?? null,
    timer_end: patch.timer_end !== undefined ? patch.timer_end : (existing?.timer_end ?? null),
    force_candidates: patch.force_candidates ?? existing?.force_candidates ?? [],
    bid_results: patch.bid_results ?? existing?.bid_results ?? [],
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
      continue;
    }

    if (ev.event_type === 'BID_SUBMIT') {
      const playerNum = priv.player as number;
      const bids = priv.bids as number;
      const player = findPlayer(players, playerNum);
      player.slots_left -= bids;
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
      status: '진행중',
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
    snapshot: mapSnapshotRow(snapshotData),
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
  const publicRow = await savePublic(sessionId, {
    round,
    phase: 'ROUND_OPEN',
    timer_end: null,
    force_candidates: [],
    bid_results: [],
  });

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
  if (contactType === 'normal' && current.phase !== 'OPEN') {
    throw new Game0cEngineError('일반 접촉은 자유시간(OPEN)에만 가능합니다', 400);
  }
  if (contactType === 'force' && current.phase !== 'FORCE') {
    throw new Game0cEngineError('강제 접촉은 FORCE 단계에만 가능합니다', 400);
  }

  if (contactType === 'force') {
    const publicRow = await loadPublic(sessionId);
    const candidates = parseForceCandidates(publicRow?.force_candidates);
    if (!candidates.some((c) => c.player === playerA)) {
      throw new Game0cEngineError('강제접촉 권한이 없는 플레이어입니다', 400);
    }

    const supabase = getSupabaseAdmin();
    const { data: existingForce, error: forceErr } = await supabase
      .from('game_0c_event')
      .select('id')
      .eq('session_id', sessionId.trim())
      .eq('round', round)
      .eq('event_type', 'CONTACT_RESOLVE')
      .eq('actor_player', playerA)
      .eq('is_reverted', false)
      .filter('payload_private->>contact_type', 'eq', 'force')
      .limit(1);

    if (forceErr) {
      console.error('강제접촉 이력 조회:', forceErr);
      throw new Game0cEngineError('이벤트 조회 실패', 500);
    }
    if (existingForce && existingForce.length > 0) {
      throw new Game0cEngineError('이미 이번 라운드에 강제접촉을 사용했습니다', 400);
    }
  }

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
  if (current.phase !== 'OPEN') {
    throw new Game0cEngineError('변신은 자유시간(OPEN)에만 가능합니다', 400);
  }

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

function parseForceCandidates(raw: unknown): Game0cForceCandidate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const player = Number(o.player);
      if (!Number.isInteger(player)) return null;
      const order = o.order == null ? null : Number(o.order);
      if (order != null && !Number.isInteger(order)) return null;
      return { player, order };
    })
    .filter((x): x is Game0cForceCandidate => x != null);
}

async function loadBidSubmits(sessionId: string, round: number): Promise<Game0cEventRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('game_0c_event')
    .select('*')
    .eq('session_id', sessionId.trim())
    .eq('round', round)
    .eq('event_type', 'BID_SUBMIT')
    .eq('is_reverted', false);

  if (error) {
    console.error('BID_SUBMIT 조회:', error);
    throw new Game0cEngineError('입찰 이벤트 조회 실패', 500);
  }
  return (data ?? []) as Game0cEventRow[];
}

function consumePlayerSlots(player: Game0cPlayer, count: number): void {
  if (count < 0) {
    throw new Game0cEngineError('슬롯 소모량이 올바르지 않습니다', 400);
  }
  if (player.slots_left < count) {
    throw new Game0cEngineError(`플레이어 ${player.num} 슬롯 부족 (필요: ${count}, 잔여: ${player.slots_left})`, 400);
  }
  player.slots_left -= count;
}

/** 2라운드~ 입찰 시작: 후보 선정 + BIDDING phase */
export async function startBidding(sessionId: string, round: number): Promise<{
  snapshot: Game0cSnapshotRow;
  public: Game0cPublicRow;
  event: Game0cEventRow;
}> {
  await assertGame0cSession(sessionId);

  if (round < 2) {
    throw new Game0cEngineError('입찰은 2라운드부터 가능합니다', 400);
  }

  const snapshot = await loadSnapshot(sessionId);
  if (snapshot.phase !== 'ROUND_OPEN') {
    throw new Game0cEngineError(`현재 phase(${snapshot.phase})에서는 입찰을 시작할 수 없습니다`, 400);
  }
  if (snapshot.round !== round) {
    throw new Game0cEngineError('라운드가 일치하지 않습니다', 400);
  }

  const candidates = selectForceCandidates(snapshot.players);
  const forceCandidates: Game0cForceCandidate[] = candidates.map((p) => ({
    player: p.num,
    order: null,
  }));

  const timerEnd = addMinutes(new Date(), 4);

  const event = await insertEvent(sessionId, round, 'FORCE_CANDIDATES_SET', {
    payload_public: { candidates: forceCandidates },
    payload_private: { candidate_players: candidates.map((p) => p.num) },
    created_by: 'admin',
  });

  const publicRow = await savePublic(sessionId, {
    round,
    phase: 'BIDDING',
    timer_end: timerEnd,
    force_candidates: forceCandidates,
    bid_results: [],
  });

  const updatedSnapshot = await saveSnapshot(sessionId, round, 'BIDDING', snapshot.players);

  return { snapshot: updatedSnapshot, public: publicRow, event };
}

/** 입찰 제출 (후보만, 슬롯 bids개 서버에서 소모) */
export async function submitBid(
  sessionId: string,
  round: number,
  player: number,
  bids: number,
): Promise<{
  snapshot: Game0cSnapshotRow;
  event: Game0cEventRow;
}> {
  await assertGame0cSession(sessionId);

  if (!Number.isInteger(bids) || bids < 0 || bids > 2) {
    throw new Game0cEngineError('bids는 0~2 정수여야 합니다', 400);
  }

  const snapshot = await loadSnapshot(sessionId);
  if (snapshot.phase !== 'BIDDING') {
    throw new Game0cEngineError('입찰 단계가 아닙니다', 400);
  }
  if (snapshot.round !== round) {
    throw new Game0cEngineError('라운드가 일치하지 않습니다', 400);
  }

  const publicRow = await loadPublic(sessionId);
  const candidates = parseForceCandidates(publicRow?.force_candidates);
  if (!candidates.some((c) => c.player === player)) {
    throw new Game0cEngineError(`플레이어 ${player}은(는) 강제접촉 후보가 아닙니다`, 400);
  }

  const existingBids = await loadBidSubmits(sessionId, round);
  if (existingBids.some((ev) => ev.payload_private?.player === player)) {
    throw new Game0cEngineError(`플레이어 ${player}은(는) 이미 입찰했습니다`, 400);
  }

  const players = clonePlayers(snapshot.players);
  const target = findPlayer(players, player);
  consumePlayerSlots(target, bids);

  const event = await insertEvent(sessionId, round, 'BID_SUBMIT', {
    actor_player: player,
    payload_private: { player, bids },
    created_by: 'admin',
  });

  const updatedSnapshot = await saveSnapshot(sessionId, round, 'BIDDING', players);
  return { snapshot: updatedSnapshot, event };
}

/** 입찰 종료: 순서 결정 + FORCE phase */
export async function closeBidding(sessionId: string, round: number): Promise<{
  snapshot: Game0cSnapshotRow;
  public: Game0cPublicRow;
  event: Game0cEventRow;
}> {
  await assertGame0cSession(sessionId);

  const snapshot = await loadSnapshot(sessionId);
  if (snapshot.phase !== 'BIDDING') {
    throw new Game0cEngineError('입찰 단계가 아닙니다', 400);
  }
  if (snapshot.round !== round) {
    throw new Game0cEngineError('라운드가 일치하지 않습니다', 400);
  }

  const publicRow = await loadPublic(sessionId);
  const candidates = parseForceCandidates(publicRow?.force_candidates);
  const bidEvents = await loadBidSubmits(sessionId, round);
  const bidMap = new Map<number, number>();
  for (const ev of bidEvents) {
    bidMap.set(ev.payload_private.player as number, ev.payload_private.bids as number);
  }

  const scored = candidates.map((c) => {
    const p = findPlayer(snapshot.players, c.player);
    return {
      player: c.player,
      score: p.score,
      bids: bidMap.get(c.player) ?? 0,
      tiebreak: Math.random(),
    };
  });

  scored.sort((a, b) => a.score - b.score || b.bids - a.bids || a.tiebreak - b.tiebreak);

  const bidResults: Game0cBidResult[] = scored.map((s) => ({
    player: s.player,
    bids: s.bids,
  }));

  const orderedCandidates: Game0cForceCandidate[] = scored.map((s, idx) => ({
    player: s.player,
    order: idx + 1,
  }));

  const timerEnd = addMinutes(new Date(), 3);

  const event = await insertEvent(sessionId, round, 'BID_RESULT', {
    payload_public: { bid_results: bidResults, ordered_candidates: orderedCandidates },
    payload_private: { tiebreaks: scored.map((s) => ({ player: s.player, tiebreak: s.tiebreak })) },
    created_by: 'admin',
  });

  const updatedPublic = await savePublic(sessionId, {
    round,
    phase: 'FORCE',
    timer_end: timerEnd,
    bid_results: bidResults,
    force_candidates: orderedCandidates,
  });

  const updatedSnapshot = await saveSnapshot(sessionId, round, 'FORCE', snapshot.players);
  return { snapshot: updatedSnapshot, public: updatedPublic, event };
}

/** 강제접촉 종료(또는 1라운드 자유시간 시작) → OPEN phase */
export async function closeForce(sessionId: string, round: number): Promise<{
  snapshot: Game0cSnapshotRow;
  public: Game0cPublicRow;
  event: Game0cEventRow;
}> {
  await assertGame0cSession(sessionId);

  const snapshot = await loadSnapshot(sessionId);
  if (snapshot.round !== round) {
    throw new Game0cEngineError('라운드가 일치하지 않습니다', 400);
  }
  if (snapshot.phase !== 'FORCE' && snapshot.phase !== 'ROUND_OPEN') {
    throw new Game0cEngineError(`현재 phase(${snapshot.phase})에서는 자유시간을 시작할 수 없습니다`, 400);
  }

  const timerEnd = addMinutes(new Date(), 10);

  const event = await insertEvent(sessionId, round, 'ROUND_OPEN', {
    payload_public: { phase: 'OPEN' },
    created_by: 'admin',
  });

  const updatedPublic = await savePublic(sessionId, {
    round,
    phase: 'OPEN',
    timer_end: timerEnd,
  });

  const updatedSnapshot = await saveSnapshot(sessionId, round, 'OPEN', snapshot.players);
  return { snapshot: updatedSnapshot, public: updatedPublic, event };
}

/** 라운드 종료 → CLOSED phase */
export async function closeRound(sessionId: string, round: number): Promise<{
  snapshot: Game0cSnapshotRow;
  public: Game0cPublicRow;
}> {
  await assertGame0cSession(sessionId);

  const snapshot = await loadSnapshot(sessionId);
  if (snapshot.phase !== 'OPEN') {
    throw new Game0cEngineError('자유시간(OPEN) 단계가 아닙니다', 400);
  }
  if (snapshot.round !== round) {
    throw new Game0cEngineError('라운드가 일치하지 않습니다', 400);
  }

  await insertEvent(sessionId, round, 'ROUND_CLOSED', {
    payload_public: { phase: 'CLOSED' },
    created_by: 'admin',
  });

  const updatedPublic = await savePublic(sessionId, {
    round,
    phase: 'CLOSED',
    timer_end: null,
  });

  const updatedSnapshot = await saveSnapshot(sessionId, round, 'CLOSED', snapshot.players);
  return { snapshot: updatedSnapshot, public: updatedPublic };
}

/** 6라운드 종료 후 최종 승리 판정 (미확정) */
export async function getFinalResult(sessionId: string): Promise<Game0cFinalResult> {
  await assertGame0cSession(sessionId);

  const snapshot = await loadSnapshot(sessionId);
  const humans = snapshot.players.filter((p) => p.state === 'human');

  if (humans.length === 0) {
    return { result: 'no_winner' };
  }

  const topScore = Math.max(...humans.map((p) => p.score));
  const winners = humans.filter((p) => p.score === topScore).map((p) => p.num).sort((a, b) => a - b);

  if (winners.length >= 2) {
    return { result: 'co_winner', winners };
  }

  const winner = winners[0];
  const sortedAll = [...snapshot.players].sort((a, b) => a.score - b.score || a.num - b.num);
  const bottom3 = new Set(sortedAll.slice(0, 3).map((p) => p.num));
  const eligible = humans
    .filter((p) => p.num !== winner && !bottom3.has(p.num))
    .map((p) => p.num)
    .sort((a, b) => a - b);

  return { result: 'sole_winner', winner, eligible };
}

/** 최종 결과 확정 → FINISHED phase */
export async function finalizeGame(
  sessionId: string,
  nominatedPlayer?: number,
): Promise<{
  snapshot: Game0cSnapshotRow;
  public: Game0cPublicRow;
  event: Game0cEventRow;
  finalResult: Game0cFinalResult;
}> {
  await assertGame0cSession(sessionId);

  const snapshot = await loadSnapshot(sessionId);
  if (snapshot.round !== 6) {
    throw new Game0cEngineError('6라운드 종료 후에만 최종 결과를 확정할 수 있습니다', 400);
  }
  if (snapshot.phase !== 'CLOSED') {
    throw new Game0cEngineError('6라운드가 종료된 상태가 아닙니다', 400);
  }

  const finalResult = await getFinalResult(sessionId);

  let winners: number[] = [];
  let nominated: number | undefined;

  if (finalResult.result === 'co_winner') {
    winners = finalResult.winners;
  } else if (finalResult.result === 'sole_winner') {
    if (nominatedPlayer == null || !Number.isInteger(nominatedPlayer)) {
      throw new Game0cEngineError('지목 대상을 선택해주세요', 400);
    }
    if (!finalResult.eligible.includes(nominatedPlayer)) {
      throw new Game0cEngineError('지목할 수 없는 플레이어입니다', 400);
    }
    winners = [finalResult.winner, nominatedPlayer];
    nominated = nominatedPlayer;
  }

  const event = await insertEvent(sessionId, 6, 'GAME_FINALIZED', {
    payload_public: { phase: 'FINISHED' },
    payload_private: {
      result: finalResult.result,
      winners,
      nominated,
    },
    created_by: 'admin',
  });

  const updatedPublic = await savePublic(sessionId, {
    round: 6,
    phase: 'FINISHED',
    timer_end: null,
  });

  const updatedSnapshot = await saveSnapshot(sessionId, 6, 'FINISHED', snapshot.players);
  return { snapshot: updatedSnapshot, public: updatedPublic, event, finalResult };
}

/** 부스 화면용 상태 (점수·플레이어 상태 미포함) */
export async function getBoothState(sessionId: string): Promise<Game0cBoothState> {
  await assertGame0cSession(sessionId);

  const snapshot = await loadSnapshot(sessionId);
  const publicRow = await loadPublic(sessionId);

  return {
    phase: snapshot.phase,
    round: snapshot.round,
    pending: snapshot.pending,
    force_candidates: parseForceCandidates(publicRow?.force_candidates),
    player_numbers: snapshot.players.map((p) => p.num),
  };
}

/** 일반접촉 1차 태그 대기 상태 저장 */
export async function setPendingContact(
  sessionId: string,
  playerNumber: number,
): Promise<Game0cSnapshotRow> {
  await assertGame0cSession(sessionId);

  const snapshot = await loadSnapshot(sessionId);
  findPlayer(snapshot.players, playerNumber);

  const pending: Game0cPendingContact = {
    type: 'normal_contact',
    player_a: playerNumber,
    at: new Date().toISOString(),
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('game_0c_snapshot')
    .update({ pending })
    .eq('session_id', sessionId.trim())
    .select('*')
    .single();

  if (error) {
    console.error('game_0c_snapshot pending 저장:', error);
    throw new Game0cEngineError(error.message, 500);
  }

  return mapSnapshotRow(data);
}

/** 부스 대기 상태 초기화 */
export async function clearPending(sessionId: string): Promise<Game0cSnapshotRow> {
  await assertGame0cSession(sessionId);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('game_0c_snapshot')
    .update({ pending: null })
    .eq('session_id', sessionId.trim())
    .select('*')
    .single();

  if (error) {
    console.error('game_0c_snapshot pending 초기화:', error);
    throw new Game0cEngineError(error.message, 500);
  }

  if (!data) {
    throw new Game0cEngineError('스냅샷 없음', 404);
  }

  return mapSnapshotRow(data);
}

/** control 게임 종료 → status 완료 (game_0b advance-phase finish와 동일 개념) */
export async function finishGame(sessionId: string): Promise<Game0cSnapshotRow> {
  await assertGame0cSession(sessionId);
  await loadSnapshot(sessionId);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('game_0c_snapshot')
    .update({ status: '완료' })
    .eq('session_id', sessionId.trim())
    .select('*')
    .single();

  if (error) {
    console.error('game_0c_snapshot finish:', error);
    throw new Game0cEngineError(error.message, 500);
  }

  return mapSnapshotRow(data);
}

/** control 게임 초기화 → 스냅샷·이벤트 삭제 (game_0b reset와 동일 개념) */
export async function resetGame(sessionId: string): Promise<void> {
  await assertGame0cSession(sessionId);

  const supabase = getSupabaseAdmin();
  const sid = sessionId.trim();

  const { data: snapshot } = await supabase
    .from('game_0c_snapshot')
    .select('session_id')
    .eq('session_id', sid)
    .maybeSingle();

  if (!snapshot) {
    throw new Game0cEngineError('게임 없음', 404);
  }

  await supabase
    .from('game_participants')
    .update({ status: 'completed' })
    .eq('game_id', sid)
    .eq('status', 'active');

  await supabase.from('game_0c_event').delete().eq('session_id', sid);
  await supabase.from('game_0c_public').delete().eq('session_id', sid);
  await supabase.from('game_0c_snapshot').delete().eq('session_id', sid);
}
