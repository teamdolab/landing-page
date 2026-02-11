// 대선포커 유틸리티 함수

// 카드 타입 정의
type Card = string; // 'S2', 'D10', 'H5' 등

// 족보 순위 (높을수록 강함)
const HAND_RANKS = {
  'STRAIGHT_FLUSH': 9,
  'FOUR_OF_KIND': 8,
  'FLUSH': 7,  // 대선포커 룰: 플러쉬 > 풀하우스
  'FULL_HOUSE': 6,
  'STRAIGHT': 5,
  'THREE_OF_KIND': 4,
  'TWO_PAIR': 3,
  'ONE_PAIR': 2,
  'HIGH_CARD': 1,
};

// 카드 파싱
function parseCard(card: Card): { suit: string; rank: number } {
  const suit = card[0]; // S, D, H, C
  const rankStr = card.slice(1); // '2', '10' 등
  const rank = parseInt(rankStr);
  return { suit, rank };
}

// 7장 카드에서 최고 족보 찾기
export function getBestHand(handCards: Card[], communityCards: Card[]): {
  rank: string;
  score: number;
  description: string;
} {
  const allCards = [...handCards, ...communityCards];
  
  // 모든 5장 조합 생성 (C(7,5) = 21가지)
  const combinations = getCombinations(allCards, 5);
  
  let bestHand = { rank: 'HIGH_CARD', score: 1, description: '하이카드' };
  
  for (const combo of combinations) {
    const hand = evaluateHand(combo);
    if (hand.score > bestHand.score) {
      bestHand = hand;
    }
  }
  
  return bestHand;
}

// 5장 조합에서 족보 판정
function evaluateHand(cards: Card[]): {
  rank: string;
  score: number;
  description: string;
} {
  const parsed = cards.map(parseCard);
  const suits = parsed.map(c => c.suit);
  const ranks = parsed.map(c => c.rank).sort((a, b) => a - b);
  
  // 카운트
  const rankCounts = new Map<number, number>();
  ranks.forEach(r => rankCounts.set(r, (rankCounts.get(r) || 0) + 1));
  const counts = Array.from(rankCounts.values()).sort((a, b) => b - a);
  
  // 플러쉬 체크
  const isFlush = suits.every(s => s === suits[0]);
  
  // 스트레이트 체크
  const isStraight = ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1);
  
  // 족보 판정 (대선포커 룰: 플러쉬 > 풀하우스)
  if (isStraight && isFlush) {
    return { rank: 'STRAIGHT_FLUSH', score: HAND_RANKS.STRAIGHT_FLUSH, description: '스트레이트 플러쉬' };
  }
  if (counts[0] === 4) {
    return { rank: 'FOUR_OF_KIND', score: HAND_RANKS.FOUR_OF_KIND, description: '포카드' };
  }
  if (isFlush) {
    return { rank: 'FLUSH', score: HAND_RANKS.FLUSH, description: '플러쉬' };
  }
  if (counts[0] === 3 && counts[1] === 2) {
    return { rank: 'FULL_HOUSE', score: HAND_RANKS.FULL_HOUSE, description: '풀하우스' };
  }
  if (isStraight) {
    return { rank: 'STRAIGHT', score: HAND_RANKS.STRAIGHT, description: '스트레이트' };
  }
  if (counts[0] === 3) {
    return { rank: 'THREE_OF_KIND', score: HAND_RANKS.THREE_OF_KIND, description: '트리플' };
  }
  if (counts[0] === 2 && counts[1] === 2) {
    return { rank: 'TWO_PAIR', score: HAND_RANKS.TWO_PAIR, description: '투페어' };
  }
  if (counts[0] === 2) {
    return { rank: 'ONE_PAIR', score: HAND_RANKS.ONE_PAIR, description: '원페어' };
  }
  
  return { rank: 'HIGH_CARD', score: HAND_RANKS.HIGH_CARD, description: '하이카드' };
}

// 조합 생성 (nCr)
function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 1) return arr.map(x => [x]);
  
  const result: T[][] = [];
  
  for (let i = 0; i <= arr.length - size; i++) {
    const head = arr[i];
    const tailCombs = getCombinations(arr.slice(i + 1), size - 1);
    tailCombs.forEach(tail => result.push([head, ...tail]));
  }
  
  return result;
}

// 점수 계산
export function calculateRoundScores(players: {
  player_number: number;
  hand_cards: string[];
  status: 'run' | 'giveup' | null;
  vote_to: number | null;
}[], communityCards: string[]): Map<number, number> {
  const scores = new Map<number, number>();
  
  // 후보자 목록
  const candidates = players.filter(p => p.status === 'run');
  const candidateCount = candidates.length;
  
  if (candidateCount === 0) {
    // 후보자가 없으면 점수 변화 없음
    players.forEach(p => scores.set(p.player_number, 0));
    return scores;
  }
  
  // 후보자별 족보 계산
  const candidateHands = candidates.map(c => ({
    playerNum: c.player_number,
    hand: getBestHand(c.hand_cards, communityCards),
  }));
  
  // 최고 족보 찾기
  const maxScore = Math.max(...candidateHands.map(ch => ch.hand.score));
  const winners = candidateHands.filter(ch => ch.hand.score === maxScore);
  const winnerCount = winners.length;
  
  // 1. 후보자 점수 계산
  for (const c of candidates) {
    const isWinner = winners.some(w => w.playerNum === c.player_number);
    
    if (isWinner) {
      // 최고 족보: +후보자 수 / 동률자 수 (소수점 버림)
      scores.set(c.player_number, Math.floor(candidateCount / winnerCount));
    } else {
      // 패배: -후보자 수
      scores.set(c.player_number, -candidateCount);
    }
  }
  
  // 2. 득표 점수 추가
  const voteCounts = new Map<number, number>();
  candidates.forEach(c => voteCounts.set(c.player_number, 0));
  
  players.filter(p => p.status === 'giveup').forEach(voter => {
    if (voter.vote_to && voter.vote_to > 0) {
      voteCounts.set(voter.vote_to, (voteCounts.get(voter.vote_to) || 0) + 1);
    }
  });
  
  for (const [candidateNum, voteCount] of voteCounts) {
    scores.set(candidateNum, (scores.get(candidateNum) || 0) + voteCount);
  }
  
  // 3. 유권자 점수 계산
  const winnerNums = winners.map(w => w.playerNum);
  players.filter(p => p.status === 'giveup').forEach(voter => {
    if (voter.vote_to && winnerNums.includes(voter.vote_to)) {
      // 투표한 후보가 최고 족보: +후보자 수
      scores.set(voter.player_number, candidateCount);
    } else {
      // 아니면 0점
      scores.set(voter.player_number, 0);
    }
  });
  
  return scores;
}

// 카드 덱 생성
export function createDeck(): Card[] {
  const suits = ['S', 'D', 'H', 'C'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const deck: Card[] = [];
  
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push(suit + rank);
    }
  }
  
  return deck;
}

// 카드 덱 셔플
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

// 카드 표시 형식
export function formatCard(card: Card): string {
  if (!card || card.length < 2) return '';
  const suit = card[0];
  const rank = card.slice(1);
  const suitSymbol = { S: '♠', D: '♦', H: '♥', C: '♣' }[suit] || suit;
  return `${suitSymbol}${rank}`;
}

// 카드 색상
export function getCardColor(card: Card): 'red' | 'black' {
  const suit = card[0];
  return (suit === 'D' || suit === 'H') ? 'red' : 'black';
}
