/** 좀비게임(game_0c) 타입 정의 */

export type Game0cPlayerState = 'human' | 'doctor' | 'zombie';

export type Game0cPhase = 'WAITING' | 'ROUND_OPEN' | 'BIDDING' | 'FORCE' | 'OPEN' | 'CLOSED';

export type Game0cContactType = 'normal' | 'force';

export type Game0cVariationChoice = 'doctor' | 'zombie';

export type Game0cPlayer = {
  num: number;
  state: Game0cPlayerState;
  score: number;
  slots_left: number;
};

export type Game0cForcePair = {
  round: number;
  pair: [number, number];
  at: string;
};

export type Game0cContactResult = {
  state_changes: Record<string, Game0cPlayerState>;
  score_deltas: Record<string, number>;
};

export type Game0cSnapshotRow = {
  session_id: string;
  round: number | null;
  phase: Game0cPhase | null;
  players: Game0cPlayer[];
  updated_at: string;
};

export type Game0cPublicRow = {
  session_id: string;
  round: number | null;
  phase: Game0cPhase | null;
  timer_end: string | null;
  force_candidates: unknown[];
  bid_results: unknown[];
  force_pairs: Game0cForcePair[];
  updated_at: string;
};

export type Game0cEventRow = {
  id: number;
  session_id: string;
  round: number;
  event_type: string;
  actor_player: number | null;
  target_player: number | null;
  payload_public: Record<string, unknown>;
  payload_private: Record<string, unknown>;
  is_reverted: boolean;
  reverted_by: number | null;
  created_by: 'booth' | 'admin' | null;
  created_at: string;
};
