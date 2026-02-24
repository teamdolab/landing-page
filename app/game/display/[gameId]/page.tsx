'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import './styles.css';

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
}

export default function GameDisplayPage() {
  const params = useParams();
  const gameId = params.gameId as string;

  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    if (gameId) {
      loadGameState();
      
      // Realtime 구독
      const channel = supabase
        .channel(`display_${gameId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'game_0a',
            filter: `game_id=eq.${gameId}`
          },
          (payload) => {
            console.log('🔴 송출용 화면 실시간 업데이트:', payload.new);
            setGameState(payload.new as GameState);
          }
        )
        .subscribe((status) => {
          console.log('🔴 송출용 화면 구독 상태:', status);
        });

      return () => {
        console.log('🔴 송출용 화면 구독 해제');
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
        return {
          ...prev,
          timer_seconds: Math.max(0, prev.timer_seconds - 1)
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState?.timer_active]);

  const loadGameState = async () => {
    try {
      const { data, error } = await supabase
        .from('game_0a')
        .select('*')
        .eq('game_id', gameId)
        .single();

      if (error) throw error;
      console.log('🔴 송출용 화면 로드:', data);
      setGameState(data as GameState);
    } catch (err) {
      console.error('게임 상태 로드 실패:', err);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getCardColor = (card: string) => {
    if (!card || card.length < 2) return 'black';
    const suit = card[0];
    return (suit === 'D' || suit === 'H') ? 'red' : 'black';
  };

  const getPhaseText = (step: number): string => {
    switch (step) {
      case 0: return '게임 시작';
      case 1: return '게임 시작';
      case 2: return '카드 딜링';
      case 3: return '전략회의 I';
      case 4: return '출마 선언';
      case 5: return '후보자 발언';
      case 6: return '후보자 발언';
      case 7: return '전략회의 II';
      case 8: return '유권자 투표';
      case 9: return '결과';
      case 10: return '결과';
      default: return '진행 중';
    }
  };

  if (!gameState) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '32px',
        fontWeight: 'bold',
        color: '#666'
      }}>
        게임을 불러오는 중...
      </div>
    );
  }

  const currentVotes = gameState.votes[gameState.current_round.toString()] || [];
  const SUIT_SYMBOLS: Record<string, string> = { S: '♠', D: '♦', H: '♥', C: '♣' };

  // 각 후보자가 받은 투표자 목록 계산
  const candidateVoters: Record<number, number[]> = {};
  currentVotes.forEach((vote: any) => {
    if (vote.voted_for !== null) {
      if (!candidateVoters[vote.voted_for]) {
        candidateVoters[vote.voted_for] = [];
      }
      candidateVoters[vote.voted_for].push(vote.voter);
    }
  });

  return (
    <div>
      {/* Visual FX */}
      <div className="scanlines"></div>
      <div className="hud-corner hud-tl"></div>
      <div className="hud-corner hud-tr"></div>
      <div className="hud-corner hud-bl"></div>
      <div className="hud-corner hud-br"></div>

      {/* 1. Header */}
      <header className="header">
        <div className="brand-box">
          <span className="brand-main">DO:LAB</span>
          <span className="brand-sub">NEON PROJECT</span>
        </div>
        <div className="title-frame">
          <h1 className="game-title">대선 포커</h1>
        </div>
        <div className="round-box">{gameState.current_round} ROUND</div>
      </header>

      {/* 2. Main Body */}
      <main className="main-content">
        
        {/* Upper Section: Info */}
        <section className="info-section">
          <div className="phase-container">
            <div className="phase-current">
              {getPhaseText(gameState.current_step)}
            </div>
          </div>
          <div className="timer-wrapper">
            <div className="timer-container">
              <div className="timer-value">
                {gameState.timer_active ? formatTimer(gameState.timer_seconds) : '--:--'}
              </div>
            </div>
          </div>
          <div className="ranking-container">
            <div className="ranking-header">HAND RANKINGS</div>
            <ul className="ranking-list">
              <li className="rank-item s-tier">스트레이트 플러쉬</li>
              <li className="rank-item s-tier">포카드</li>
              <li className="rank-item a-tier">플러쉬</li>
              <li className="rank-item a-tier">풀하우스</li>
              <li className="rank-item b-tier">스트레이트</li>
              <li className="rank-item b-tier">트리플</li>
              <li className="rank-item c-tier">투페어</li>
              <li className="rank-item c-tier">원페어</li>
            </ul>
          </div>
        </section>

        {/* Lower Section: Details (Grid Layout: 2 Rows x 6 Cols) */}
        <section className="detail-section">
          {gameState.players.map((player) => {
            const isActive = gameState.current_player === player.player_number;
            const voters = candidateVoters[player.player_number] || [];

            return (
              <div key={player.player_number} className="player-col">
                {/* Player Box & First Player Badge & Active Status */}
                <div className="avatar-wrapper">
                  {player.is_first && (
                    <div className="first-player-badge">先</div>
                  )}
                  <div className={`node-box ${isActive ? 'active-action' : ''}`}>
                    <i className="fa-solid fa-user player-icon"></i>
                    <span className="player-num">{player.player_number}</span>
                  </div>
                </div>

                {/* Score */}
                <div className="score-box">{player.total_score}</div>

                {/* Candidate Badge */}
                {player.is_candidate && (
                  <>
                    <div className="candidate-badge">후보</div>
                    
                    {/* Revealed Cards */}
                    {player.revealed_cards && player.revealed_cards.length === 2 && (
                      <div className="card-display">
                        {player.revealed_cards.map((card, idx) => {
                          if (!card) return null;
                          const suit = card[0];
                          const rank = card.slice(1);
                          const color = getCardColor(card);
                          return (
                            <div key={idx} className={`card-item ${color}`}>
                              <span>{SUIT_SYMBOLS[suit] || suit}</span>
                              {rank}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Voter Coins Grid */}
                    {voters.length > 0 && (
                      <div className="voter-grid">
                        {voters.map((voterId, idx) => (
                          <div key={idx} className="voter-coin">{voterId}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </section>

      </main>
    </div>
  );
}
