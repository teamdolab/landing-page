import type { Game0bRow } from './game-0b-types';
import { getPlayerRoleCore } from './game-0b-types';

const REBEL_ROLES = new Set(['반군수장', '반군', '혁명가']);
const SURVIVOR_ROLES = new Set(['사령관', '생존자']);

/** 탑승 인원 수: 혁명 성공 시 반군 계열 인원, 아니면 생존자 진영 인원 */
export function countLifeboatSlots(game: Game0bRow): number {
  const pc = game.player_count;
  let n = 0;
  const useRebel = game.revolutionary_player_number != null;
  for (let i = 1; i <= pc; i++) {
    const { role } = getPlayerRoleCore(game, i);
    if (!role) continue;
    if (useRebel && REBEL_ROLES.has(role)) n++;
    if (!useRebel && SURVIVOR_ROLES.has(role)) n++;
  }
  return n;
}

/** 게이지 공개 직후 송출용 한 줄 (hull ≤ 50이면 곧 최종 외계인 승리 문구) */
export function preliminaryGaugeLine(game: Game0bRow): string {
  const hull = game.ship_hull;
  if (hull <= 50) {
    return `수송선 게이지: ${hull}% · 외계인 진영이 승리하였습니다`;
  }
  const faction = game.revolutionary_player_number != null ? '혁명가(반군) 진영' : '생존자 진영';
  return `수송선 게이지: ${hull}% · ${faction}이 승리하였습니다`;
}

export function validateLifeboatSeats(game: Game0bRow, seats: number[]): string | null {
  const pc = game.player_count;
  const need = countLifeboatSlots(game);
  if (seats.length !== need) {
    return `탑승 인원은 ${need}명이어야 합니다 (현재 ${seats.length}명)`;
  }
  const uniq = new Set(seats);
  if (uniq.size !== seats.length) return '중복된 플레이어 번호가 있습니다';
  for (const s of seats) {
    if (!Number.isInteger(s) || s < 1 || s > pc) return `유효하지 않은 번호: ${s}`;
  }
  const useRebel = game.revolutionary_player_number != null;
  for (const s of seats) {
    const { role } = getPlayerRoleCore(game, s);
    if (!role) return `${s}번 역할 정보 없음`;
    if (useRebel && !REBEL_ROLES.has(role)) {
      return `${s}번은 반군 진영이 아닙니다`;
    }
    if (!useRebel && !SURVIVOR_ROLES.has(role)) {
      return `${s}번은 생존자 진영이 아닙니다`;
    }
  }
  return null;
}

/** 탑승 확정 후 최종 안내 문구 */
export function finalOutcomeInfoText(game: Game0bRow, seats: number[]): string {
  const roles = seats.map((s) => getPlayerRoleCore(game, s).role);
  const hasAlien = roles.some((r) => r === '외계인');
  const hasRebel = roles.some((r) => r != null && REBEL_ROLES.has(r));

  if (hasAlien) {
    return `최종: 외계인 진영 단독 승리 · 수송선 게이지 ${game.ship_hull}%`;
  }
  if (hasRebel) {
    return `최종: 반군 진영 1등 · 생존자 진영 2등 · 수송선 게이지 ${game.ship_hull}%`;
  }
  return `최종: 생존자 진영 단독 승리 · 수송선 게이지 ${game.ship_hull}%`;
}

export function lifeboatSeatsFromRow(game: Game0bRow): number[] {
  const out: number[] = [];
  for (let k = 1; k <= 5; k++) {
    const v = game[`lifeboat_seat_${k}` as keyof Game0bRow] as number | null;
    if (v != null) out.push(v);
  }
  return out;
}

export { REBEL_ROLES, SURVIVOR_ROLES };
