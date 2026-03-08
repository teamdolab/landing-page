'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { broadcastDemoGame, type DemoGameState } from '@/lib/demo-sync';
import { calculateRoundScores } from '@/lib/score-utils';
import './demo-styles.css';

type GamePlayer = {
  player_number: number;
  is_first: boolean;
  is_candidate: boolean;
  revealed_cards: string[];
  total_score: number;
  round_scores: number[];
};

const ACTION_GUIDE: Record<number, string> = {
  0: '1라운드를 시작하세요.',
  1: '1라운드 선 플레이어를 선택하세요.',
  2: '카드 딜링을 완료하세요.',
  3: '전략회의 I을 진행하세요.',
  4: '출마 선언을 받으세요.',
  5: '후보자 연설을 진행하세요.',
  6: '턴 카드를 오픈하세요.',
  7: '전략회의 II를 진행하세요.',
  8: '유권자 투표를 진행하세요.',
  9: '리버 카드를 오픈하세요.',
  10: '이번 라운드 승리자를 선택하세요.',
};

const GRID_COLS: Record<number, number> = {
  8: 4,
  9: 5,
  10: 5,
  11: 6,
  12: 6,
};

function getInitialDemoGame(): DemoGameState {
  const playerCount = 12;
  const players: GamePlayer[] = Array.from({ length: playerCount }, (_, i) => ({
    player_number: i + 1,
    is_first: false,
    is_candidate: false,
    revealed_cards: [],
    total_score: 0,
    round_scores: [0, 0, 0, 0],
  }));
  return {
    game_id: 'demo',
    session_id: 'demo',
    player_count: playerCount,
    current_round: 1,
    current_step: 1,
    info_text: '선 정하기',
    timer_seconds: 0,
    timer_active: false,
    current_player: null,
    community_cards: [],
    players,
    votes: {},
    status: '진행중',
  };
}

const STRATEGY_MEETING_DURATION = 10; // 테스트용 10초 (원래 8분)
const DECLARATION_TIME_LIMIT = 20; // 출마 선언 제한 시간 20초
const CANDIDATE_SPEECH_TIME_LIMIT = 20; // 후보자 연설 제한 시간 20초
const VOTE_TIME_LIMIT = 20; // 유권자 투표 제한 시간 20초

const SUITS = ['S', 'D', 'C', 'H'] as const;
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
const ALL_CARDS = SUITS.flatMap((s) => RANKS.map((r) => `${s}${r}`));
/** 4x9: 열당 같은 문양, S2,S3,S4... 순서 */
const CARDS_BY_SUIT = SUITS.flatMap((s) => RANKS.map((r) => `${s}${r}`));

