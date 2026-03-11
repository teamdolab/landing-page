/**
 * game_0a DB row <-> API 응답 형식 변환
 * 새 칼럼 구조와 기존 players/votes 형식 호환
 */

export type GamePlayer = {
  player_number: number;
  is_first: boolean;
  is_candidate: boolean;
  revealed_cards: string[];
  total_score: number;
  round_scores: number[];
};

export type GameRow = {
  game_id: string;
  session_id: string;
  player_count: number;
  current_round: number;
  current_step: number;
  status: string;
  info_text: string | null;
  timer_seconds: number;
  timer_active: boolean;
  timer_end?: boolean;
  current_player: number | null;
  players?: GamePlayer[] | null;
  votes?: Record<string, Array<{ voter: number; voted_for: number | null }>> | null;
  round_winners?: Record<string, number[]> | null;
  final_winners?: number[] | null;
  // 새 칼럼
  first_player_number?: number | null;
  dealing_completed?: boolean | null;
  declaration_results?: Record<string, boolean> | null;
  candidate_revealed_cards?: Record<string, string[]> | null;
  round_scores?: Record<string, number[]> | null;
  [key: string]: unknown;
};

/** DB row → API 응답 (프론트엔드 형식) */
export function dbRowToApi(row: GameRow): GameRow {
  const count = row.player_count || 8;
  const useNewColumns =
    row.first_player_number !== undefined ||
    row.declaration_results !== undefined ||
    (row.candidate_revealed_cards && Object.keys(row.candidate_revealed_cards).length > 0) ||
    (row.round_scores && Object.keys(row.round_scores).length > 0);

  if (!useNewColumns && row.players && Array.isArray(row.players) && row.players.length > 0) {
    return { ...row, players: row.players, votes: row.votes || {} };
  }

  const first = row.first_player_number ?? null;
  const decl = (row.declaration_results as Record<string, boolean>) || {};
  const revealed = (row.candidate_revealed_cards as Record<string, string[]>) || {};
  const rScores = (row.round_scores as Record<string, number[]>) || {};

  const players: GamePlayer[] = Array.from({ length: count }, (_, i) => {
    const num = i + 1;
    return {
      player_number: num,
      is_first: first === num,
      is_candidate: decl[String(num)] ?? false,
      revealed_cards: revealed[String(num)] ?? [],
      total_score: (rScores[String(num)] ?? [0, 0, 0, 0]).reduce((a, b) => a + b, 0),
      round_scores: rScores[String(num)] ?? [0, 0, 0, 0],
    };
  });

  return {
    ...row,
    players,
    votes: row.votes || {},
    round_winners: row.round_winners || {},
    final_winners: row.final_winners ?? null,
  };
}

/** API 업데이트 body → DB 업데이트 객체 (새 칼럼 + 기존 호환) */
export function apiUpdateToDb(body: Record<string, unknown>): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (body.current_step !== undefined) updates.current_step = body.current_step;
  if (body.current_round !== undefined) updates.current_round = body.current_round;
  if (body.info_text !== undefined) updates.info_text = body.info_text;
  if (body.timer_seconds !== undefined) updates.timer_seconds = body.timer_seconds;
  if (body.timer_active !== undefined) updates.timer_active = body.timer_active;
  if (body.timer_end !== undefined) updates.timer_end = body.timer_end;
  if (body.current_player !== undefined) updates.current_player = body.current_player;
  if (body.votes !== undefined) updates.votes = body.votes;
  if (body.round_winners !== undefined) updates.round_winners = body.round_winners;
  if (body.final_winners !== undefined) updates.final_winners = body.final_winners;
  if (body.status !== undefined) updates.status = body.status;

  const players = body.players as GamePlayer[] | undefined;
  if (players && Array.isArray(players)) {
    const first = players.find((p) => p.is_first);
    if (first) updates.first_player_number = first.player_number;
    const decl: Record<string, boolean> = {};
    const revealed: Record<string, string[]> = {};
    const rScores: Record<string, number[]> = {};
    for (const p of players) {
      decl[String(p.player_number)] = p.is_candidate;
      revealed[String(p.player_number)] = p.revealed_cards || [];
      rScores[String(p.player_number)] = p.round_scores || [0, 0, 0, 0];
    }
    updates.declaration_results = decl;
    updates.candidate_revealed_cards = revealed;
    updates.round_scores = rScores;
    updates.players = players;
  }

  if (body.first_player_number !== undefined) updates.first_player_number = body.first_player_number;
  if (body.dealing_completed !== undefined) updates.dealing_completed = body.dealing_completed;
  if (body.declaration_results !== undefined) updates.declaration_results = body.declaration_results;
  if (body.candidate_revealed_cards !== undefined)
    updates.candidate_revealed_cards = body.candidate_revealed_cards;
  if (body.round_scores !== undefined) updates.round_scores = body.round_scores;

  return updates;
}
