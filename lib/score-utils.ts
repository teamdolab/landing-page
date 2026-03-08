/**
 * 라운드 점수 계산
 * 후보자: 투표수 + (승리시 후보자수) + (단독승리시 +3) - (패배시 후보자수, 단 단독 최다투표시 패널티 없음)
 * 유권자: 투표한 후보가 승리하면 +후보자수
 */

type VoteRecord = { voter: number; voted_for: number | null };

export function calculateRoundScores(
  candidates: number[],
  winners: number[],
  roundVotes: VoteRecord[],
  roundIndex: number
): Map<number, number> {
  const scores = new Map<number, number>();
  const candidateCount = candidates.length;

  // Get vote count per candidate
  const voteCounts = new Map<number, number>();
  for (const c of candidates) voteCounts.set(c, 0);
  for (const v of roundVotes) {
    if (v.voted_for !== null) {
      voteCounts.set(v.voted_for, (voteCounts.get(v.voted_for) ?? 0) + 1);
    }
  }

  // Max vote count among all candidates
  const maxVotes = Math.max(...Array.from(voteCounts.values()));
  // Candidates who have max votes (for penalty exception: must be 단독)
  const maxVoteCandidates = candidates.filter((c) => voteCounts.get(c) === maxVotes);
  const isSoleMaxVotes = maxVoteCandidates.length === 1;
  const soleMaxVoteCandidate = isSoleMaxVotes ? maxVoteCandidates[0] : null;

  const isSoleWinner = winners.length === 1;

  // Candidate scores
  for (const c of candidates) {
    const votes = voteCounts.get(c) ?? 0;
    const isWinner = winners.includes(c);

    if (isWinner) {
      let s = votes + candidateCount;
      if (isSoleWinner) s += 3;
      scores.set(c, s);
    } else {
      // Loser: penalty unless 단독 최다투표
      const noPenalty = soleMaxVoteCandidate === c;
      const s = noPenalty ? votes : votes - candidateCount;
      scores.set(c, s);
    }
  }

  // Voter scores
  for (const v of roundVotes) {
    if (v.voted_for === null) continue;
    const votedCandidate = v.voted_for;
    const isWinner = winners.includes(votedCandidate);
    const voterNum = v.voter;
    const current = scores.get(voterNum) ?? 0;
    scores.set(voterNum, current + (isWinner ? candidateCount : 0));
  }

  return scores;
}
