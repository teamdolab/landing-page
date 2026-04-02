/** game_0b / game_0b_event — DB 행 타입 (스냅샷 + 이벤트) */

export type Game0bPhase = 'setup' | 'role_reveal' | 'day' | 'night' | 'morning';
export type Game0bStatus = '대기중' | '진행중' | '완료';
export type Game0bEventSource = 'host' | 'testroom' | 'system';

export type Game0bRow = {
  game_id: string;
  session_id: string;
  status: Game0bStatus;
  player_count: number;
  current_round: number;
  phase: Game0bPhase;
  first_player_number: number | null;
  phase_deadline_at: string | null;
  ship_hull: number;
  night_action_count: number;
  detected_actions: unknown[];
  commander_player_number: number | null;
  revolutionary_player_number: number | null;
  former_commander_player_number: number | null;
  info_text: string | null;
  last_public_transfer_from: number | null;
  last_public_transfer_at: string | null;
  public_transfer_log: number[];
  result_locked: boolean;
  lifeboat_seat_1: number | null;
  lifeboat_seat_2: number | null;
  lifeboat_seat_3: number | null;
  lifeboat_seat_4: number | null;
  lifeboat_seat_5: number | null;
  player_01_role: string | null;
  player_01_core: number;
  player_02_role: string | null;
  player_02_core: number;
  player_03_role: string | null;
  player_03_core: number;
  player_04_role: string | null;
  player_04_core: number;
  player_05_role: string | null;
  player_05_core: number;
  player_06_role: string | null;
  player_06_core: number;
  player_07_role: string | null;
  player_07_core: number;
  player_08_role: string | null;
  player_08_core: number;
  player_09_role: string | null;
  player_09_core: number;
  player_10_role: string | null;
  player_10_core: number;
  player_11_role: string | null;
  player_11_core: number;
  player_12_role: string | null;
  player_12_core: number;
  created_at: string;
  updated_at: string;
};

export type Game0bEventRow = {
  id: number;
  game_id: string;
  seq: number;
  event_type: string;
  source: Game0bEventSource;
  actor_player_number: number | null;
  event_data: Record<string, unknown>;
  voided_at: string | null;
  superseded_by: number | null;
  created_at: string;
};

const PLAYER_KEYS = [
  'player_01', 'player_02', 'player_03', 'player_04',
  'player_05', 'player_06', 'player_07', 'player_08',
  'player_09', 'player_10', 'player_11', 'player_12',
] as const;

export function getPlayerRoleCore(row: Game0bRow, playerNumber: number): { role: string | null; core: number } {
  if (playerNumber < 1 || playerNumber > 12) return { role: null, core: 0 };
  const prefix = PLAYER_KEYS[playerNumber - 1];
  const role = row[`${prefix}_role` as keyof Game0bRow] as string | null;
  const core = row[`${prefix}_core` as keyof Game0bRow] as number;
  return { role, core };
}

export function playerCoreKey(num: number): string {
  return `player_${String(num).padStart(2, '0')}_core`;
}

export function playerRoleKey(num: number): string {
  return `player_${String(num).padStart(2, '0')}_role`;
}

/** 인원 별 역할 분배 (사령관/생존자/반군수장/반군/외계인) */
export const ROLE_DISTRIBUTION: Record<number, string[]> = {
  8:  ['사령관', '생존자', '생존자', '반군수장', '반군', '반군', '외계인', '외계인'],
  9:  ['사령관', '생존자', '생존자', '생존자', '반군수장', '반군', '반군', '외계인', '외계인'],
  10: ['사령관', '생존자', '생존자', '생존자', '반군수장', '반군', '반군', '반군', '외계인', '외계인'],
  11: ['사령관', '생존자', '생존자', '생존자', '생존자', '반군수장', '반군', '반군', '반군', '외계인', '외계인'],
  12: ['사령관', '생존자', '생존자', '생존자', '생존자', '반군수장', '반군', '반군', '반군', '반군', '외계인', '외계인'],
};
