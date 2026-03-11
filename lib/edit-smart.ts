/**
 * 스마트 Edit: 편집 시 연관 필드(current_player, step 등) 자동 조정
 */

export type GameState = {
  player_count: number;
  current_round: number;
  current_step: number;
  current_player: number | null;
  first_player_number?: number | null;
  declaration_results?: Record<string, boolean> | null;
  candidate_revealed_cards?: Record<string, string[]> | null;
  votes?: Record<string, Array<{ voter: number; voted_for: number | null }>> | null;
  round_winners?: Record<string, number[]> | null;
  round_scores?: Record<string, number[]> | null;
  info_text?: string | null;
  [key: string]: unknown;
};

function getDeclarationOrder(state: GameState): number[] {
  const n = state.player_count || 8;
  const first = state.first_player_number ?? 1;
  return Array.from({ length: n }, (_, i) => ((first - 1 + i) % n) + 1);
}

function getCandidates(state: GameState): number[] {
  const decl = state.declaration_results || {};
  return getDeclarationOrder(state).filter((num) => decl[String(num)] === true);
}

function getVoters(state: GameState): number[] {
  const decl = state.declaration_results || {};
  return getDeclarationOrder(state).filter((num) => decl[String(num)] === false);
}

/** remove_candidate: 후보 제거 + current_player/step 조정 */
export function applyRemoveCandidate(
  state: GameState,
  playerNumber: number
): Partial<GameState> {
  const decl = { ...(state.declaration_results || {}) };
  delete decl[String(playerNumber)];

  const revealed = { ...(state.candidate_revealed_cards || {}) };
  delete revealed[String(playerNumber)];

  const origCandidates = getCandidates(state);
  const candidates = origCandidates.filter((n) => n !== playerNumber);
  const wasCurrent = state.current_player === playerNumber;

  let current_player = state.current_player;
  let current_step = state.current_step;
  let info_text = state.info_text;

  if (wasCurrent) {
    const idx = origCandidates.indexOf(playerNumber);
    const prev = idx > 0 ? origCandidates[idx - 1] : origCandidates[origCandidates.length - 1];
    const hasPrev = prev !== undefined && prev !== playerNumber && candidates.includes(prev);
    if (state.current_step === 4) {
      if (hasPrev) {
        current_player = prev;
        info_text = '후보 출마 선언 중';
      } else {
        current_player = null;
        current_step = 3;
        info_text = '전략회의 I을 시작하세요';
      }
    } else if (state.current_step === 5) {
      if (hasPrev) {
        current_player = prev;
        info_text = `후보 ${prev}번 연설 중`;
      } else {
        current_player = null;
        current_step = 4;
        info_text = '후보 출마 선언 중';
      }
    }
  } else {
    // current_player가 유효한 후보인지 확인
    if (state.current_step === 4 || state.current_step === 5) {
      if (current_player !== null && !candidates.includes(current_player)) {
        const next = candidates[0];
        current_player = next ?? null;
        if (next) info_text = state.current_step === 4 ? '후보 출마 선언 중' : `후보 ${next}번 연설 중`;
        else {
          current_step = state.current_step === 4 ? 3 : 4;
          info_text = current_step === 3 ? '전략회의 I을 시작하세요' : '후보 출마 선언 중';
        }
      }
    }
  }

  return {
    declaration_results: decl,
    candidate_revealed_cards: revealed,
    current_player,
    current_step,
    info_text,
  };
}

/** remove_revealed_card: 후보 공개 카드 1장 제거 */
export function applyRemoveRevealedCard(
  state: GameState,
  playerNumber: number,
  card: string
): Partial<GameState> {
  const revealed = { ...(state.candidate_revealed_cards || {}) };
  const arr = [...(revealed[String(playerNumber)] || [])];
  const idx = arr.indexOf(card);
  if (idx >= 0) arr.splice(idx, 1);
  revealed[String(playerNumber)] = arr;
  return { candidate_revealed_cards: revealed };
}

/** remove_vote: 투표 1건 제거 + current_player 조정 */
export function applyRemoveVote(
  state: GameState,
  round: number,
  voter: number
): Partial<GameState> {
  const roundKey = String(round);
  const votes = { ...(state.votes || {}) };
  const roundVotes = [...(votes[roundKey] || [])].filter((v) => v.voter !== voter);
  votes[roundKey] = roundVotes;

  const wasCurrent = state.current_player === voter;
  const voters = getVoters(state);
  const remaining = voters.filter((v) => v !== voter);

  let current_player = state.current_player;
  let info_text = state.info_text;

  if (wasCurrent && state.current_step === 8) {
    const prev = remaining.filter((n) => n < voter).pop() ?? remaining[remaining.length - 1];
    if (prev !== undefined) {
      current_player = prev;
      info_text = '유권자 투표 중';
    } else {
      current_player = null;
      info_text = '전략회의 II를 시작하세요';
    }
  } else if (current_player !== null && !remaining.includes(current_player)) {
    const next = remaining[0];
    current_player = next ?? null;
    info_text = next ? '유권자 투표 중' : '전략회의 II를 시작하세요';
  }

  return { votes, current_player, info_text };
}

