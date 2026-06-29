import {
  clampShipHull,
  getPlayerRoleCore,
  type Game0bRow,
} from './game-0b-types';
import { lifeboatSeatsFromRow, REBEL_ROLES } from './game-0b-result';

export type Game0bCreditRow = {
  player_number: number;
  credit_delta: number;
  rank: number | null;
};

function calcPool(sessionPrice: number, playerCount: number): number {
  return Math.round((sessionPrice * playerCount * 0.1) / 1000) * 1000;
}

function splitPool(pool: number, count: number): number {
  if (count <= 0) return 0;
  return Math.round(pool / count / 1000) * 1000;
}

function zeroCredits(playerCount: number): Game0bCreditRow[] {
  return Array.from({ length: playerCount }, (_, i) => ({
    player_number: i + 1,
    credit_delta: 0,
    rank: null,
  }));
}

function applyWinners(
  playerCount: number,
  winners: number[],
  creditDelta: number,
  rank: number,
): Game0bCreditRow[] {
  const winnerSet = new Set(winners);
  return Array.from({ length: playerCount }, (_, i) => {
    const playerNumber = i + 1;
    if (winnerSet.has(playerNumber)) {
      return { player_number: playerNumber, credit_delta: creditDelta, rank };
    }
    return { player_number: playerNumber, credit_delta: 0, rank: null };
  });
}

export function calcGame0bCredits(params: {
  game: Game0bRow;
  sessionPrice: number;
}): Game0bCreditRow[] {
  const { game, sessionPrice } = params;
  const pc = game.player_count;
  const pool = calcPool(sessionPrice, pc);
  const hull = clampShipHull(game.ship_hull);

  // 케이스 1 — hull ≤ 50 (외계인 승)
  if (hull <= 50) {
    const aliens: number[] = [];
    for (let i = 1; i <= pc; i++) {
      if (getPlayerRoleCore(game, i).role === '외계인') aliens.push(i);
    }
    if (aliens.length === 0) return zeroCredits(pc);
    const delta = splitPool(pool, aliens.length);
    return applyWinners(pc, aliens, delta, 1);
  }

  // 케이스 2 — hull > 50 + 혁명 (반군 승)
  if (game.revolutionary_player_number != null) {
    const rebels: number[] = [];
    for (let i = 1; i <= pc; i++) {
      const { role } = getPlayerRoleCore(game, i);
      if (role && REBEL_ROLES.has(role)) rebels.push(i);
    }
    if (rebels.length === 0) return zeroCredits(pc);
    const delta = splitPool(pool, rebels.length);
    return applyWinners(pc, rebels, delta, 1);
  }

  const seats = lifeboatSeatsFromRow(game);
  const seatRoles = seats.map((s) => ({ num: s, role: getPlayerRoleCore(game, s).role }));

  // 케이스 3 — 외계인 침투 승
  const boardingAliens = seatRoles.filter((s) => s.role === '외계인').map((s) => s.num);
  if (boardingAliens.length > 0) {
    const delta = splitPool(pool, boardingAliens.length);
    return applyWinners(pc, boardingAliens, delta, 1);
  }

  // 케이스 4 — 반군 침투
  const boardingRebels = seatRoles.filter((s) => s.role && REBEL_ROLES.has(s.role)).map((s) => s.num);
  if (boardingRebels.length > 0) {
    const firstGroup = boardingRebels;
    const secondGroup = seats.filter((s) => !firstGroup.includes(s));
    if (secondGroup.length === 0) {
      const delta = splitPool(pool, firstGroup.length);
      return applyWinners(pc, firstGroup, delta, 1);
    }
    const firstDelta = Math.round((pool * 0.6) / firstGroup.length / 1000) * 1000;
    const secondDelta = Math.round((pool * 0.4) / secondGroup.length / 1000) * 1000;
    const firstSet = new Set(firstGroup);
    const secondSet = new Set(secondGroup);
    return Array.from({ length: pc }, (_, i) => {
      const playerNumber = i + 1;
      if (firstSet.has(playerNumber)) {
        return { player_number: playerNumber, credit_delta: firstDelta, rank: 1 };
      }
      if (secondSet.has(playerNumber)) {
        return { player_number: playerNumber, credit_delta: secondDelta, rank: 2 };
      }
      return { player_number: playerNumber, credit_delta: 0, rank: null };
    });
  }

  // 케이스 5 — 생존자 단독 승
  if (seats.length === 0) return zeroCredits(pc);
  const delta = splitPool(pool, seats.length);
  return applyWinners(pc, seats, delta, 1);
}
