// 대선포커 유틸리티 함수 (오프라인 게임용)

// 카드 타입 정의
type Card = string; // 'S2', 'D10', 'H5' 등

// 점수 계산 (딜러가 승리 후보 선택)
export function calculateRoundScores(
  players: {
    player_number: number;
    status: 'run' | 'giveup' | null;
    vote_to: number | null;
  }[],
  winnerNumbers: number[] // 딜러가 선택한 승리 후보들
): Map<number, number> {
  const scores = new Map<number, number>();
  
  // 후보자 목록
  const candidates = players.filter(p => p.status === 'run');
  const candidateCount = candidates.length;
  
  if (candidateCount === 0) {
    players.forEach(p => scores.set(p.player_number, 0));
    return scores;
  }
  
  const winnerCount = winnerNumbers.length;
  
  // 1. 후보자 점수 계산
  for (const c of candidates) {
    const isWinner = winnerNumbers.includes(c.player_number);
    
    if (isWinner) {
      // 승리: +후보자 수 / 승자 수 (소수점 버림)
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
  players.filter(p => p.status === 'giveup').forEach(voter => {
    if (voter.vote_to && winnerNumbers.includes(voter.vote_to)) {
      // 투표한 후보가 승리: +후보자 수
      scores.set(voter.player_number, candidateCount);
    } else {
      // 아니면 0점
      scores.set(voter.player_number, 0);
    }
  });
  
  return scores;
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
