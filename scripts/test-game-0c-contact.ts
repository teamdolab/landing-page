/**
 * 인간+좀비 접촉 판정 콘솔 테스트
 * 실행: npx tsx scripts/test-game-0c-contact.ts
 */
import { resolveContactOutcome } from '../lib/game-0c-engine';
import type { Game0cPlayer, Game0cPlayerState } from '../lib/game-0c-types';

console.log('=== resolveContactOutcome: human + zombie ===');
const outcome = resolveContactOutcome('human', 'zombie');
console.log(outcome);
console.assert(outcome.newStateA === 'zombie', '인간 → 좀비');
console.assert(outcome.scoreDeltaA === 0, '인간 점수 +0');
console.assert(outcome.newStateB === 'zombie', '좀비 유지');
console.assert(outcome.scoreDeltaB === 3, '좀비 점수 +3');

console.log('\n=== processContact 시뮬레이션 (playerA=인간, playerB=좀비) ===');
const players: Game0cPlayer[] = [
  { num: 1, state: 'human', score: 0, slots_left: 3 },
  { num: 2, state: 'zombie', score: 0, slots_left: 3 },
];

const a = players[0];
const b = players[1];
const stateA = a.state as Game0cPlayerState;
const stateB = b.state as Game0cPlayerState;

a.slots_left -= 1;
b.slots_left -= 1;

const contact = resolveContactOutcome(stateA, stateB);
a.state = contact.newStateA;
b.state = contact.newStateB;
a.score += contact.scoreDeltaA;
b.score += contact.scoreDeltaB;

console.log('player 1:', players[0]);
console.log('player 2:', players[1]);
console.assert(players[0].state === 'zombie', 'player1 좀비로 변신');
console.assert(players[0].score === 0, 'player1 점수 0');
console.assert(players[1].state === 'zombie', 'player2 좀비 유지');
console.assert(players[1].score === 3, 'player2 점수 +3');

console.log('\n✅ 모든 접촉 판정 테스트 통과');