export default function DemoControlPage() {
  const [game, setGame] = useState<DemoGameState>(() => getInitialDemoGame());
  const [confirmPlayer, setConfirmPlayer] = useState<number | null>(null);
  const [showDealingPopup, setShowDealingPopup] = useState(false);
  const [showStrategyConfirmPopup, setShowStrategyConfirmPopup] = useState(false);
  const [showStrategyEndPopup, setShowStrategyEndPopup] = useState(false);
  const [showSkipConfirmPopup, setShowSkipConfirmPopup] = useState(false);
  const [showStartDeclarationPopup, setShowStartDeclarationPopup] = useState(false);
  const [showDeclarationEndPopup, setShowDeclarationEndPopup] = useState(false);
  const [showStartCandidateSpeechPopup, setShowStartCandidateSpeechPopup] = useState(false);
  const [showCandidateSpeechEndPopup, setShowCandidateSpeechEndPopup] = useState(false);
  const [showTurnAndStrategy2ConfirmPopup, setShowTurnAndStrategy2ConfirmPopup] = useState(false);
  const [showStrategy2EndPopup, setShowStrategy2EndPopup] = useState(false);
  const [showSkipStrategy2ConfirmPopup, setShowSkipStrategy2ConfirmPopup] = useState(false);
  const [showStartVotePopup, setShowStartVotePopup] = useState(false);
  const [showVoteEndPopup, setShowVoteEndPopup] = useState(false);
  const [showRiverPopup, setShowRiverPopup] = useState(false);
  const [showScoreSelectPopup, setShowScoreSelectPopup] = useState(false);
  const [selectedWinners, setSelectedWinners] = useState<number[]>([]);
  const [scoresCalculated, setScoresCalculated] = useState(false);
  const [showNextRoundConfirmPopup, setShowNextRoundConfirmPopup] = useState(false);
  const [showGameEndConfirmPopup, setShowGameEndConfirmPopup] = useState(false);
  const [showFinalWinnerPopup, setShowFinalWinnerPopup] = useState(false);
  const [selectedCoWinner, setSelectedCoWinner] = useState<number | null>(null);
  const [selectedDeclarationCards, setSelectedDeclarationCards] = useState<string[]>([]);

  function setFirstPlayer(playerNum: number) {
    const players = game.players.map((p) => ({
      ...p,
      is_first: p.player_number === playerNum,
    }));
    const next: DemoGameState = {
      ...game,
      players,
      current_step: 2,
      info_text: '카드 딜링',
    };
    setGame(next);
    broadcastDemoGame(next);
    setConfirmPlayer(null);
    setShowDealingPopup(true);
  }

  function completeDealing() {
    setShowDealingPopup(false);
    setShowStrategyConfirmPopup(true);
  }

  function startStrategyMeeting() {
    const next: DemoGameState = {
      ...game,
      current_step: 3,
      info_text: '전략회의 I',
      timer_seconds: STRATEGY_MEETING_DURATION,
      timer_active: true,
    };
    setGame(next);
    broadcastDemoGame(next);
    setShowStrategyConfirmPopup(false);
  }

  function toggleTimerPause() {
    const next: DemoGameState = {
      ...game,
      timer_active: !game.timer_active,
    };
    setGame(next);
    broadcastDemoGame(next);
  }

  function completeStrategyMeeting() {
    const next: DemoGameState = { ...game, timer_end: false };
    setGame(next);
    broadcastDemoGame(next);
    setShowStrategyEndPopup(false);
    setShowSkipConfirmPopup(false);
    setShowStartDeclarationPopup(true);
  }

  function confirmSkipStrategyMeeting() {
    setShowSkipConfirmPopup(false);
    setShowStrategyEndPopup(true);
  }

  function startStrategyMeeting2() {
    const next: DemoGameState = {
      ...game,
      current_step: 7,
      info_text: '전략회의 II',
      timer_seconds: STRATEGY_MEETING_DURATION,
      timer_active: true,
    };
    setGame(next);
    broadcastDemoGame(next);
    setShowTurnAndStrategy2ConfirmPopup(false);
  }

  function completeStrategyMeeting2() {
    const next: DemoGameState = { ...game, timer_end: false };
    setGame(next);
    broadcastDemoGame(next);
    setShowStrategy2EndPopup(false);
    setShowSkipStrategy2ConfirmPopup(false);
    setShowStartVotePopup(true);
  }

  function getVoterOrder(): number[] {
    const order = getDeclarationOrder();
    return order.filter((num) => {
      const p = game.players.find((x) => x.player_number === num);
      return p && !p.is_candidate;
    });
  }

  function startVote() {
    const voterOrder = getVoterOrder();
    const firstVoter = voterOrder[0] ?? null;
    const next: DemoGameState = {
      ...game,
      current_step: 8,
      info_text: '유권자 투표',
      current_player: firstVoter,
      timer_seconds: firstVoter ? VOTE_TIME_LIMIT : 0,
      timer_active: !!firstVoter,
      timer_end: voterOrder.length === 0,
    };
    setGame(next);
    broadcastDemoGame(next);
    setShowStartVotePopup(false);
    if (voterOrder.length === 0) setShowVoteEndPopup(true);
  }

  function handleVote(votedFor: number | null) {
    if (!game.current_player) return;
    const voterOrder = getVoterOrder();
    const idx = voterOrder.indexOf(game.current_player);
    const roundKey = String(game.current_round);
    const roundVotes = (game.votes?.[roundKey] as Array<{ voter: number; voted_for: number | null }>) || [];
    const newVote = { voter: game.current_player, voted_for: votedFor };
    const votes = {
      ...game.votes,
      [roundKey]: [...roundVotes, newVote],
    };
    const isLast = idx === voterOrder.length - 1;
    const nextVoter = isLast ? null : voterOrder[idx + 1];
    const next: DemoGameState = {
      ...game,
      votes,
      current_player: nextVoter,
      timer_seconds: nextVoter ? VOTE_TIME_LIMIT : 0,
      timer_active: !!nextVoter,
      timer_end: isLast,
    };
    setGame(next);
    broadcastDemoGame(next);
    if (isLast) setShowVoteEndPopup(true);
  }

  function completeVoteEnd() {
    const next: DemoGameState = { ...game, timer_end: false, current_step: 9, info_text: '리버 오픈' };
    setGame(next);
    broadcastDemoGame(next);
    setShowVoteEndPopup(false);
    setShowRiverPopup(true);
  }

  function completeRiverOpen() {
    const next: DemoGameState = {
      ...game,
      current_step: 10,
      info_text: '점수 집계',
      timer_end: true,
    };
    setGame(next);
    broadcastDemoGame(next);
    setShowRiverPopup(false);
    setShowScoreSelectPopup(true);
    setSelectedWinners([]);
    setScoresCalculated(false);
  }

  function toggleWinner(num: number) {
    setSelectedWinners((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  }

  function completeScoreSelect() {
    if (selectedWinners.length < 1) return;
    const candidates = getCandidateSpeechOrder();
    const roundKey = String(game.current_round);
    const roundVotes = (game.votes?.[roundKey] as Array<{ voter: number; voted_for: number | null }>) || [];
    const roundIndex = game.current_round - 1;
    const scoreDeltas = calculateRoundScores(candidates, selectedWinners, roundVotes, roundIndex);

    const players = game.players.map((p) => {
      const delta = scoreDeltas.get(p.player_number) ?? 0;
      const newRoundScores = [...(p.round_scores || [0, 0, 0, 0])];
      newRoundScores[roundIndex] = delta;
      const newTotal = (p.total_score || 0) + delta;
      return { ...p, round_scores: newRoundScores, total_score: newTotal };
    });

    const roundWinners = { ...(game.round_winners || {}), [roundKey]: selectedWinners };
    const next: DemoGameState = {
      ...game,
      players,
      round_winners: roundWinners,
    };
    setGame(next);
    broadcastDemoGame(next);
    setShowScoreSelectPopup(false);
    setScoresCalculated(true);
  }

  function startNextRound() {
    setShowNextRoundConfirmPopup(true);
  }

  function confirmNextRound() {
    const nextRound = game.current_round + 1;
    const prevFirst = game.players.find((p) => p.is_first)?.player_number;
    const isRound2Plus = nextRound >= 2;
    const newFirst = isRound2Plus && prevFirst
      ? ((prevFirst - 1 + 3) % game.player_count) + 1
      : null;
    const players = game.players.map((p) => ({
      ...p,
      is_first: newFirst !== null && p.player_number === newFirst,
      is_candidate: false,
      revealed_cards: [],
    }));
    const next: DemoGameState = {
      ...game,
      current_round: nextRound,
      current_step: isRound2Plus ? 2 : 1,
      info_text: isRound2Plus ? '카드 딜링' : '선 정하기',
      current_player: null,
      timer_seconds: 0,
      timer_active: false,
      timer_end: false,
      players,
      votes: { ...game.votes },
    };
    setGame(next);
    broadcastDemoGame(next);
    setShowNextRoundConfirmPopup(false);
    if (isRound2Plus) setShowDealingPopup(true);
  }

  function showGameEndPopup() {
    setShowGameEndConfirmPopup(true);
  }

  /** 최고 점수 플레이어 번호들 (공동 1등) */
  function getTopScorers(): number[] {
    if (!game.players.length) return [];
    const maxScore = Math.max(...game.players.map((p) => p.total_score));
    return game.players.filter((p) => p.total_score === maxScore).map((p) => p.player_number);
  }

  function confirmGameEnd() {
    const topScorers = getTopScorers();
    setShowGameEndConfirmPopup(false);
    setSelectedCoWinner(null);
    const next: DemoGameState = {
      ...game,
      status: '결과선택중',
      info_text: '최종 우승자 선택',
      timer_end: true,
      timer_active: false,
      timer_seconds: 0,
    };
    setGame(next);
    broadcastDemoGame(next);
    setShowFinalWinnerPopup(true);
  }

  function revealFinalResults() {
    const topScorers = getTopScorers();
    const finalWinners: number[] =
      topScorers.length === 1 && selectedCoWinner != null
        ? [topScorers[0], selectedCoWinner]
        : topScorers;
    const next: DemoGameState = {
      ...game,
      status: '완료',
      info_text: '게임 종료',
      final_winners: finalWinners,
      timer_end: true,
      timer_active: false,
      timer_seconds: 0,
    };
    setGame(next);
    broadcastDemoGame(next);
    setShowFinalWinnerPopup(false);
    setSelectedCoWinner(null);
  }

  function confirmSkipStrategyMeeting2() {
    const next: DemoGameState = {
      ...game,
      timer_end: true,
      timer_active: false,
      timer_seconds: 0,
    };
    setGame(next);
    broadcastDemoGame(next);
    setShowSkipStrategy2ConfirmPopup(false);
    setShowStrategy2EndPopup(true);
  }

  function getDeclarationOrder(): number[] {
    const first = game.players.find((p) => p.is_first);
    if (!first) return Array.from({ length: game.player_count }, (_, i) => i + 1);
    const n = game.player_count;
    return Array.from({ length: n }, (_, i) => ((first.player_number - 1 + i) % n) + 1);
  }

  function startDeclaration() {
    const order = getDeclarationOrder();
    const firstPlayer = order[0];
    const next: DemoGameState = {
      ...game,
      current_step: 4,
      info_text: '출마 선언',
      current_player: firstPlayer,
      timer_seconds: DECLARATION_TIME_LIMIT,
      timer_active: true,
    };
    setGame(next);
    broadcastDemoGame(next);
    setShowStartDeclarationPopup(false);
  }

  function handleDeclarationChoice(isCandidate: boolean) {
    const order = getDeclarationOrder();
    const idx = order.indexOf(game.current_player!);
    const players = game.players.map((p) =>
      p.player_number === game.current_player ? { ...p, is_candidate: isCandidate } : p
    );
    const isLast = idx === order.length - 1;
    const nextPlayer = isLast ? null : order[idx + 1];
    const next: DemoGameState = {
      ...game,
      players,
      current_player: nextPlayer,
      timer_seconds: nextPlayer ? DECLARATION_TIME_LIMIT : 0,
      timer_active: !!nextPlayer,
    };
    if (isLast) {
      next.timer_end = true;
      setShowDeclarationEndPopup(true);
    }
    setGame(next);
    broadcastDemoGame(next);
  }

  function getCandidateSpeechOrder(): number[] {
    const order = getDeclarationOrder();
    return order.filter((num) => {
      const p = game.players.find((x) => x.player_number === num);
      return p?.is_candidate;
    });
  }

  function completeDeclaration() {
    const next: DemoGameState = {
      ...game,
      current_step: 5,
      info_text: '후보자 연설',
      timer_end: false,
    };
    setGame(next);
    broadcastDemoGame(next);
    setShowDeclarationEndPopup(false);
    setShowStartCandidateSpeechPopup(true);
  }

  function startCandidateSpeech() {
    const candidateOrder = getCandidateSpeechOrder();
    const firstCandidate = candidateOrder[0] ?? null;
    const next: DemoGameState = {
      ...game,
      current_player: firstCandidate,
      timer_seconds: CANDIDATE_SPEECH_TIME_LIMIT,
      timer_active: true,
    };
    setGame(next);
    broadcastDemoGame(next);
    setShowStartCandidateSpeechPopup(false);
  }

  function toggleDeclarationCard(card: string) {
    setSelectedDeclarationCards((prev) => {
      if (prev.includes(card)) return prev.filter((c) => c !== card);
      if (prev.length >= 2) return prev;
      return [...prev, card];
    });
  }

  function completeCandidateCardDeclaration() {
    if (selectedDeclarationCards.length !== 2 || !game.current_player) return;
    const candidateOrder = getCandidateSpeechOrder();
    const idx = candidateOrder.indexOf(game.current_player);
    const players = game.players.map((p) =>
      p.player_number === game.current_player
        ? { ...p, revealed_cards: [...(p.revealed_cards || []), ...selectedDeclarationCards] }
        : p
    );
    const isLast = idx === candidateOrder.length - 1;
    const nextCandidate = isLast ? null : candidateOrder[idx + 1];
    const next: DemoGameState = {
      ...game,
      players,
      current_player: nextCandidate,
      timer_seconds: nextCandidate ? CANDIDATE_SPEECH_TIME_LIMIT : 0,
      timer_active: !!nextCandidate,
    };
    if (isLast) {
      next.timer_end = true;
      setShowCandidateSpeechEndPopup(true);
    }
    setGame(next);
    broadcastDemoGame(next);
    setSelectedDeclarationCards([]);
  }

  useEffect(() => {
    broadcastDemoGame(game);
  }, []);

  useEffect(() => {
    if (!game.timer_active || game.timer_seconds <= 0) return;
    const id = setInterval(() => {
      setGame((prev) => {
        if (!prev || !prev.timer_active || prev.timer_seconds <= 0) return prev;
        const next = prev.timer_seconds - 1;
        const nextState: DemoGameState = { ...prev, timer_seconds: next };
        if (next <= 0) {
          nextState.timer_active = false;
          if (prev.current_step === 3) {
            nextState.timer_end = true;
            setShowStrategyEndPopup(true);
          } else if (prev.current_step === 7) {
            nextState.timer_end = true;
            setShowStrategy2EndPopup(true);
          } else if (prev.current_step === 8 && prev.current_player) {
            const order = [...Array(prev.player_count)].map((_, i) => {
              const first = prev.players.find((p) => p.is_first);
              return first ? ((first.player_number - 1 + i) % prev.player_count) + 1 : i + 1;
            });
            const voterOrder = order.filter((n) => {
              const p = prev.players.find((x) => x.player_number === n);
              return p && !p.is_candidate;
            });
            const idx = voterOrder.indexOf(prev.current_player);
            const isLast = idx === voterOrder.length - 1;
            const nextVoter = isLast ? null : voterOrder[idx + 1];
            const roundKey = String(prev.current_round);
            const roundVotes = (prev.votes?.[roundKey] as Array<{ voter: number; voted_for: number | null }>) || [];
            const newVote = { voter: prev.current_player, voted_for: null as number | null };
            nextState.votes = {
              ...prev.votes,
              [roundKey]: [...roundVotes, newVote],
            };
            nextState.current_player = nextVoter;
            nextState.timer_seconds = nextVoter ? VOTE_TIME_LIMIT : 0;
            nextState.timer_active = !!nextVoter;
            nextState.timer_end = isLast;
            if (isLast) setShowVoteEndPopup(true);
          } else if (prev.current_step === 5 && prev.current_player) {
            const order = [...Array(prev.player_count)].map((_, i) => {
              const first = prev.players.find((p) => p.is_first);
              return first ? ((first.player_number - 1 + i) % prev.player_count) + 1 : i + 1;
            });
            const candidateOrder = order.filter((n) => {
              const p = prev.players.find((x) => x.player_number === n);
              return p?.is_candidate;
            });
            const idx = candidateOrder.indexOf(prev.current_player);
            const isLast = idx === candidateOrder.length - 1;
            const nextCandidate = isLast ? null : candidateOrder[idx + 1];
            nextState.current_player = nextCandidate;
            nextState.timer_seconds = nextCandidate ? CANDIDATE_SPEECH_TIME_LIMIT : 0;
            nextState.timer_active = !!nextCandidate;
            if (isLast) {
              nextState.timer_end = true;
              setShowCandidateSpeechEndPopup(true);
            }
          } else if (prev.current_step === 4 && prev.current_player) {
            const order = [...Array(prev.player_count)].map((_, i) => {
              const first = prev.players.find((p) => p.is_first);
              return first ? ((first.player_number - 1 + i) % prev.player_count) + 1 : i + 1;
            });
            const idx = order.indexOf(prev.current_player);
            const isLast = idx === order.length - 1;
            const nextPlayer = isLast ? null : order[idx + 1];
            nextState.players = prev.players.map((p) =>
              p.player_number === prev.current_player ? { ...p, is_candidate: false } : p
            );
            nextState.current_player = nextPlayer;
            nextState.timer_seconds = nextPlayer ? DECLARATION_TIME_LIMIT : 0;
            nextState.timer_active = !!nextPlayer;
            if (isLast) {
              nextState.timer_end = true;
              nextState.current_player = null;
              setShowDeclarationEndPopup(true);
            }
          }
        }
        broadcastDemoGame(nextState);
        return nextState;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [game.timer_active, game.timer_seconds, game.current_step]);

  const players = game.players || [];
  const activeCount = Math.min(game.player_count || 8, 12);
  const gridCols = GRID_COLS[activeCount] ?? 6;
  const phaseText = game.info_text ?? `Step ${game.current_step}`;
  const actionGuide = ACTION_GUIDE[game.current_step] ?? '';

  return (
    <div className="control-demo-root">
      {/* 데모 배너 */}
      <div className="demo-banner">
        <span>데모 모드</span>
        <Link href="/game/display?session=demo" target="_blank" rel="noopener noreferrer">
          송출 화면 열기
        </Link>
      </div>

      {/* 상단바: 게임코드 | 라운드 | 탭 */}
      <header className="demo-header">
        <div className="demo-game-code">{game.session_id}</div>
        <div className="demo-round-box">{game.current_round} ROUND</div>
        <div className="demo-tabs">탭 (추후 구현)</div>
      </header>

      {/* 중단: 라운드 진행상황 | 타이머 | 액션 가이드 */}
      <main className="demo-main">
        <section className="demo-info-section">
          <div className="demo-phase-container">
            <div className="demo-phase-current">{phaseText}</div>
          </div>
          <div className="demo-timer-wrapper">
            <div className="demo-timer-container">
              <div className={`demo-timer-value ${game.timer_end ? 'timer-end' : ''}`}>
                {game.timer_end
                  ? '종료'
                  : game.timer_seconds > 0
                    ? `${Math.floor(game.timer_seconds / 60).toString().padStart(2, '0')}:${(game.timer_seconds % 60).toString().padStart(2, '0')}`
                    : '--:--'}
              </div>
            </div>
            {(((game.current_step === 3 || game.current_step === 4 || game.current_step === 5 || game.current_step === 7 || game.current_step === 8) && game.timer_seconds > 0) || (game.current_step === 10 && scoresCalculated)) && (
              <>
                {(game.current_step === 3 || game.current_step === 7) && (
                  <>
                    <button
                      type="button"
                      className="demo-pause-btn"
                      onClick={toggleTimerPause}
                    >
                      {game.timer_active ? '일시정지' : '재개'}
                    </button>
                    <button
                      type="button"
                      className="demo-skip-btn"
                      onClick={() => (game.current_step === 3 ? setShowSkipConfirmPopup(true) : setShowSkipStrategy2ConfirmPopup(true))}
                    >
                      스킵
                    </button>
                  </>
                )}
                {game.current_step === 8 && (
                  <button
                    type="button"
                    className="demo-pause-btn"
                    onClick={toggleTimerPause}
                  >
                    {game.timer_active ? '일시정지' : '재개'}
                  </button>
                )}
                {game.current_step === 10 && scoresCalculated && (
                  game.current_round >= 4 ? (
                    <button
                      type="button"
                      className="demo-next-round-btn"
                      onClick={showGameEndPopup}
                    >
                      게임 종료
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="demo-next-round-btn"
                      onClick={startNextRound}
                    >
                      다음 라운드 시작
                    </button>
                  )
                )}
              </>
            )}
          </div>
          <div className="demo-action-guide">
            <div className="demo-action-text">{actionGuide}</div>
          </div>
        </section>

        {/* 하단: 플레이어 박스 그리드 */}
        <section
          className="demo-detail-section"
          style={{ '--grid-cols': gridCols } as React.CSSProperties}
        >
          {Array.from({ length: activeCount }, (_, i) => i + 1).map((num) => {
            const p = players.find((x) => x.player_number === num) || {
              player_number: num,
              is_first: false,
              is_candidate: false,
              revealed_cards: [] as string[],
              total_score: 0,
              round_scores: [0, 0, 0, 0],
            };
            const isActive = game.current_player === num;
            const roundWinners = game.round_winners?.[String(game.current_round)] ?? [];
            const isWinner = roundWinners.includes(num);
            return (
              <div
                key={num}
                className={`demo-player-col ${isActive ? 'demo-player-active' : ''} ${isWinner ? 'demo-player-winner' : ''}`}
                onClick={() => game.current_step === 1 && setConfirmPlayer(num)}
              >
                <div className="demo-player-box">
                  <div className="demo-avatar-wrapper">
                    {isWinner && <div className="demo-crown-badge">👑</div>}
                    {p.is_first && <div className="demo-first-player-badge">先</div>}
                    <div className="demo-node-box">
                      <span className="demo-player-num">{num}</span>
                    </div>
                  </div>
                  <div className="demo-score-box">{p.total_score}</div>
                </div>
                {p.is_candidate && (
                  <div className="demo-player-info">
                    <div className="demo-candidate-badge">후보</div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </main>

      {/* 선 플레이어 확인 팝업 */}
      {confirmPlayer !== null && (
        <div
          className="demo-modal-overlay"
          onClick={() => setConfirmPlayer(null)}
        >
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">
              1라운드 선 플레이어는 {confirmPlayer}번 플레이어입니다.
            </p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary" onClick={() => setFirstPlayer(confirmPlayer)}>
                네
              </button>
              <button className="demo-btn-secondary" onClick={() => setConfirmPlayer(null)}>
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 카드 딜링 안내 팝업 */}
      {showDealingPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">카드를 딜링 후, 한 장의 카드를 공개하고, 3장의 공용 카드를 공개하세요.(플랍)</p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary" onClick={completeDealing}>
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전략회의 I 진행 확인 팝업 */}
      {showStrategyConfirmPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">전략 회의 I을 진행하겠습니까?</p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary" onClick={startStrategyMeeting}>
                네
              </button>
              <button className="demo-btn-secondary" onClick={() => setShowStrategyConfirmPopup(false)}>
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전략회의 I 스킵 확인 팝업 */}
      {showSkipConfirmPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">전략회의 I을 종료하시겠습니까?</p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary" onClick={confirmSkipStrategyMeeting}>
                예
              </button>
              <button className="demo-btn-secondary" onClick={() => setShowSkipConfirmPopup(false)}>
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전략회의 I 종료 팝업 */}
      {showStrategyEndPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">전략 회의 I이 종료되었습니다.</p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary" onClick={completeStrategyMeeting}>
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 출마 선언 시작 팝업 */}
      {showStartDeclarationPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">출마 선언을 시작합니다.</p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary demo-btn-large" onClick={startDeclaration}>
                시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 출마 선언 플레이어 선택 팝업 */}
      {game.current_step === 4 && game.current_player !== null && (
        <div className="demo-modal-overlay demo-declaration-overlay">
          <div className="demo-declaration-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-declaration-player">{game.current_player}번 플레이어</p>
            <div className="demo-declaration-timer-row">
              <div className="demo-declaration-timer">
                {game.timer_seconds > 0
                  ? `${Math.floor(game.timer_seconds / 60).toString().padStart(2, '0')}:${(game.timer_seconds % 60).toString().padStart(2, '0')}`
                  : '00:00'}
              </div>
              <button type="button" className="demo-pause-btn" onClick={toggleTimerPause}>
                {game.timer_active ? '일시정지' : '재개'}
              </button>
            </div>
            <div className="demo-declaration-buttons">
              <button
                type="button"
                className="demo-declaration-btn demo-declaration-btn-enter"
                onClick={() => handleDeclarationChoice(true)}
              >
                출마
              </button>
              <button
                type="button"
                className="demo-declaration-btn demo-declaration-btn-pass"
                onClick={() => handleDeclarationChoice(false)}
              >
                포기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 출마 선언 종료 팝업 */}
      {showDeclarationEndPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">출마 선언이 종료되었습니다.</p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary" onClick={completeDeclaration}>
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 후보자 연설 시작 팝업 */}
      {showStartCandidateSpeechPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">
              후보자 선언을 시작합니다.
              <br />
              첫 후보자 선언은 {getCandidateSpeechOrder()[0] ?? '?'}번 플레이어입니다.
            </p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary demo-btn-large" onClick={startCandidateSpeech}>
                시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 후보자 연설 카드 선택 팝업 */}
      {game.current_step === 5 && game.current_player !== null && (
        <div className="demo-modal-overlay demo-card-modal-overlay">
          <div className="demo-card-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-card-modal-title">
              {game.current_player}번 플레이어 · 선언할 카드 2장을 선택하세요 ({selectedDeclarationCards.length}/2)
            </p>
            <div className="demo-card-modal-header-row">
              <div className="demo-card-modal-timer">
                {game.timer_seconds > 0
                  ? `${Math.floor(game.timer_seconds / 60).toString().padStart(2, '0')}:${(game.timer_seconds % 60).toString().padStart(2, '0')}`
                  : '00:00'}
              </div>
              <button type="button" className="demo-pause-btn" onClick={toggleTimerPause}>
                {game.timer_active ? '일시정지' : '재개'}
              </button>
              <button
                type="button"
                className="demo-btn-primary demo-btn-large demo-card-declare-btn"
                onClick={completeCandidateCardDeclaration}
                disabled={selectedDeclarationCards.length !== 2}
              >
                선언 완료
              </button>
            </div>
            <div className="demo-card-grid demo-card-grid-by-suit">
              {CARDS_BY_SUIT.map((card) => (
                <button
                  key={card}
                  type="button"
                  className={`demo-card-btn ${selectedDeclarationCards.includes(card) ? 'selected' : ''} ${card[0] === 'D' || card[0] === 'H' ? 'red' : 'black'}`}
                  onClick={() => toggleDeclarationCard(card)}
                >
                  {card[0] === 'S' && '♠'}
                  {card[0] === 'D' && '♦'}
                  {card[0] === 'C' && '♣'}
                  {card[0] === 'H' && '♥'}
                  {card.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 후보자 연설 종료 팝업 */}
      {showCandidateSpeechEndPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">후보자 연설이 종료되었습니다.</p>
            <div className="demo-modal-buttons">
              <button
                className="demo-btn-primary"
                onClick={() => {
                  const next: DemoGameState = { ...game, timer_end: false, current_step: 6, info_text: '턴 오픈' };
                  setGame(next);
                  broadcastDemoGame(next);
                  setShowCandidateSpeechEndPopup(false);
                  setShowTurnAndStrategy2ConfirmPopup(true);
                }}
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 턴 오픈 + 전략회의 II 시작 확인 팝업 */}
      {showTurnAndStrategy2ConfirmPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">
              1장의 카드를 공개하고 1장의 공용 카드를 공개해주세요(턴).
              <br />
              전략 회의 II를 시작하시겠습니까?
            </p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary" onClick={startStrategyMeeting2}>
                네
              </button>
              <button className="demo-btn-secondary" onClick={() => setShowTurnAndStrategy2ConfirmPopup(false)}>
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전략회의 II 스킵 확인 팝업 */}
      {showSkipStrategy2ConfirmPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">전략회의 II을 종료하시겠습니까?</p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary" onClick={confirmSkipStrategyMeeting2}>
                예
              </button>
              <button className="demo-btn-secondary" onClick={() => setShowSkipStrategy2ConfirmPopup(false)}>
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전략회의 II 종료 팝업 */}
      {showStrategy2EndPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">전략 회의 II가 종료되었습니다.</p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary" onClick={completeStrategyMeeting2}>
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 투표 시작 팝업 */}
      {showStartVotePopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">
              투표를 진행하시겠습니까?
              <br />
              첫 번째 투표할 플레이어는 {getVoterOrder()[0] ?? '?'}번 플레이어입니다.
            </p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary demo-btn-large" onClick={startVote}>
                시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 투표 플레이어 선택 팝업 */}
      {game.current_step === 8 && game.current_player !== null && (
        <div className="demo-modal-overlay demo-declaration-overlay">
          <div className="demo-vote-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-vote-player">{game.current_player}번 플레이어</p>
            <div className="demo-vote-timer-row">
              <div className="demo-vote-timer">
                {game.timer_seconds > 0
                  ? `${Math.floor(game.timer_seconds / 60).toString().padStart(2, '0')}:${(game.timer_seconds % 60).toString().padStart(2, '0')}`
                  : '00:00'}
              </div>
              <button type="button" className="demo-pause-btn" onClick={toggleTimerPause}>
                {game.timer_active ? '일시정지' : '재개'}
              </button>
            </div>
            <p className="demo-vote-label">후보자 번호</p>
            <div className="demo-vote-candidates">
              {getCandidateSpeechOrder().map((num) => (
                <button
                  key={num}
                  type="button"
                  className="demo-vote-candidate-btn"
                  onClick={() => handleVote(num)}
                >
                  {num}번
                </button>
              ))}
            </div>
            <button
              type="button"
              className="demo-vote-abstain-btn"
              onClick={() => handleVote(null)}
            >
              기권
            </button>
          </div>
        </div>
      )}

      {/* 투표 종료 팝업 */}
      {showVoteEndPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">투표가 종료되었습니다.</p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary" onClick={completeVoteEnd}>
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 리버 오픈 팝업 */}
      {showRiverPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">
              1장의 카드를 공개하고, 1장의 공용 카드를 공개해주세요(리버).
            </p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary" onClick={completeRiverOpen}>
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 점수 집계 - 승리자 선택 팝업 */}
      {showScoreSelectPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal demo-score-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">이번 라운드에 승리한 후보자를 선택해주세요.</p>
            <div className="demo-score-candidates">
              {getCandidateSpeechOrder().map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`demo-score-candidate-btn ${selectedWinners.includes(num) ? 'selected' : ''}`}
                  onClick={() => toggleWinner(num)}
                >
                  {num}번
                </button>
              ))}
            </div>
            <p className="demo-score-hint">최소 1명 이상 선택 (공동 승리 가능)</p>
            <div className="demo-modal-buttons">
              <button
                className="demo-btn-primary"
                onClick={completeScoreSelect}
                disabled={selectedWinners.length < 1}
              >
                선택 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 다음 라운드 확인 팝업 */}
      {showNextRoundConfirmPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">다음 라운드를 진행하시겠습니까?</p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary" onClick={confirmNextRound}>
                예
              </button>
              <button className="demo-btn-secondary" onClick={() => setShowNextRoundConfirmPopup(false)}>
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 게임 종료 확인 팝업 */}
      {showGameEndConfirmPopup && (
        <div className="demo-modal-overlay">
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">게임이 종료되었습니다. 결과를 발표합니다.</p>
            <div className="demo-modal-buttons">
              <button className="demo-btn-primary" onClick={confirmGameEnd}>
                예
              </button>
              <button className="demo-btn-secondary" onClick={() => setShowGameEndConfirmPopup(false)}>
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 최종 우승자 선택 팝업 */}
      {showFinalWinnerPopup && (() => {
        const topScorers = getTopScorers();
        const isSoleWinner = topScorers.length === 1;
        const winnerText =
          topScorers.length === 1
            ? `최종 우승자는 ${topScorers[0]}번 플레이어입니다.`
            : `최종 우승자들은 ${topScorers.join(', ')}번 플레이어입니다.`;
        const canReveal = !isSoleWinner || selectedCoWinner != null;
        const otherPlayers = game.players
          .map((p) => p.player_number)
          .filter((n) => !topScorers.includes(n));
        return (
          <div className="demo-modal-overlay">
            <div className="demo-modal demo-score-modal" onClick={(e) => e.stopPropagation()}>
              <p className="demo-modal-text">{winnerText}</p>
              {isSoleWinner && (
                <>
                  <p className="demo-modal-text demo-modal-sub">단독 우승하여 공동 우승자를 지목합니다.</p>
                  <div className="demo-score-candidates">
                    {otherPlayers.map((num) => (
                      <button
                        key={num}
                        type="button"
                        className={`demo-score-candidate-btn ${selectedCoWinner === num ? 'selected' : ''}`}
                        onClick={() => setSelectedCoWinner(selectedCoWinner === num ? null : num)}
                      >
                        {num}번
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="demo-modal-buttons">
                <button
                  className="demo-btn-primary"
                  onClick={revealFinalResults}
                  disabled={!canReveal}
                >
                  결과 공개
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
