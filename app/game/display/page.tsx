'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import './styles.css';

type GameState = {
  round: number;
  step: number;
  phase: string;
  first_player: number | null;
  current_player: number | null;
  timer_seconds: number;
  timer_active: boolean;
  community_cards: string[];
};

type Player = {
  player_number: number;
  revealed_cards: string[]; // 후보자가 주장한 카드 (실제 카드와 다를 수 있음)
  status: 'run' | 'giveup' | null;
  vote_to: number | null;
  total_score: number;
  round_score: number;
  is_first_player: boolean;
};

export default function GameDisplayPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    round: 1,
    step: 1,
    phase: '대기 중',
    first_player: null,
    current_player: null,
    timer_seconds: 0,
    timer_active: false,
    community_cards: [],
  });
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerCount, setPlayerCount] = useState(12);

  // URL에서 세션 ID 가져오기
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session');
    if (sid) {
      setSessionId(sid);
    } else {
      // 세션 ID가 없으면 최신 세션 가져오기
      loadLatestSession();
    }
  }, []);

  async function loadLatestSession() {
    const { data } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('status', 'playing')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (data) {
      setSessionId(data.id);
    }
  }

  // 실시간 구독
  useEffect(() => {
    if (!sessionId) return;

    // 초기 데이터 로드
    loadGameData();

    // Realtime 구독
    const channel = supabase
      .channel('game-display')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'game_state', filter: `session_id=eq.${sessionId}` },
        () => loadGameData()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `session_id=eq.${sessionId}` },
        () => loadPlayers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // 타이머 카운트다운
  useEffect(() => {
    if (!gameState.timer_active || gameState.timer_seconds <= 0) return;

    const interval = setInterval(() => {
      setGameState(prev => ({
        ...prev,
        timer_seconds: Math.max(0, prev.timer_seconds - 1),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.timer_active, gameState.timer_seconds]);

  async function loadGameData() {
    if (!sessionId) return;

    const { data } = await supabase
      .from('game_state')
      .select('*')
      .eq('session_id', sessionId)
      .single();
    
    if (data) {
      // community_cards가 배열인지 확인하고 필터링
      let communityCards: string[] = [];
      if (Array.isArray(data.community_cards)) {
        communityCards = data.community_cards.filter((card: any) => card && typeof card === 'string');
      }

      setGameState({
        round: data.round || 1,
        step: data.step || 1,
        phase: data.phase || '대기 중',
        first_player: data.first_player || null,
        current_player: data.current_player || null,
        timer_seconds: data.timer_seconds || 0,
        timer_active: data.timer_active || false,
        community_cards: communityCards,
      });
    }

    await loadPlayers();
  }

  async function loadPlayers() {
    if (!sessionId) return;

    const { data } = await supabase
      .from('game_players')
      .select('*')
      .eq('session_id', sessionId)
      .order('player_number');
    
    if (data) {
      // revealed_cards가 배열인지 확인하고 필터링
      const cleanedData = data.map(player => ({
        ...player,
        revealed_cards: Array.isArray(player.revealed_cards) 
          ? player.revealed_cards.filter((card: any) => card && typeof card === 'string')
          : [],
      }));
      
      setPlayers(cleanedData);
      setPlayerCount(cleanedData.length);
    }
  }

  // 타이머 표시 형식
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 카드 표시 형식 (S2 → ♠2)
  const formatCard = (card: string | null | undefined) => {
    if (!card || typeof card !== 'string' || card.length < 2) return '';
    const suit = card[0];
    const rank = card.slice(1);
    const suitSymbol: {[key: string]: string} = { S: '♠', D: '♦', H: '♥', C: '♣' };
    return `${suitSymbol[suit] || suit}${rank}`;
  };

  const getCardColor = (card: string | null | undefined) => {
    if (!card || typeof card !== 'string' || card.length < 2) return 'black';
    const suit = card[0];
    return (suit === 'D' || suit === 'H') ? 'red' : 'black';
  };

  return (
    <div className="game-display">
      {/* 스캔라인 효과 */}
      <div className="scanlines" />
      
      {/* HUD 코너 */}
      <div className="hud-corner hud-tl" />
      <div className="hud-corner hud-tr" />
      <div className="hud-corner hud-bl" />
      <div className="hud-corner hud-br" />

      {/* 헤더 */}
      <header className="header">
        <div className="brand-box">
          <span className="brand-main">DO:LAB</span>
          <span className="brand-sub">NEON PROJECT</span>
        </div>
        <div className="title-frame">
          <h1 className="game-title">대선 포커</h1>
        </div>
        <div className="round-box">{gameState.round} ROUND</div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="main-content">
        
        {/* 상단: 라운드 단계 + 타이머 + 랭킹 */}
        <section className="info-section">
          
          {/* 좌측: 라운드 단계 (세로) */}
          <div className="phase-display">
            <span className="phase-label">ROUND {gameState.round}</span>
            <span className="phase-current">{gameState.phase}</span>
          </div>

          {/* 중앙: 타이머 (항상 표시) */}
          <div className="timer-container">
            {gameState.timer_active ? (
              <div className="timer-value">{formatTimer(gameState.timer_seconds)}</div>
            ) : (
              <div className="timer-value" style={{ fontSize: '32px', color: '#999' }}>--:--</div>
            )}
          </div>

          {/* 우측: 핸드 랭킹 */}
          <div className="ranking-container">
            <div className="ranking-header">HAND RANKINGS</div>
            <ul className="ranking-list">
              <li className="rank-item s-tier">스트레이트 플러쉬</li>
              <li className="rank-item a-tier">플러쉬</li>
              <li className="rank-item b-tier">스트레이트</li>
              <li className="rank-item c-tier">투페어</li>
              <li className="rank-item s-tier">포카드</li>
              <li className="rank-item a-tier">풀하우스</li>
              <li className="rank-item b-tier">트리플</li>
              <li className="rank-item c-tier">원페어</li>
            </ul>
          </div>
        </section>

        {/* 하단: 테이블 영역 */}
        <section className="table-section">
          
          {/* 포커 테이블 */}
          <div className="poker-table">
            <div className="table-label">DO:LAB ARENA</div>
          </div>

          {/* 커뮤니티 카드 (큰 문양 + 숫자) */}
          {gameState.community_cards && gameState.community_cards.length > 0 && (
            <div className="community-cards">
              {gameState.community_cards.map((card, idx) => {
                if (!card) return null;
                const suit = card[0];
                const rank = card.slice(1);
                const suitSymbol: {[key: string]: string} = { S: '♠', D: '♦', H: '♥', C: '♣' };
                return (
                  <div key={idx} className={`community-card ${getCardColor(card)}`}>
                    <div className="card-suit">{suitSymbol[suit] || suit}</div>
                    <div className="card-rank">{rank}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 딜러 */}
          <div className="dealer-box">
            <div className="dealer-avatar">딜러</div>
          </div>

          {/* 투표 코인 (테이블 중앙 안쪽 - 실시간 업데이트) */}
          {gameState.step >= 9 && players.some(p => p.vote_to && p.vote_to > 0) && (
            <div className="vote-coins">
              {players
                .filter(p => p.vote_to && p.vote_to > 0)
                .map((voter) => (
                  <div key={`vote-${voter.player_number}`} className="vote-coin">
                    {voter.player_number}
                  </div>
                ))
              }
            </div>
          )}

          {/* 플레이어들 */}
          {players.map((player) => {
            const posClass = `pos-${player.player_number}`;
            const isCandidate = player.status === 'run';
            const isFirstPlayer = player.is_first_player;
            const isActive = gameState.current_player === player.player_number;
            
            return (
              <div key={player.player_number} className={`player-box ${posClass}`}>
                {/* 플레이어 아바타 */}
                <div className={`player-avatar ${isCandidate ? 'candidate' : ''} ${isFirstPlayer ? 'first-player' : ''} ${isActive ? 'active' : ''}`}>
                  <i className="fa-solid fa-user" />
                  <span className="player-num">{player.player_number}</span>
                  
                  {/* 선 플레이어 표시 (한자 先) */}
                  {isFirstPlayer && (
                    <div className="first-badge">先</div>
                  )}
                  
                  {/* 후보자 표시 */}
                  {isCandidate && (
                    <div className="candidate-badge">후보자</div>
                  )}
                </div>

                {/* 점수 */}
                <div className="player-score">
                  <span className="score-value">{player.total_score}</span>
                  {player.round_score !== 0 && (
                    <span className={`score-change ${player.round_score > 0 ? 'positive' : 'negative'}`}>
                      {player.round_score > 0 ? '+' : ''}{player.round_score}
                    </span>
                  )}
                </div>

                {/* 공개된 카드 (후보자 연설) - 큰 문양 + 숫자 */}
                {player.revealed_cards && player.revealed_cards.length > 0 && (
                  <div className="revealed-cards">
                    {player.revealed_cards.map((card, idx) => {
                      if (!card) return null;
                      const suit = card[0];
                      const rank = card.slice(1);
                      const suitSymbol: {[key: string]: string} = { S: '♠', D: '♦', H: '♥', C: '♣' };
                      return (
                        <div key={idx} className={`mini-card ${getCardColor(card)}`}>
                          <div className="card-suit">{suitSymbol[suit] || suit}</div>
                          <div className="card-rank">{rank}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        </section>

      </main>
    </div>
  );
}
