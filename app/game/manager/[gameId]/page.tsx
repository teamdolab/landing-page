'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Player {
  player_number: number;
  is_first: boolean;
  is_candidate: boolean;
  revealed_cards: string[];
  total_score: number;
  round_scores: number[];
}

interface GameState {
  game_id: string;
  session_id: string;
  player_count: number;
  current_round: number;
  current_step: number;
  status: string;
  players: Player[];
  timer_seconds: number;
  timer_active: boolean;
  current_player: number | null;
  info_text: string;
  community_cards: string[];
  votes: Record<string, any[]>;
  action_history: any[];
}

const SUITS = ['S', 'D', 'C', 'H']; // 스페이드, 다이아, 클로버, 하트
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SUIT_NAMES: Record<string, string> = {
  S: '♠',
  D: '♦',
  C: '♣',
  H: '♥'
};
const SUIT_COLORS: Record<string, string> = {
  S: 'text-black',
  D: 'text-red-500',
  C: 'text-black',
  H: 'text-red-500'
};

export default function GameControlPage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.gameId as string;

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (gameId) {
      loadGameState();
      
      // Realtime 구독
      const channel = supabase
        .channel(`game_${gameId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'game_0a',
            filter: `game_id=eq.${gameId}`
          },
          (payload) => {
            console.log('🎮 진행용 화면 실시간 업데이트:', payload.new);
            setGameState(payload.new as GameState);
          }
        )
        .subscribe((status) => {
          console.log('🎮 진행용 화면 구독 상태:', status);
        });

      return () => {
        console.log('🎮 진행용 화면 구독 해제');
        supabase.removeChannel(channel);
      };
    }
  }, [gameId]);

  // 타이머 카운트다운
  useEffect(() => {
    if (!gameState?.timer_active || !gameState?.timer_seconds) return;

    const interval = setInterval(() => {
      setGameState(prev => {
        if (!prev || !prev.timer_active) return prev;
        const newSeconds = Math.max(0, prev.timer_seconds - 1);
        
        // 타이머가 0이 되면 자동 진행
        if (newSeconds === 0) {
          handleTimerEnd();
        }
        
        return { ...prev, timer_seconds: newSeconds };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState?.timer_active, gameState?.timer_seconds]);

  const loadGameState = async () => {
    try {
      const { data, error } = await supabase
        .from('game_0a')
        .select('*')
        .eq('game_id', gameId)
        .single();

      if (error) throw error;
      console.log('🎮 진행용 화면 로드:', data);
      setGameState(data as GameState);
    } catch (err) {
      console.error('게임 상태 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateGame = async (updates: Partial<GameState>) => {
    try {
      const { error } = await supabase
        .from('game_0a')
        .update(updates)
        .eq('game_id', gameId);

      if (error) throw error;
    } catch (err) {
      console.error('게임 업데이트 실패:', err);
      alert('업데이트 실패: ' + (err as Error).message);
    }
  };

  const addAction = async (actionType: string, playerNumber: number | null, data: any) => {
    try {
      await supabase.rpc('add_poker_action', {
        p_game_id: gameId,
        p_action_type: actionType,
        p_player_number: playerNumber,
        p_action_data: data
      });
    } catch (err) {
      console.error('액션 추가 실패:', err);
    }
  };

  const handleTimerEnd = async () => {
    if (!gameState) return;

    // Step 4: 후보 출마 - 자동 포기
    if (gameState.current_step === 4 && gameState.current_player) {
      await handleCandidacyAction(gameState.current_player, false);
    }
    // Step 5: 후보 연설 - 다음 후보로
    else if (gameState.current_step === 5) {
      const candidates = gameState.players.filter(p => p.is_candidate);
      const currentIdx = candidates.findIndex(p => p.player_number === gameState.current_player);
      if (currentIdx < candidates.length - 1) {
        await updateGame({
          current_player: candidates[currentIdx + 1].player_number,
          timer_seconds: 20,
          info_text: `후보 ${candidates[currentIdx + 1].player_number}번 연설 중`
        });
      } else {
        await updateGame({
          current_step: 6,
          current_player: null,
          timer_active: false,
          info_text: '턴 오픈 대기 중'
        });
      }
    }
    // Step 8: 투표 - 자동 기권
    else if (gameState.current_step === 8 && gameState.current_player) {
      await handleVoteAction(gameState.current_player, null);
    }
  };

  const handleUndo = async () => {
    if (!confirm('마지막 액션을 취소하시겠습니까?')) return;

    try {
      const { data, error } = await supabase.rpc('undo_last_action', {
        p_game_id: gameId
      });

      if (error) throw error;
      alert('취소 완료');
      await loadGameState(); // 상태를 다시 로드하여 step도 업데이트
    } catch (err) {
      console.error('Undo 실패:', err);
      alert('취소 실패: ' + (err as Error).message);
    }
  };

  const handleTimeTravel = async (targetIndex: number) => {
    if (!gameState || !confirm(`히스토리 ${targetIndex + 1}번째 시점으로 되돌리시겠습니까?`)) return;

    try {
      const actionsToUndo = gameState.action_history.length - targetIndex - 1;
      
      for (let i = 0; i < actionsToUndo; i++) {
        await supabase.rpc('undo_last_action', {
          p_game_id: gameId
        });
      }

      alert(`히스토리 ${targetIndex + 1}번째 시점으로 되돌렸습니다.`);
      await loadGameState();
    } catch (err) {
      console.error('타임 트래블 실패:', err);
      alert('되돌리기 실패: ' + (err as Error).message);
    }
  };

  const getActionDescription = (action: any) => {
    switch (action.action_type) {
      case 'start_round':
        return `${action.action_data.round}라운드 시작`;
      case 'select_first':
        return `선 플레이어 선택: P${action.player_number}`;
      case 'dealing_complete':
        return '카드 딜링 완료';
      case 'strategy_meeting_1_start':
        return '전략회의 I 시작';
      case 'strategy_meeting_1_end':
        return '전략회의 I 종료';
      case 'candidacy':
        return `P${action.player_number} ${action.action_data.is_candidate ? '출마' : '포기'}`;
      case 'reveal_cards':
        return `P${action.player_number} 카드 공개: ${action.action_data.cards.join(', ')}`;
      case 'turn_open':
        return '턴 오픈';
      case 'strategy_meeting_2_start':
        return '전략회의 II 시작';
      case 'strategy_meeting_2_end':
        return '전략회의 II 종료';
      case 'vote':
        return `P${action.player_number} → ${action.action_data.voted_for ? `P${action.action_data.voted_for}` : '기권'}`;
      case 'calculate_scores':
        return `점수 집계 (승자: P${action.action_data.winner})`;
      case 'next_round':
        return '다음 라운드로';
      default:
        return action.action_type;
    }
  };

  const openDisplayScreen = () => {
    window.open(
      `/game/display/${gameId}`,
      'displayScreen',
      'width=1920,height=1080'
    );
  };

  // Step 0: 라운드 시작
  const handleStartRound = async () => {
    if (!confirm(`${gameState?.current_round}라운드를 시작하시겠습니까?`)) return;

    await addAction('start_round', null, { round: gameState?.current_round });
    await updateGame({
      current_step: 1,
      status: '진행중',
      info_text: '카드 딜링'
    });
    await loadGameState();
  };

  // Step 1: 선 플레이어 선택
  const handleSelectFirstPlayer = async (playerNumber: number) => {
    if (!confirm(`${playerNumber}번 플레이어를 선 플레이어로 지정하시겠습니까?`)) return;

    const updatedPlayers = gameState!.players.map(p => ({
      ...p,
      is_first: p.player_number === playerNumber,
      is_candidate: false,
      revealed_cards: []
    }));

    await addAction('select_first', playerNumber, {});
    await updateGame({
      players: updatedPlayers,
      current_step: 2,
      info_text: '카드 딜링'
    });
    await loadGameState();
  };

  // Step 2: 카드 딜링 완료
  const handleDealingComplete = async () => {
    if (!confirm('카드 딜링과 플랍 오픈이 완료되었습니까?')) return;

    await addAction('dealing_complete', null, {});
    await updateGame({
      current_step: 3,
      info_text: '전략회의 I'
    });
    await loadGameState();
  };

  // Step 3: 전략회의 I 시작
  const handleStrategyMeeting1 = async () => {
    if (!confirm('전략회의 I(8분)을 시작하시겠습니까?')) return;

    await addAction('strategy_meeting_1_start', null, {});
    await updateGame({
      timer_seconds: 480,
      timer_active: true,
      info_text: '전략회의 I'
    });
    await loadGameState();
  };

  const handleEndStrategyMeeting1 = async () => {
    if (!confirm('전략회의 I을 종료하고 후보 출마를 시작하시겠습니까?')) return;

    const firstPlayer = gameState!.players.find(p => p.is_first)!;

    await addAction('strategy_meeting_1_end', null, {});
    await updateGame({
      current_step: 4,
      current_player: firstPlayer.player_number,
      timer_seconds: 20,
      timer_active: true,
      info_text: '출마 선언'
    });
    await loadGameState();
  };

  // Step 4: 후보 출마
  const handleCandidacyAction = async (playerNumber: number, isCandidate: boolean) => {
    const updatedPlayers = gameState!.players.map(p =>
      p.player_number === playerNumber ? { ...p, is_candidate: isCandidate } : p
    );

    await addAction('candidacy', playerNumber, { is_candidate: isCandidate });

    const nextPlayer = gameState!.players.find(
      p => p.player_number > playerNumber
    ) || gameState!.players[0];

    const isLastPlayer = playerNumber === gameState!.player_count;

    if (isLastPlayer) {
      const candidates = updatedPlayers.filter(p => p.is_candidate);
      if (candidates.length === 0) {
        alert('후보자가 없습니다!');
        return;
      }

      const firstCandidate = candidates[0];
      await updateGame({
        players: updatedPlayers,
        current_step: 5,
        current_player: firstCandidate.player_number,
        timer_seconds: 20,
        info_text: '후보자 발언'
      });
    } else {
      await updateGame({
        players: updatedPlayers,
        current_player: nextPlayer.player_number,
        timer_seconds: 20,
        info_text: '출마 선언'
      });
    }
    await loadGameState();
  };

  // Step 5: 후보 연설 (카드 선택)
  const handleRevealCards = async (playerNumber: number, cards: string[]) => {
    if (cards.length !== 2) {
      alert('카드를 정확히 2장 선택해주세요.');
      return;
    }

    const updatedPlayers = gameState!.players.map(p =>
      p.player_number === playerNumber ? { ...p, revealed_cards: cards } : p
    );

    await addAction('reveal_cards', playerNumber, { cards });

    const candidates = updatedPlayers.filter(p => p.is_candidate);
    const currentIdx = candidates.findIndex(p => p.player_number === playerNumber);

    if (currentIdx < candidates.length - 1) {
      const nextCandidate = candidates[currentIdx + 1];
      await updateGame({
        players: updatedPlayers,
        current_player: nextCandidate.player_number,
        timer_seconds: 20,
        info_text: '후보자 발언'
      });
    } else {
      await updateGame({
        players: updatedPlayers,
        current_step: 6,
        current_player: null,
        timer_active: false,
        info_text: '후보자 발언'
      });
    }

    setSelectedCards([]);
    await loadGameState();
  };

  // Step 6: 턴 오픈
  const handleTurnOpen = async () => {
    if (!confirm('턴 오픈이 완료되었습니까?')) return;

    await addAction('turn_open', null, {});
    await updateGame({
      current_step: 7,
      info_text: '전략회의 II'
    });
    await loadGameState();
  };

  // Step 7: 전략회의 II
  const handleStrategyMeeting2 = async () => {
    if (!confirm('전략회의 II(8분)을 시작하시겠습니까?')) return;

    await addAction('strategy_meeting_2_start', null, {});
    await updateGame({
      timer_seconds: 480,
      timer_active: true,
      info_text: '전략회의 II'
    });
    await loadGameState();
  };

  const handleEndStrategyMeeting2 = async () => {
    if (!confirm('전략회의 II를 종료하고 투표를 시작하시겠습니까?')) return;

    const voters = gameState!.players.filter(p => !p.is_candidate);
    const firstVoter = voters[0];

    await addAction('strategy_meeting_2_end', null, {});
    await updateGame({
      current_step: 8,
      current_player: firstVoter.player_number,
      timer_seconds: 20,
      timer_active: true,
      info_text: '유권자 투표'
    });
    await loadGameState();
  };

  // Step 8: 투표
  const handleVoteAction = async (voterNumber: number, votedFor: number | null) => {
    const currentVotes = gameState!.votes[gameState!.current_round.toString()] || [];
    const updatedVotes = {
      ...gameState!.votes,
      [gameState!.current_round.toString()]: [
        ...currentVotes,
        { voter: voterNumber, voted_for: votedFor }
      ]
    };

    await addAction('vote', voterNumber, { voted_for: votedFor });

    const voters = gameState!.players.filter(p => !p.is_candidate);
    const currentIdx = voters.findIndex(p => p.player_number === voterNumber);

    if (currentIdx < voters.length - 1) {
      const nextVoter = voters[currentIdx + 1];
      await updateGame({
        votes: updatedVotes,
        current_player: nextVoter.player_number,
        timer_seconds: 20,
        info_text: '유권자 투표'
      });
    } else {
      await updateGame({
        votes: updatedVotes,
        current_step: 9,
        current_player: null,
        timer_active: false,
        info_text: '결과'
      });
    }
    await loadGameState();
  };

  // Step 9: 점수 집계
  const handleCalculateScores = async () => {
    if (!confirm('점수를 집계하시겠습니까?')) return;

    const votes = gameState!.votes[gameState!.current_round.toString()] || [];
    const voteCounts: Record<number, number> = {};
    
    votes.forEach((vote: any) => {
      if (vote.voted_for !== null) {
        voteCounts[vote.voted_for] = (voteCounts[vote.voted_for] || 0) + 1;
      }
    });

    const winner = Object.entries(voteCounts).reduce((a, b) => 
      b[1] > a[1] ? b : a
    , ['0', 0]);

    const winnerNumber = parseInt(winner[0]);
    const winnerVotes = winner[1];

    const updatedPlayers = gameState!.players.map(p => {
      let roundScore = 0;
      if (p.player_number === winnerNumber) {
        roundScore = 10 + winnerVotes;
      } else if (voteCounts[p.player_number]) {
        roundScore = voteCounts[p.player_number];
      }

      const newRoundScores = [...p.round_scores];
      newRoundScores[gameState!.current_round - 1] = roundScore;

      return {
        ...p,
        round_scores: newRoundScores,
        total_score: p.total_score + roundScore
      };
    });

    await addAction('calculate_scores', null, { winner: winnerNumber, votes: voteCounts });
    await updateGame({
      players: updatedPlayers,
      current_step: 10,
      info_text: '결과'
    });
    await loadGameState();
  };

  // Step 10: 다음 라운드
  const handleNextRound = async () => {
    if (gameState!.current_round >= 4) {
      if (!confirm('게임을 종료하시겠습니까?')) return;
      
      await updateGame({
        status: '완료',
        info_text: '게임 종료!'
      });
      await loadGameState();
      return;
    }

    if (!confirm('다음 라운드로 진행하시겠습니까?')) return;

    await addAction('next_round', null, { round: gameState!.current_round });
    await updateGame({
      current_round: gameState!.current_round + 1,
      current_step: 0,
      info_text: '카드 딜링'
    });
    await loadGameState();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-2xl">로딩 중...</div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-4">게임을 찾을 수 없습니다</div>
          <button
            onClick={() => router.push('/game/manager')}
            className="px-6 py-3 bg-orange-500 rounded-lg"
          >
            게임 목록으로
          </button>
        </div>
      </div>
    );
  }

  const currentPlayer = gameState.players.find(p => p.player_number === gameState.current_player);
  const candidates = gameState.players.filter(p => p.is_candidate);
  const voters = gameState.players.filter(p => !p.is_candidate);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* 헤더 */}
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">🎮 대선포커 진행</h1>
            <div className="flex gap-6 text-sm text-gray-400">
              <span>세션: {gameState.session_id}</span>
              <span>플레이어: {gameState.player_count}명</span>
              <span className="text-orange-400 font-bold">라운드: {gameState.current_round}/4</span>
              <span>단계: {gameState.current_step}</span>
              <span>상태: {gameState.status}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors text-lg"
            >
              🕐 히스토리 {showHistory ? '닫기' : '열기'}
            </button>
            <button
              onClick={openDisplayScreen}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition-colors text-lg"
            >
              📺 송출 화면
            </button>
            <button
              onClick={handleUndo}
              disabled={!gameState.action_history || gameState.action_history.length === 0}
              className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-lg"
            >
              ↩️ Undo
            </button>
            <button
              onClick={() => router.push('/game/manager')}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors text-lg"
            >
              ← 목록
            </button>
          </div>
        </div>
      </div>

      {/* 타이머 */}
      {gameState.timer_active && (
        <div className="bg-red-900 border-4 border-red-500 rounded-xl p-6 mb-6">
          <div className="text-center">
            <div className="text-6xl font-bold text-white mb-2">
              {Math.floor(gameState.timer_seconds / 60)}:{String(gameState.timer_seconds % 60).padStart(2, '0')}
            </div>
            <div className="text-xl text-red-200">타이머 작동 중</div>
          </div>
        </div>
      )}

      {/* 히스토리 패널 (크로노브레이크) */}
      {showHistory && (
        <div className="bg-gray-800 border-2 border-cyan-500 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-cyan-400">🕐 게임 히스토리 (크로노브레이크)</h2>
            <span className="text-gray-400">총 {gameState.action_history?.length || 0}개 액션</span>
          </div>
          
          <div className="max-h-96 overflow-y-auto space-y-2">
            {gameState.action_history && gameState.action_history.length > 0 ? (
              [...gameState.action_history].reverse().map((action, idx) => {
                const actualIndex = gameState.action_history.length - 1 - idx;
                const isLatest = idx === 0;
                return (
                  <div
                    key={actualIndex}
                    className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                      isLatest 
                        ? 'bg-cyan-900 border-2 border-cyan-400' 
                        : 'bg-gray-700 hover:bg-gray-600 cursor-pointer'
                    }`}
                    onClick={() => !isLatest && handleTimeTravel(actualIndex)}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`font-mono text-sm ${isLatest ? 'text-cyan-400' : 'text-gray-400'}`}>
                        #{actualIndex + 1}
                      </span>
                      <span className={`font-bold ${isLatest ? 'text-white' : 'text-gray-300'}`}>
                        {getActionDescription(action)}
                      </span>
                      {isLatest && (
                        <span className="px-3 py-1 bg-cyan-500 text-black text-xs font-bold rounded-full">
                          현재
                        </span>
                      )}
                    </div>
                    {!isLatest && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTimeTravel(actualIndex);
                        }}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-bold transition-colors"
                      >
                        ⏪ 여기로 되돌리기
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center text-gray-500 py-8">
                아직 히스토리가 없습니다
              </div>
            )}
          </div>
          
          <div className="mt-4 p-4 bg-gray-900 rounded-lg">
            <p className="text-sm text-gray-400">
              💡 <strong>크로노브레이크:</strong> 원하는 시점을 클릭하면 그 순간으로 되돌릴 수 있습니다. 
              게임 상태(step, 플레이어 정보, 점수 등)가 모두 해당 시점으로 복원됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 정보 패널 */}
      <div className="bg-blue-900 border-2 border-blue-500 rounded-xl p-6 mb-6">
        <div className="text-2xl font-bold text-blue-100">
          📋 {gameState.info_text || '게임을 시작하세요'}
        </div>
      </div>

      {/* 메인 컨트롤 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 주요 액션 버튼들 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-800 rounded-xl p-8">
            <h2 className="text-3xl font-bold mb-6">게임 진행</h2>

            {/* Step 0: 라운드 시작 */}
            {gameState.current_step === 0 && (
              <button
                onClick={handleStartRound}
                className="w-full py-8 bg-green-600 hover:bg-green-700 rounded-xl text-3xl font-bold transition-colors"
              >
                🎯 {gameState.current_round}라운드 시작
              </button>
            )}

            {/* Step 1: 선 플레이어 선택 */}
            {gameState.current_step === 1 && (
              <div>
                <h3 className="text-2xl font-bold mb-4">선 플레이어를 선택하세요</h3>
                <div className="grid grid-cols-4 gap-4">
                  {gameState.players.map(player => (
                    <button
                      key={player.player_number}
                      onClick={() => handleSelectFirstPlayer(player.player_number)}
                      className="py-8 bg-red-600 hover:bg-red-700 rounded-xl text-3xl font-bold transition-colors"
                    >
                      P{player.player_number}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: 카드 딜링 */}
            {gameState.current_step === 2 && (
              <button
                onClick={handleDealingComplete}
                className="w-full py-8 bg-blue-600 hover:bg-blue-700 rounded-xl text-3xl font-bold transition-colors"
              >
                🃏 카드 딜링 & 플랍 오픈 완료
              </button>
            )}

            {/* Step 3: 전략회의 I */}
            {gameState.current_step === 3 && (
              <div className="space-y-4">
                {!gameState.timer_active ? (
                  <button
                    onClick={handleStrategyMeeting1}
                    className="w-full py-8 bg-purple-600 hover:bg-purple-700 rounded-xl text-3xl font-bold transition-colors"
                  >
                    💭 전략회의 I 시작 (8분)
                  </button>
                ) : (
                  <button
                    onClick={handleEndStrategyMeeting1}
                    className="w-full py-8 bg-orange-600 hover:bg-orange-700 rounded-xl text-3xl font-bold transition-colors"
                  >
                    ✅ 전략회의 I 종료
                  </button>
                )}
              </div>
            )}

            {/* Step 4: 후보 출마 */}
            {gameState.current_step === 4 && currentPlayer && (
              <div>
                <h3 className="text-2xl font-bold mb-4">
                  P{currentPlayer.player_number}번 플레이어 - 출마 선언
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <button
                    onClick={() => handleCandidacyAction(currentPlayer.player_number, true)}
                    className="py-12 bg-green-600 hover:bg-green-700 rounded-xl text-4xl font-bold transition-colors"
                  >
                    ✅ 출마
                  </button>
                  <button
                    onClick={() => handleCandidacyAction(currentPlayer.player_number, false)}
                    className="py-12 bg-red-600 hover:bg-red-700 rounded-xl text-4xl font-bold transition-colors"
                  >
                    ❌ 포기
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: 후보 연설 (카드 선택) */}
            {gameState.current_step === 5 && currentPlayer && (
              <div>
                <h3 className="text-2xl font-bold mb-4">
                  후보 P{currentPlayer.player_number}번 - 카드 2장 선택 ({selectedCards.length}/2)
                </h3>
                <div className="grid grid-cols-9 gap-3 mb-6">
                  {RANKS.map(rank => (
                    SUITS.map(suit => {
                      const card = `${suit}${rank}`;
                      const isSelected = selectedCards.includes(card);
                      return (
                        <button
                          key={card}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCards(prev => prev.filter(c => c !== card));
                            } else if (selectedCards.length < 2) {
                              setSelectedCards(prev => [...prev, card]);
                            }
                          }}
                          className={`py-6 rounded-lg text-2xl font-bold transition-all ${
                            isSelected
                              ? 'bg-orange-500 scale-110 border-4 border-yellow-400'
                              : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          <div className={SUIT_COLORS[suit]}>{SUIT_NAMES[suit]}</div>
                          <div>{rank}</div>
                        </button>
                      );
                    })
                  ))}
                </div>
                <button
                  onClick={() => handleRevealCards(currentPlayer.player_number, selectedCards)}
                  disabled={selectedCards.length !== 2}
                  className="w-full py-8 bg-orange-600 hover:bg-orange-700 rounded-xl text-3xl font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ✅ 카드 공개 확정
                </button>
              </div>
            )}

            {/* Step 6: 턴 오픈 */}
            {gameState.current_step === 6 && (
              <button
                onClick={handleTurnOpen}
                className="w-full py-8 bg-blue-600 hover:bg-blue-700 rounded-xl text-3xl font-bold transition-colors"
              >
                🃏 턴 오픈 완료
              </button>
            )}

            {/* Step 7: 전략회의 II */}
            {gameState.current_step === 7 && (
              <div className="space-y-4">
                {!gameState.timer_active ? (
                  <button
                    onClick={handleStrategyMeeting2}
                    className="w-full py-8 bg-purple-600 hover:bg-purple-700 rounded-xl text-3xl font-bold transition-colors"
                  >
                    💭 전략회의 II 시작 (8분)
                  </button>
                ) : (
                  <button
                    onClick={handleEndStrategyMeeting2}
                    className="w-full py-8 bg-orange-600 hover:bg-orange-700 rounded-xl text-3xl font-bold transition-colors"
                  >
                    ✅ 전략회의 II 종료
                  </button>
                )}
              </div>
            )}

            {/* Step 8: 투표 */}
            {gameState.current_step === 8 && currentPlayer && (
              <div>
                <h3 className="text-2xl font-bold mb-4">
                  P{currentPlayer.player_number}번 유권자 - 투표
                </h3>
                <div className="grid grid-cols-3 gap-6">
                  {candidates.map(candidate => (
                    <button
                      key={candidate.player_number}
                      onClick={() => handleVoteAction(currentPlayer.player_number, candidate.player_number)}
                      className="py-12 bg-green-600 hover:bg-green-700 rounded-xl text-4xl font-bold transition-colors"
                    >
                      P{candidate.player_number}
                      <div className="text-sm mt-2">
                        {candidate.revealed_cards.join(', ')}
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => handleVoteAction(currentPlayer.player_number, null)}
                    className="py-12 bg-gray-600 hover:bg-gray-700 rounded-xl text-4xl font-bold transition-colors"
                  >
                    기권
                  </button>
                </div>
              </div>
            )}

            {/* Step 9: 점수 집계 */}
            {gameState.current_step === 9 && (
              <button
                onClick={handleCalculateScores}
                className="w-full py-8 bg-yellow-600 hover:bg-yellow-700 rounded-xl text-3xl font-bold transition-colors"
              >
                📊 점수 집계
              </button>
            )}

            {/* Step 10: 다음 라운드 */}
            {gameState.current_step === 10 && (
              <button
                onClick={handleNextRound}
                className="w-full py-8 bg-green-600 hover:bg-green-700 rounded-xl text-3xl font-bold transition-colors"
              >
                {gameState.current_round >= 4 ? '🏁 게임 종료' : '➡️ 다음 라운드'}
              </button>
            )}
          </div>
        </div>

        {/* 오른쪽: 플레이어 상태 */}
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-2xl font-bold mb-4">플레이어 상태</h3>
            <div className="space-y-3 max-h-[800px] overflow-y-auto">
              {gameState.players.map(player => (
                <div
                  key={player.player_number}
                  className={`p-4 rounded-lg border-2 ${
                    player.is_first
                      ? 'bg-red-900 border-red-500'
                      : player.is_candidate
                      ? 'bg-orange-900 border-orange-500'
                      : 'bg-gray-700 border-gray-600'
                  } ${
                    player.player_number === gameState.current_player
                      ? 'ring-4 ring-yellow-400 animate-pulse'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-2xl">
                      P{player.player_number}
                      {player.is_first && ' 先'}
                      {player.is_candidate && ' 후보'}
                    </span>
                    <span className="text-yellow-400 font-bold text-xl">
                      {player.total_score}점
                    </span>
                  </div>
                  <div className="text-sm text-gray-300">
                    라운드: [{player.round_scores.join(', ')}]
                  </div>
                  {player.revealed_cards.length > 0 && (
                    <div className="mt-2 text-lg font-bold text-orange-300">
                      공개: {player.revealed_cards.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