/** update_vote: 투표 변경 */
export function applyUpdateVote(
  state: GameState,
  round: number,
  voter: number,
  votedFor: number | null
): Partial<GameState> {
  const roundKey = String(round);
  const votes = { ...(state.votes || {}) };
  const roundVotes = [...(votes[roundKey] || [])];
  const idx = roundVotes.findIndex((v) => v.voter === voter);
  const entry = { voter, voted_for: votedFor };
  if (idx >= 0) roundVotes[idx] = entry;
  else roundVotes.push(entry);
  votes[roundKey] = roundVotes;
  return { votes };
}

/** update_score: 라운드 점수 변경 → total_score 재계산 */
export function applyUpdateScore(
  state: GameState,
  playerNumber: number,
  roundIndex: number,
  score: number
): Partial<GameState> {
  const rScores = { ...(state.round_scores || {}) };
  const arr = [...(rScores[String(playerNumber)] || [0, 0, 0, 0])];
  while (arr.length <= roundIndex) arr.push(0);
  arr[roundIndex] = score;
  rScores[String(playerNumber)] = arr;
  return { round_scores: rScores };
}

/** set_round_winners: 라운드 승자 설정 */
export function applySetRoundWinners(
  state: GameState,
  round: number,
  winners: number[]
): Partial<GameState> {
  const rw = { ...(state.round_winners || {}) };
  rw[String(round)] = winners;
  return { round_winners: rw };
}

/** set_first_player */
export function applySetFirstPlayer(
  state: GameState,
  playerNumber: number
): Partial<GameState> {
  return { first_player_number: playerNumber };
}

/** set_current_player */
export function applySetCurrentPlayer(
  _state: GameState,
  playerNumber: number | null
): Partial<GameState> {
  return { current_player: playerNumber };
}

/** update_info_text */
export function applyUpdateInfoText(
  _state: GameState,
  text: string
): Partial<GameState> {
  return { info_text: text };
}

/** update_step */
export function applyUpdateStep(
  _state: GameState,
  step: number
): Partial<GameState> {
  return { current_step: step };
}

/** update_round */
export function applyUpdateRound(
  _state: GameState,
  round: number
): Partial<GameState> {
  return { current_round: round };
}

export type EditOp =
  | { type: 'remove_candidate'; player_number: number }
  | { type: 'remove_revealed_card'; player_number: number; card: string }
  | { type: 'remove_vote'; round: number; voter: number }
  | { type: 'update_vote'; round: number; voter: number; voted_for: number | null }
  | { type: 'update_score'; player_number: number; round_index: number; score: number }
  | { type: 'set_round_winners'; round: number; winners: number[] }
  | { type: 'set_first_player'; player_number: number }
  | { type: 'set_current_player'; player_number: number | null }
  | { type: 'update_info_text'; text: string }
  | { type: 'update_step'; step: number }
  | { type: 'update_round'; round: number };

export function applyEditOp(state: GameState, op: EditOp): Partial<GameState> {
  switch (op.type) {
    case 'remove_candidate':
      return applyRemoveCandidate(state, op.player_number);
    case 'remove_revealed_card':
      return applyRemoveRevealedCard(state, op.player_number, op.card);
    case 'remove_vote':
      return applyRemoveVote(state, op.round, op.voter);
    case 'update_vote':
      return applyUpdateVote(state, op.round, op.voter, op.voted_for);
    case 'update_score':
      return applyUpdateScore(state, op.player_number, op.round_index, op.score);
    case 'set_round_winners':
      return applySetRoundWinners(state, op.round, op.winners);
    case 'set_first_player':
      return applySetFirstPlayer(state, op.player_number);
    case 'set_current_player':
      return applySetCurrentPlayer(state, op.player_number);
    case 'update_info_text':
      return applyUpdateInfoText(state, op.text);
    case 'update_step':
      return applyUpdateStep(state, op.step);
    case 'update_round':
      return applyUpdateRound(state, op.round);
    default:
      return {};
  }
}
