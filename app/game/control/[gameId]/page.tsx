'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { formatCard, getCardColor } from '@/lib/poker-utils';
import { calculateRoundScores } from '@/lib/score-utils';
import '../demo/demo-styles.css';

const ADMIN_STORAGE_KEY = 'admin_authenticated';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type GamePlayer = {
  player_number: number;
  is_first: boolean;
  is_candidate: boolean;
  revealed_cards: string[];
  total_score: number;
  round_scores: number[];
};

type Game = {
  game_id: string;
  session_id: string;
  player_count: number;
  current_round: number;
  current_step: number;
  info_text: string | null;
  timer_seconds: number;
  timer_active: boolean;
  timer_end?: boolean;
  current_player: number | null;
  community_cards: string[];
  players: GamePlayer[];
  votes?: Record<string, Array<{ voter: number; voted_for: number | null }>>;
  round_winners?: Record<string, number[]>;
  final_winners?: number[];
  status: string;
};

const STEP_LABELS: Record<number, string> = {
  0: '대기',
  1: '선 정하기',
  2: '카드 딜링',
  3: '전략회의 I',
  4: '출마 선언',
  5: '후보자 연설',
  6: '턴 오픈',
  7: '전략회의 II',
  8: '유권자 투표',
  9: '리버 오픈',
  10: '이번 라운드 승리자를 선택하세요.',
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
  10: '결과를 계산하세요.',
};

const GRID_COLS: Record<number, number> = {
  8: 4,
  9: 5,
  10: 5,
  11: 6,
  12: 6,
};

const STRATEGY_MEETING_DURATION = 480; // 8분
const DECLARATION_TIME_LIMIT = 20; // 출마 선언 제한 시간 20초
const CANDIDATE_SPEECH_TIME_LIMIT = 20; // 후보자 연설 제한 시간 20초
const VOTE_TIME_LIMIT = 20; // 유권자 투표 제한 시간 20초

const SUITS = ['S', 'D', 'C', 'H'] as const;
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
const ALL_CARDS = SUITS.flatMap((s) => RANKS.map((r) => `${s}${r}`));
/** 4x9: 열당 같은 문양, S2,S3,S4... 순서 */
const CARDS_BY_SUIT = SUITS.flatMap((s) => RANKS.map((r) => `${s}${r}`));

