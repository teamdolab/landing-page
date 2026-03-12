/** 등수별 크레딧 (플레이어 수 × 순위) - 이미지 기준 */
export const REWARD_TABLE: Record<number, Record<number, number>> = {
  8: { 1: 10000, 2: 10000, 3: 5000, 4: 3000 },
  9: { 1: 10000, 2: 10000, 3: 5000, 4: 3000, 5: 3000 },
  10: { 1: 10000, 2: 10000, 3: 5000, 4: 5000, 5: 3000 },
  11: { 1: 10000, 2: 10000, 3: 5000, 4: 5000, 5: 3000, 6: 3000 },
  12: { 1: 10000, 2: 10000, 3: 5000, 4: 5000, 5: 3000, 6: 3000, 7: 3000 },
};

/** 동점자: 해당 등수들 상금 합산 ÷ N, 천원 단위 반올림 */
export function getCreditReward(
  playerCount: number,
  rankedPlayers: Array<{ player_number: number; total_score: number }>,
  finalWinners: number[] | null
): Map<number, number> {
  const result = new Map<number, number>();
  const table = REWARD_TABLE[playerCount] ?? REWARD_TABLE[8];

  let nextRank = 1;
  const winners =
    finalWinners && finalWinners.length > 0
      ? finalWinners
      : rankedPlayers.slice(0, 1).map((p) => p.player_number);

  const winnerCredits = winners.map((_, i) => table[nextRank + i] ?? 0).reduce((a, b) => a + b, 0);
  const perWinner = Math.round(winnerCredits / winners.length / 1000) * 1000;
  winners.forEach((pn) => result.set(pn, perWinner));
  nextRank += winners.length;

  const remaining = rankedPlayers.filter((p) => !winners.includes(p.player_number));
  let i = 0;
  while (i < remaining.length) {
    const score = remaining[i].total_score;
    const group: number[] = [];
    while (i < remaining.length && remaining[i].total_score === score) {
      group.push(remaining[i].player_number);
      i++;
    }
    let sum = 0;
    for (let r = 0; r < group.length; r++) sum += table[nextRank + r] ?? 0;
    const perPerson = Math.round(sum / group.length / 1000) * 1000;
    group.forEach((pn) => result.set(pn, perPerson));
    nextRank += group.length;
  }

  return result;
}