export default function GameControlPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmPlayer, setConfirmPlayer] = useState<number | null>(null);
  const [showDealingPopup, setShowDealingPopup] = useState(false);
  const [showStrategyConfirmPopup, setShowStrategyConfirmPopup] = useState(false);
  const [showStrategyEndPopup, setShowStrategyEndPopup] = useState(false);
  const [showSkipConfirmPopup, setShowSkipConfirmPopup] = useState(false);
  const [showStartDeclarationPopup, setShowStartDeclarationPopup] = useState(false);
  const [showDeclarationEndPopup, setShowDeclarationEndPopup] = useState(false);
  const [showStartCandidateSpeechPopup, setShowStartCandidateSpeechPopup] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
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
  const [updating, setUpdating] = useState(false);
  const [showGoToStepModal, setShowGoToStepModal] = useState(false);
  const [goToStepTargetRound, setGoToStepTargetRound] = useState(1);
  const [goToStepTargetStep, setGoToStepTargetStep] = useState(0);
  const [showClosingConfirmModal, setShowClosingConfirmModal] = useState(false);

  const loadGame = useCallback(async () => {
    if (!gameId) return;
    const res = await fetch(`/api/game/${encodeURIComponent(gameId)}`);
    const data = await res.json();
    if (res.ok && data) {
      setGame(data);
    } else {
      setGame(null);
    }
  }, [gameId]);

  useEffect(() => {
    loadGame().finally(() => setLoading(false));
  }, [loadGame]);

  useEffect(() => {
    if (!gameId || !game) return;
    const channel = supabase
      .channel('game-control')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_0a',
          filter: `game_id=eq.${gameId}`,
        },
        () => loadGame()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, game, loadGame]);

  // 결과선택중 상태에서 새로고침 시 팝업 복원
  useEffect(() => {
    if (game?.status === '결과선택중') {
      setShowFinalWinnerPopup(true);
    }
  }, [game?.status]);

  function closeAllPopups() {
    setShowDealingPopup(false);
    setShowStrategyConfirmPopup(false);
    setShowStrategyEndPopup(false);
    setShowSkipConfirmPopup(false);
    setShowStartDeclarationPopup(false);
    setShowDeclarationEndPopup(false);
    setShowStartCandidateSpeechPopup(false);
    setShowCandidateSpeechEndPopup(false);
    setShowTurnAndStrategy2ConfirmPopup(false);
    setShowStrategy2EndPopup(false);
    setShowSkipStrategy2ConfirmPopup(false);
    setShowStartVotePopup(false);
    setShowVoteEndPopup(false);
    setShowRiverPopup(false);
    setShowScoreSelectPopup(false);
    setShowNextRoundConfirmPopup(false);
    setShowGameEndConfirmPopup(false);
    setShowFinalWinnerPopup(false);
    setShowGoToStepModal(false);
    setConfirmPlayer(null);
    setSelectedCards([]);
    setSelectedWinners([]);
    setScoresCalculated(false);
    setSelectedCoWinner(null);
  }

  async function handleUndo() {
    if (!gameId || updating) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/undo`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        closeAllPopups();
        await loadGame();
      } else {
        alert(data.error || 'Undo 실패');
      }
    } catch (e) {
      console.error(e);
      alert('Undo 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  async function handleGoToStep() {
    if (!gameId || updating) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/go-to-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_round: goToStepTargetRound,
          target_step: goToStepTargetStep,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        closeAllPopups();
        setGame(data.game);
        setShowGoToStepModal(false);
        setScoresCalculated(false);
        if (data.game?.current_step === 10) setShowScoreSelectPopup(true);
      } else {
        alert(data.error || '단계 이동 실패');
      }
    } catch (e) {
      console.error(e);
      alert('단계 이동 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  /** Undo 반대: 팝업에서 예/완료가 안 눌릴 때 수동으로 다음 단계 진행 */
  function handleProceed() {
    if (updating) return;
    if (showNextRoundConfirmPopup) {
      confirmNextRound();
      return;
    }
    if (showDealingPopup) {
      completeDealing();
      return;
    }
    if (showGameEndConfirmPopup) {
      confirmGameEnd();
      return;
    }
    if (showStrategyConfirmPopup) {
      startStrategyMeeting();
      return;
    }
    if (game?.current_step === 2 && !showDealingPopup) {
      setShowStrategyConfirmPopup(true);
      return;
    }
    if (game?.current_step === 10 && scoresCalculated && game.current_round >= 4) {
      showGameEndPopup();
      return;
    }
    if (game?.current_step === 10 && scoresCalculated && game.current_round < 4) {
      startNextRound();
      return;
    }
  }

  const canProceed =
    !!game &&
    (showNextRoundConfirmPopup ||
      showDealingPopup ||
      showGameEndConfirmPopup ||
      showStrategyConfirmPopup ||
      (game.current_step === 2 && !showDealingPopup) ||
      (game.current_step === 10 && scoresCalculated));

  async function setFirstPlayer(playerNum: number) {
    if (!game) return;
    setUpdating(true);
    try {
      const players = (game.players || []).map((p) => ({
        ...p,
        is_first: p.player_number === playerNum,
      }));
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          players,
          current_step: 2,
          info_text: '카드 딜링',
          action_type: 'select_first',
          action_player_number: playerNum,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame(data);
        setConfirmPlayer(null);
        setShowDealingPopup(true);
      } else {
        alert(data.error || '업데이트 실패');
      }
    } catch (e) {
      console.error(e);
      alert('업데이트 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  function completeDealing() {
    setShowDealingPopup(false);
    setShowStrategyConfirmPopup(true);
  }

  async function startStrategyMeeting() {
    if (!game) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_step: 3,
          info_text: '전략회의 I',
          timer_seconds: STRATEGY_MEETING_DURATION,
          timer_active: true,
          action_type: 'dealing_complete',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame(data);
        setShowStrategyConfirmPopup(false);
      } else {
        alert(data.error || '업데이트 실패');
      }
    } catch (e) {
      console.error(e);
      alert('업데이트 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  async function toggleTimerPause() {
    if (!game) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timer_active: !game.timer_active }),
      });
      const data = await res.json();
      if (res.ok) setGame(data);
      else alert(data.error || '업데이트 실패');
    } catch (e) {
      console.error(e);
      alert('업데이트 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  async function completeStrategyMeeting() {
    if (!game) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timer_end: false }),
      });
      if (res.ok) {
        const data = await res.json();
        setGame(data);
      }
      setShowStrategyEndPopup(false);
      setShowSkipConfirmPopup(false);
      setShowStartDeclarationPopup(true);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  }

  function confirmSkipStrategyMeeting() {
    setShowSkipConfirmPopup(false);
    setShowStrategyEndPopup(true);
  }

  function getDeclarationOrder(g?: Game | null): number[] {
    const ctx = g ?? game;
    if (!ctx) return [];
    const first = ctx.players.find((p) => p.is_first);
    if (!first) return Array.from({ length: ctx.player_count }, (_, i) => i + 1);
    const n = ctx.player_count;
    return Array.from({ length: n }, (_, i) => ((first.player_number - 1 + i) % n) + 1);
  }

  function getCandidateOrderFromGame(g: Game): number[] {
    return getDeclarationOrder(g).filter((num) => {
      const p = g.players.find((x) => x.player_number === num);
      return p?.is_candidate;
    });
  }

  async function startDeclaration() {
    if (!game) return;
    const order = getDeclarationOrder();
    const firstPlayer = order[0];
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_step: 4,
          info_text: '출마 선언',
          current_player: firstPlayer,
          timer_seconds: DECLARATION_TIME_LIMIT,
          timer_active: true,
          action_type: 'strategy_meeting_1_end',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame(data);
        setShowStartDeclarationPopup(false);
      } else {
        alert(data.error || '업데이트 실패');
      }
    } catch (e) {
      console.error(e);
      alert('업데이트 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeclarationChoice(isCandidate: boolean) {
    if (!game) return;
    const order = getDeclarationOrder();
    const idx = order.indexOf(game.current_player!);
    const players = game.players.map((p) =>
      p.player_number === game.current_player ? { ...p, is_candidate: isCandidate } : p
    );
    const isLast = idx === order.length - 1;
    const nextPlayer = isLast ? null : order[idx + 1];
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          players,
          current_player: nextPlayer,
          timer_seconds: nextPlayer ? DECLARATION_TIME_LIMIT : 0,
          timer_active: !!nextPlayer,
          timer_end: isLast,
          ...(isLast && { current_player: null }),
          action_type: 'candidacy',
          action_player_number: game.current_player!,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame(data);
        if (isLast) setShowDeclarationEndPopup(true);
      } else {
        alert(data.error || '업데이트 실패');
      }
    } catch (e) {
      console.error(e);
      alert('업데이트 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  function getCandidateSpeechOrder(): number[] {
    return getCandidateOrderFromGame(game!);
  }

  async function completeDeclaration() {
    if (!game) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_step: 5,
          info_text: '후보자 연설',
          timer_end: false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGame(data);
      }
      setShowDeclarationEndPopup(false);
      setShowStartCandidateSpeechPopup(true);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  }

  async function startCandidateSpeech() {
    if (!game) return;
    const candidateOrder = getCandidateSpeechOrder();
    const firstCandidate = candidateOrder[0] ?? null;
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_player: firstCandidate,
          timer_seconds: CANDIDATE_SPEECH_TIME_LIMIT,
          timer_active: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame(data);
        setShowStartCandidateSpeechPopup(false);
      } else {
        alert(data.error || '업데이트 실패');
      }
    } catch (e) {
      console.error(e);
      alert('업데이트 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  function toggleCandidateCard(card: string) {
    setSelectedCards((prev) => {
      if (prev.includes(card)) return prev.filter((c) => c !== card);
      if (prev.length >= 2) return prev;
      return [...prev, card];
    });
  }

  async function completeCandidateCardDeclaration() {
    if (selectedCards.length !== 2 || !game?.current_player) return;
    const candidateOrder = getCandidateSpeechOrder();
    const idx = candidateOrder.indexOf(game.current_player);
    const players = game.players.map((p) =>
      p.player_number === game.current_player
        ? { ...p, revealed_cards: [...(p.revealed_cards || []), ...selectedCards] }
        : p
    );
    const isLast = idx === candidateOrder.length - 1;
    const nextCandidate = isLast ? null : candidateOrder[idx + 1];
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          players,
          current_player: nextCandidate,
          timer_seconds: nextCandidate ? CANDIDATE_SPEECH_TIME_LIMIT : 0,
          timer_active: !!nextCandidate,
          timer_end: isLast,
          action_type: 'reveal_cards',
          action_player_number: game.current_player!,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame(data);
        setSelectedCards([]);
        if (isLast) setShowCandidateSpeechEndPopup(true);
      } else {
        alert(data.error || '업데이트 실패');
      }
    } catch (e) {
      console.error(e);
      alert('업데이트 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  async function completeCandidateSpeechEnd() {
    if (!game) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_step: 6,
          info_text: '턴 오픈',
          timer_end: false,
          action_type: 'turn_open',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGame(data);
      }
      setShowCandidateSpeechEndPopup(false);
      setShowTurnAndStrategy2ConfirmPopup(true);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  }

  async function startStrategyMeeting2() {
    if (!game) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_step: 7,
          info_text: '전략회의 II',
          timer_seconds: STRATEGY_MEETING_DURATION,
          timer_active: true,
          action_type: 'strategy_meeting_2_start',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame(data);
        setShowTurnAndStrategy2ConfirmPopup(false);
      } else {
        alert(data.error || '업데이트 실패');
      }
    } catch (e) {
      console.error(e);
      alert('업데이트 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  async function completeStrategyMeeting2() {
    if (!game) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timer_end: false,
          action_type: 'strategy_meeting_2_end',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGame(data);
      }
      setShowStrategy2EndPopup(false);
      setShowSkipStrategy2ConfirmPopup(false);
      setShowStartVotePopup(true);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  }

  function getVoterOrder(g?: Game | null): number[] {
    const ctx = g ?? game;
    if (!ctx) return [];
    return getDeclarationOrder(ctx).filter((num) => {
      const p = ctx.players.find((x) => x.player_number === num);
      return p && !p.is_candidate;
    });
  }

  async function startVote() {
    if (!game) return;
    const voterOrder = getVoterOrder();
    const firstVoter = voterOrder[0] ?? null;
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_step: 8,
          info_text: '유권자 투표',
          current_player: firstVoter,
          timer_seconds: firstVoter ? VOTE_TIME_LIMIT : 0,
          timer_active: !!firstVoter,
          timer_end: voterOrder.length === 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame(data);
        setShowStartVotePopup(false);
        if (voterOrder.length === 0) setShowVoteEndPopup(true);
      } else {
        alert(data.error || '업데이트 실패');
      }
    } catch (e) {
      console.error(e);
      alert('업데이트 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  async function handleVote(votedFor: number | null) {
    if (!game?.current_player) return;
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
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          votes,
          current_player: nextVoter,
          timer_seconds: nextVoter ? VOTE_TIME_LIMIT : 0,
          timer_active: !!nextVoter,
          timer_end: isLast,
          action_type: 'vote',
          action_player_number: game.current_player!,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame(data);
        if (isLast) setShowVoteEndPopup(true);
      } else {
        alert(data.error || '업데이트 실패');
      }
    } catch (e) {
      console.error(e);
      alert('업데이트 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  async function completeVoteEnd() {
    if (!game) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_step: 9,
          info_text: '리버 오픈',
          timer_end: false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGame(data);
      }
      setShowVoteEndPopup(false);
      setShowRiverPopup(true);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  }

  async function completeRiverOpen() {
    if (!game) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_step: 10,
          info_text: '점수 집계',
          timer_end: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGame(data);
      }
      setShowRiverPopup(false);
      setShowScoreSelectPopup(true);
      setSelectedWinners([]);
      setScoresCalculated(false);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  }

  function toggleWinner(num: number) {
    setSelectedWinners((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  }

  async function completeScoreSelect() {
    if (!game || selectedWinners.length < 1) return;
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
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          players,
          round_winners: roundWinners,
          action_type: 'calculate_scores',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame(data);
        setShowScoreSelectPopup(false);
        setScoresCalculated(true);
      } else {
        alert(data.error || '업데이트 실패');
      }
    } catch (e) {
      console.error(e);
      alert('업데이트 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  function startNextRound() {
    setShowNextRoundConfirmPopup(true);
  }

  async function confirmNextRound() {
    if (!game) return;
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
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_round: nextRound,
          current_step: isRound2Plus ? 2 : 1,
          info_text: isRound2Plus ? '카드 딜링' : '선 정하기',
          current_player: null,
          timer_seconds: 0,
          timer_active: false,
          timer_end: false,
          community_cards: [],
          players,
          action_type: 'start_round',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame(data);
        setShowNextRoundConfirmPopup(false);
        if (isRound2Plus) setShowDealingPopup(true);
      } else {
        alert(data.error || '업데이트 실패');
      }
    } catch (e) {
      console.error(e);
      alert('다음 라운드 진행 중 오류가 발생했습니다. "진행" 버튼으로 다시 시도해보세요.');
    } finally {
      setUpdating(false);
    }
  }

  function showGameEndPopup() {
    setShowGameEndConfirmPopup(true);
  }

  /** 최고 점수 플레이어 번호들 (공동 1등) */
  function getTopScorers(): number[] {
    if (!game?.players?.length) return [];
    const maxScore = Math.max(...game.players.map((p) => p.total_score));
    return game.players.filter((p) => p.total_score === maxScore).map((p) => p.player_number);
  }

  async function confirmGameEnd() {
    if (!game) return;
    setShowGameEndConfirmPopup(false);
    setSelectedCoWinner(null);
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: '결과선택중',
          info_text: '최종 우승자 선택',
          timer_end: true,
          timer_active: false,
          timer_seconds: 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame(data);
        setShowFinalWinnerPopup(true);
      } else {
        alert(data.error || '업데이트 실패');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  }

  async function revealFinalResults() {
    if (!game) return;
    const topScorers = getTopScorers();
    const finalWinners: number[] =
      topScorers.length === 1 && selectedCoWinner != null
        ? [topScorers[0], selectedCoWinner]
        : topScorers;
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: '완료',
          info_text: '게임 종료',
          final_winners: finalWinners,
          timer_end: true,
          timer_active: false,
          timer_seconds: 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame(data);
        setShowFinalWinnerPopup(false);
        setSelectedCoWinner(null);
      } else {
        alert(data.error || '업데이트 실패');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  }

  useEffect(() => {
    if (!game?.timer_active || game.timer_seconds <= 0) return;
    const id = setInterval(async () => {
      const g = game!;
      const next = g.timer_seconds - 1;
      try {
        if (g.current_step === 3) {
          const res = await fetch(`/api/game/${gameId}/update`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              timer_seconds: next,
              timer_active: next > 0,
              timer_end: next <= 0,
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setGame(data);
            if (next <= 0) setShowStrategyEndPopup(true);
          }
        } else if (g.current_step === 7) {
          const res = await fetch(`/api/game/${gameId}/update`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              timer_seconds: next,
              timer_active: next > 0,
              timer_end: next <= 0,
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setGame(data);
            if (next <= 0) setShowStrategy2EndPopup(true);
          }
        } else if (g.current_step === 4 && g.current_player && next <= 0) {
          const order = [...Array(g.player_count)].map((_, i) => {
            const first = g.players.find((p) => p.is_first);
            return first ? ((first.player_number - 1 + i) % g.player_count) + 1 : i + 1;
          });
          const idx = order.indexOf(g.current_player);
          const isLast = idx === order.length - 1;
          const nextPlayer = isLast ? null : order[idx + 1];
          const players = g.players.map((p) =>
            p.player_number === g.current_player ? { ...p, is_candidate: false } : p
          );
          const res = await fetch(`/api/game/${gameId}/update`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              players,
              current_player: nextPlayer,
              timer_seconds: nextPlayer ? DECLARATION_TIME_LIMIT : 0,
              timer_active: !!nextPlayer,
              timer_end: isLast,
              ...(isLast && { current_player: null }),
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setGame(data);
            if (isLast) setShowDeclarationEndPopup(true);
          }
        } else if (g.current_step === 4 && next > 0) {
          const res = await fetch(`/api/game/${gameId}/update`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timer_seconds: next }),
          });
          const data = await res.json();
          if (res.ok) setGame(data);
        } else if (g.current_step === 5 && g.current_player && next <= 0) {
          const candidateOrder = getCandidateOrderFromGame(g);
          const idx = candidateOrder.indexOf(g.current_player);
          const isLast = idx === candidateOrder.length - 1;
          const nextCandidate = isLast ? null : candidateOrder[idx + 1];
          const res = await fetch(`/api/game/${gameId}/update`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              current_player: nextCandidate,
              timer_seconds: nextCandidate ? CANDIDATE_SPEECH_TIME_LIMIT : 0,
              timer_active: !!nextCandidate,
              timer_end: isLast,
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setGame(data);
            if (isLast) setShowCandidateSpeechEndPopup(true);
          }
        } else if (g.current_step === 5 && next > 0) {
          const res = await fetch(`/api/game/${gameId}/update`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timer_seconds: next }),
          });
          const data = await res.json();
          if (res.ok) setGame(data);
        } else if (g.current_step === 7 && next > 0) {
          const res = await fetch(`/api/game/${gameId}/update`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timer_seconds: next }),
          });
          const data = await res.json();
          if (res.ok) setGame(data);
        } else if (g.current_step === 8 && g.current_player && next <= 0) {
          const voterOrder = getVoterOrder(g);
          const idx = voterOrder.indexOf(g.current_player);
          const isLast = idx === voterOrder.length - 1;
          const nextVoter = isLast ? null : voterOrder[idx + 1];
          const roundKey = String(g.current_round);
          const roundVotes = (g.votes?.[roundKey] as Array<{ voter: number; voted_for: number | null }>) || [];
          const newVote = { voter: g.current_player, voted_for: null as number | null };
          const votes = {
            ...g.votes,
            [roundKey]: [...roundVotes, newVote],
          };
          const res = await fetch(`/api/game/${gameId}/update`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              votes,
              current_player: nextVoter,
              timer_seconds: nextVoter ? VOTE_TIME_LIMIT : 0,
              timer_active: !!nextVoter,
              timer_end: isLast,
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setGame(data);
            if (isLast) setShowVoteEndPopup(true);
          }
        } else if (g.current_step === 8 && next > 0) {
          const res = await fetch(`/api/game/${gameId}/update`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timer_seconds: next }),
          });
          const data = await res.json();
          if (res.ok) setGame(data);
        }
      } catch {
        // ignore
      }
    }, 1000);
    return () => clearInterval(id);
  }, [gameId, game?.timer_active, game?.timer_seconds, game?.current_step, game?.current_player]);

  if (typeof window !== 'undefined' && sessionStorage.getItem(ADMIN_STORAGE_KEY) !== '1') {
    router.replace('/game/control');
    return null;
  }

  if (loading || !game) {
    return (
      <div className="control-demo-root">
        <div className="demo-loading">
          {loading ? '로딩 중...' : '게임을 찾을 수 없습니다.'}
        </div>
      </div>
    );
  }

  const players = game.players || [];
  const activeCount = Math.min(game.player_count || 8, 12);
  const gridCols = GRID_COLS[activeCount] ?? 6;
  const phaseText = game.info_text || (STEP_LABELS[game.current_step] ?? `Step ${game.current_step}`);
  const actionGuide = ACTION_GUIDE[game.current_step] ?? '';

  return (
    <div className="control-demo-root">
      {/* 송출 화면 / 로그인 링크 배너 */}
      <div className="demo-banner">
        <span>게임 진행</span>
        <div className="flex items-center gap-3">
          <a
            href={`/game/display?session=${encodeURIComponent(game.session_id)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            송출 화면 열기
          </a>
          <a
            href={`/login?gameId=${gameId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            로그인 화면
          </a>
          <a
            href={`/logout?gameId=${gameId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            로그아웃 화면
          </a>
        </div>
      </div>

      {/* 상단바 */}
      <header className="demo-header">
        <div className="demo-game-code">{game.session_id}</div>
        <div className="demo-round-box">{game.current_round} ROUND</div>
        <div className="demo-header-right flex items-center gap-2">
          <button
            type="button"
            className="demo-undo-btn"
            onClick={handleProceed}
            disabled={updating || !game}
            title={canProceed ? '다음 단계로 진행' : '현재 단계에서 진행 가능한 액션이 없습니다'}
          >
            진행
          </button>
          <button
            type="button"
            className="demo-undo-btn"
            onClick={() => router.push(`/game/edit/${gameId}`)}
            title="비상 시 상태 수정 (송출 레이아웃에서 인라인 편집)"
          >
            Edit
          </button>
          <button
            type="button"
            className="demo-undo-btn"
            onClick={() => {
              if (game) {
                setGoToStepTargetRound(game.current_round);
                setGoToStepTargetStep(game.current_step);
              }
              setShowGoToStepModal(true);
            }}
            disabled={updating || !game}
            title="특정 라운드/단계로 되돌리기"
          >
            단계 이동
          </button>
          <button
            type="button"
            className="demo-undo-btn"
            onClick={handleUndo}
            disabled={updating}
            title="이전 액션 취소"
          >
            Undo
          </button>
        </div>
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
                  ? (game.current_step === 10 ? '라운드 종료' : '종료')
                  : game.timer_seconds > 0
                ? `${Math.floor(game.timer_seconds / 60).toString().padStart(2, '0')}:${(game.timer_seconds % 60).toString().padStart(2, '0')}`
                : '--:--'}
              </div>
            </div>
            {game.status === '완료' && (
              <button
                type="button"
                className="demo-next-round-btn"
                onClick={() => setShowClosingConfirmModal(true)}
                disabled={updating}
              >
                마무리 화면
              </button>
            )}
            {game.status !== '완료' && (((game.current_step === 3 || game.current_step === 4 || game.current_step === 5 || game.current_step === 7 || game.current_step === 8) && game.timer_seconds > 0) || (game.current_step === 10 && scoresCalculated)) && (
              <>
                {(game.current_step === 3 || game.current_step === 7) && (
                  <>
                    <button
                      type="button"
                      className="demo-pause-btn"
                      onClick={toggleTimerPause}
                      disabled={updating}
                    >
                      {game.timer_active ? '일시정지' : '재개'}
                    </button>
                    <button
                      type="button"
                      className="demo-skip-btn"
                      onClick={() => (game.current_step === 3 ? setShowSkipConfirmPopup(true) : setShowSkipStrategy2ConfirmPopup(true))}
                      disabled={updating}
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
                    disabled={updating}
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
                      disabled={updating}
                    >
                      게임 종료
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="demo-next-round-btn"
                      onClick={startNextRound}
                      disabled={updating}
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

        {/* 하단: 플레이어 그리드 */}
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
                    {p.revealed_cards && p.revealed_cards.length >= 1 && (
                      <div className="demo-card-display">
                        {p.revealed_cards.map((c, i) => (
                          <div key={i} className={`demo-card-item ${getCardColor(c)}`}>
                            <span>{formatCard(c).slice(0, 1)}</span>
                            {formatCard(c).slice(1)}
                          </div>
                        ))}
                      </div>
                    )}
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
          <div
            className="demo-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="demo-modal-text">
              1라운드 선 플레이어는 {confirmPlayer}번 플레이어입니다.
            </p>
            <div className="demo-modal-buttons">
              <button
                className="demo-btn-primary"
                onClick={() => setFirstPlayer(confirmPlayer)}
                disabled={updating}
              >
                네
              </button>
              <button
                className="demo-btn-secondary"
                onClick={() => setConfirmPlayer(null)}
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 카드 딜링 안내 팝업 */}
      {showDealingPopup && (
        <div
          className="demo-modal-overlay"
          onClick={() => !updating && setShowDealingPopup(false)}
        >
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">카드를 딜링 후, 한 장의 카드를 공개하고, 3장의 공용 카드를 공개하세요.(플랍)</p>
            <div className="demo-modal-buttons">
              <button
                className="demo-btn-primary"
                onClick={completeDealing}
                disabled={updating}
              >
                완료
              </button>
              <button
                className="demo-btn-secondary"
                onClick={() => setShowDealingPopup(false)}
              >
                닫기 (나중에 진행)
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
              <button
                className="demo-btn-primary"
                onClick={startStrategyMeeting}
                disabled={updating}
              >
                네
              </button>
              <button
                className="demo-btn-secondary"
                onClick={() => setShowStrategyConfirmPopup(false)}
              >
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
              <button
                className="demo-btn-primary"
                onClick={confirmSkipStrategyMeeting}
                disabled={updating}
              >
                예
              </button>
              <button
                className="demo-btn-secondary"
                onClick={() => setShowSkipConfirmPopup(false)}
              >
                아니오
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
              <button
                className="demo-btn-primary demo-btn-large"
                onClick={startDeclaration}
                disabled={updating}
              >
                시작
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
              <button
                className="demo-btn-primary demo-btn-large"
                onClick={startCandidateSpeech}
                disabled={updating}
              >
                시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 후보자 연설 카드 선택 팝업 */}
      {game.current_step === 5 && game.current_player !== null && (
        <div className="demo-modal-overlay demo-modal-overlay">
          <div className="demo-card-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-card-modal-title">
              {game.current_player}번 플레이어 · 선언할 카드 2장을 선택하세요 ({selectedCards.length}/2)
            </p>
            <div className="demo-card-modal-header-row">
              <div className="demo-card-modal-timer">
                {game.timer_seconds > 0
                  ? `${Math.floor(game.timer_seconds / 60).toString().padStart(2, '0')}:${(game.timer_seconds % 60).toString().padStart(2, '0')}`
                  : '00:00'}
              </div>
              <button
                type="button"
                className="demo-pause-btn"
                onClick={toggleTimerPause}
                disabled={updating}
              >
                {game.timer_active ? '일시정지' : '재개'}
              </button>
              <button
                type="button"
                className="demo-btn-primary demo-btn-large demo-card-declare-btn"
                onClick={completeCandidateCardDeclaration}
                disabled={selectedCards.length !== 2 || updating}
              >
                선언 완료
              </button>
            </div>
            <div className="demo-card-grid demo-card-grid-by-suit">
              {CARDS_BY_SUIT.map((card) => (
                <button
                  key={card}
                  type="button"
                  className={`demo-card-btn ${selectedCards.includes(card) ? 'selected' : ''} ${card[0] === 'D' || card[0] === 'H' ? 'red' : 'black'}`}
                  onClick={() => toggleCandidateCard(card)}
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
                onClick={completeCandidateSpeechEnd}
                disabled={updating}
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
              <button
                className="demo-btn-primary"
                onClick={startStrategyMeeting2}
                disabled={updating}
              >
                네
              </button>
              <button
                className="demo-btn-secondary"
                onClick={() => setShowTurnAndStrategy2ConfirmPopup(false)}
              >
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
              <button
                className="demo-btn-primary"
                onClick={async () => {
                  if (!game) return;
                  setUpdating(true);
                  try {
                    const res = await fetch(`/api/game/${gameId}/update`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ timer_end: true, timer_active: false, timer_seconds: 0 }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setGame(data);
                    }
                    setShowSkipStrategy2ConfirmPopup(false);
                    setShowStrategy2EndPopup(true);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setUpdating(false);
                  }
                }}
                disabled={updating}
              >
                예
              </button>
              <button
                className="demo-btn-secondary"
                onClick={() => setShowSkipStrategy2ConfirmPopup(false)}
              >
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
              <button
                className="demo-btn-primary"
                onClick={completeStrategyMeeting2}
                disabled={updating}
              >
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
              <button
                className="demo-btn-primary demo-btn-large"
                onClick={startVote}
                disabled={updating}
              >
                시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 투표 플레이어 선택 팝업 */}
      {game.current_step === 8 && game.current_player !== null && (
        <div className="demo-modal-overlay">
          <div className="demo-vote-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-vote-player">{game.current_player}번 플레이어</p>
            <div className="demo-vote-timer-row">
              <div className="demo-vote-timer">
                {game.timer_seconds > 0
                  ? `${Math.floor(game.timer_seconds / 60).toString().padStart(2, '0')}:${(game.timer_seconds % 60).toString().padStart(2, '0')}`
                  : '00:00'}
              </div>
              <button
                type="button"
                className="demo-pause-btn"
                onClick={toggleTimerPause}
                disabled={updating}
              >
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
                  disabled={updating}
                >
                  {num}번
                </button>
              ))}
            </div>
            <button
              type="button"
              className="demo-vote-abstain-btn"
              onClick={() => handleVote(null)}
              disabled={updating}
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
              <button
                className="demo-btn-primary"
                onClick={completeVoteEnd}
                disabled={updating}
              >
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
              <button
                className="demo-btn-primary"
                onClick={completeRiverOpen}
                disabled={updating}
              >
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
                  disabled={updating}
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
                disabled={selectedWinners.length < 1 || updating}
              >
                선택 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 다음 라운드 확인 팝업 */}
      {showNextRoundConfirmPopup && (
        <div
          className="demo-modal-overlay"
          onClick={() => !updating && setShowNextRoundConfirmPopup(false)}
        >
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">다음 라운드를 진행하시겠습니까?</p>
            <div className="demo-modal-buttons">
              <button
                className="demo-btn-primary"
                onClick={confirmNextRound}
                disabled={updating}
              >
                예
              </button>
              <button
                className="demo-btn-secondary"
                onClick={() => setShowNextRoundConfirmPopup(false)}
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 게임 종료 확인 팝업 */}
      {showGameEndConfirmPopup && (
        <div
          className="demo-modal-overlay"
          onClick={() => !updating && setShowGameEndConfirmPopup(false)}
        >
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-text">게임이 종료되었습니다. 결과를 발표합니다.</p>
            <div className="demo-modal-buttons">
              <button
                className="demo-btn-primary"
                onClick={confirmGameEnd}
                disabled={updating}
              >
                예
              </button>
              <button
                className="demo-btn-secondary"
                onClick={() => setShowGameEndConfirmPopup(false)}
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 최종 우승자 선택 팝업 */}
      {showFinalWinnerPopup && game && (() => {
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
                  disabled={!canReveal || updating}
                >
                  결과 공개
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 출마 선언 플레이어 선택 팝업 */}
      {game.current_step === 4 && game.current_player !== null && (
        <div className="demo-modal-overlay">
          <div className="demo-declaration-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-declaration-player">{game.current_player}번 플레이어</p>
            <div className="demo-declaration-timer-row">
              <div className="demo-declaration-timer">
                {game.timer_seconds > 0
                  ? `${Math.floor(game.timer_seconds / 60).toString().padStart(2, '0')}:${(game.timer_seconds % 60).toString().padStart(2, '0')}`
                  : '00:00'}
              </div>
              <button
                type="button"
                className="demo-pause-btn"
                onClick={toggleTimerPause}
                disabled={updating}
              >
                {game.timer_active ? '일시정지' : '재개'}
              </button>
            </div>
            <div className="demo-declaration-buttons">
              <button
                type="button"
                className="demo-declaration-btn demo-declaration-btn-enter"
                onClick={() => handleDeclarationChoice(true)}
                disabled={updating}
              >
                출마
              </button>
              <button
                type="button"
                className="demo-declaration-btn demo-declaration-btn-pass"
                onClick={() => handleDeclarationChoice(false)}
                disabled={updating}
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
              <button
                className="demo-btn-primary"
                onClick={completeDeclaration}
                disabled={updating}
              >
                완료
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
              <button
                className="demo-btn-primary"
                onClick={completeStrategyMeeting}
                disabled={updating}
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 단계 이동 모달 */}
      {showGoToStepModal && (
        <div
          className="demo-modal-overlay"
          onClick={() => !updating && setShowGoToStepModal(false)}
        >
          <div className="demo-modal demo-edit-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-title">특정 단계로 되돌리기</p>
            <p className="text-sm text-gray-600 mb-4">
              Undo를 반복하여 선택한 라운드/단계 상태로 복원합니다. (점수, 투표 등 포함)
            </p>
            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-1">라운드</label>
                <select
                  value={goToStepTargetRound}
                  onChange={(e) => setGoToStepTargetRound(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  {[1, 2, 3, 4].map((r) => (
                    <option key={r} value={r}>
                      {r}라운드
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">단계</label>
                <select
                  value={goToStepTargetStep}
                  onChange={(e) => setGoToStepTargetStep(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  {Object.entries(STEP_LABELS).map(([step, label]) => (
                    <option key={step} value={step}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="demo-modal-buttons">
              <button
                className="demo-btn-primary"
                onClick={handleGoToStep}
                disabled={updating}
              >
                이동
              </button>
              <button
                className="demo-btn-secondary"
                onClick={() => setShowGoToStepModal(false)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 마무리 화면 송출 확인 모달 */}
      {showClosingConfirmModal && (
        <div
          className="demo-modal-overlay"
          onClick={() => !updating && setShowClosingConfirmModal(false)}
        >
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <p className="demo-modal-title">마무리 화면을 송출하시겠습니까?</p>
            <p className="text-sm text-gray-600 mb-6">
              송출 화면이 피드백 QR 코드 화면으로 전환됩니다.
            </p>
            <div className="demo-modal-buttons">
              <button
                className="demo-btn-primary"
                disabled={updating}
                onClick={async () => {
                  setUpdating(true);
                  try {
                    const res = await fetch(`/api/game/${gameId}/update`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: '마무리' }),
                    });
                    if (res.ok) {
                      setShowClosingConfirmModal(false);
                      await loadGame();
                    }
                  } finally {
                    setUpdating(false);
                  }
                }}
              >
                송출
              </button>
              <button
                className="demo-btn-secondary"
                onClick={() => setShowClosingConfirmModal(false)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
