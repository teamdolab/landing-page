'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import './control-styles.css';

type GameSession = {
  id: string;
  game_type: string;
  session_date: string;
  player_count: number;
  current_round: number;
  status: string;
};

type GameState = {
  round: number;
  step: number;
  phase: string;
  first_player: number | null;
  current_player: number | null;
  timer_seconds: number;
  timer_active: boolean;
  community_cards: string[];
  deck_remaining: string[];
};

type Player = {
  player_number: number;
  revealed_cards: string[];
  status: 'run' | 'giveup' | null;
  vote_to: number | null;
  total_score: number;
  round_score: number;
  is_first_player: boolean;
};

export default function GameControlPage() {
  const [mode, setMode] = useState<'dashboard' | 'game'>('dashboard');
  const [sessions, setSessions] = useState<GameSession[]>([]);
  
  const [gameDate, setGameDate] = useState(new Date().toISOString().split('T')[0]);
  const [playerCount, setPlayerCount] = useState(8);
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [winnerPlayers, setWinnerPlayers] = useState<number[]>([]);

  // 타이머 카운트다운
  useEffect(() => {
    if (!gameState || !gameState.timer_active || gameState.timer_seconds <= 0) return;

    const interval = setInterval(async () => {
      const newSeconds = gameState.timer_seconds - 1;
      
      if (newSeconds <= 0) {
        // 타이머 종료 - 자동 넘김
        await handleTimerEnd();
      } else {
        // DB 업데이트
        await supabase
          .from('game_state')
          .update({ timer_seconds: newSeconds })
          .eq('session_id', sessionId!);
        
        setGameState(prev => prev ? { ...prev, timer_seconds: newSeconds } : null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState?.timer_active, gameState?.timer_seconds, sessionId]);

  // 타이머 종료 처리
  async function handleTimerEnd() {
    if (!gameState || !sessionId) return;

    const step = gameState.step;
    const currentPlayer = gameState.current_player;

    if (step === 5) {
      // 출마 선언 - 자동으로 포기 처리 후 다음 플레이어
      if (currentPlayer) {
        await recordCandidacy(currentPlayer, 'giveup', true);
      }
    } else if (step === 9) {
      // 투표 - 자동으로 기권 처리 후 다음 플레이어
      if (currentPlayer) {
        await recordVote(currentPlayer, 0, true);
      }
    }
  }

  useEffect(() => {
    if (mode === 'dashboard') {
      loadSessions();
    }
  }, [mode]);

  // 실시간 구독
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`game-control-${sessionId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_state', filter: `session_id=eq.${sessionId}` },
        () => loadGameState(sessionId)
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `session_id=eq.${sessionId}` },
        () => loadGameState(sessionId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  async function loadSessions() {
    const { data } = await supabase
      .from('game_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (data) setSessions(data);
  }

  async function createGame() {
    if (!gameDate) {
      alert('날짜를 선택해주세요');
      return;
    }

    const { data: session, error } = await supabase
      .from('game_sessions')
      .insert({
        game_type: '대선포커',
        session_date: gameDate,
        player_count: playerCount,
        status: 'playing',
      })
      .select()
      .single();

    if (error || !session) {
      alert('게임 생성 실패: ' + error?.message);
      return;
    }

    const { error: initError } = await supabase.rpc('initialize_game', {
      p_session_id: session.id,
      p_player_count: playerCount,
    });

    if (initError) {
      alert('게임 초기화 실패: ' + initError.message);
      return;
    }

    enterGame(session.id);
  }

  async function enterGame(sid: string) {
    setSessionId(sid);
    await loadGameState(sid);
    setMode('game');
  }

  async function loadGameState(sid: string) {
    const { data: state } = await supabase
      .from('game_state')
      .select('*')
      .eq('session_id', sid)
      .single();

    const { data: playerData } = await supabase
      .from('game_players')
      .select('*')
      .eq('session_id', sid)
      .order('player_number');

    if (state) {
      setGameState({
        round: state.round,
        step: state.step,
        phase: state.phase,
        first_player: state.first_player,
        current_player: state.current_player,
        timer_seconds: state.timer_seconds,
        timer_active: state.timer_active,
        community_cards: state.community_cards || [],
        deck_remaining: state.deck_remaining || [],
      });
    }

    if (playerData) {
      setPlayers(playerData);
    }
  }

  async function updateGameState(updates: Partial<GameState>) {
    if (!sessionId) return;

    await supabase
      .from('game_state')
      .update(updates)
      .eq('session_id', sessionId);

    await loadGameState(sessionId);
  }

  async function updatePlayer(playerNum: number, updates: any) {
    if (!sessionId) return;

    await supabase
      .from('game_players')
      .update(updates)
      .eq('session_id', sessionId)
      .eq('player_number', playerNum);

    await loadGameState(sessionId);
  }

  function exitGame() {
    if (confirm('게임을 종료하고 대시보드로 돌아가시겠습니까?')) {
      setMode('dashboard');
      setSessionId(null);
      setGameState(null);
      setPlayers([]);
    }
  }

  function openDisplayScreen() {
    if (!sessionId) return;
    const displayUrl = `/game/display?session=${sessionId}`;
    window.open(displayUrl, '_blank', 'width=1920,height=1080');
  }

  // === STEP HANDLERS ===

  // Step 1: 선 정하기
  async function startStep1() {
    if (!confirm('선 플레이어를 정하시겠습니까?')) return;
    // 이미 Step 1이므로 바로 진행
  }

  function handleSelectFirstPlayer(num: number) {
    setSelectedPlayers([num]);
  }

  async function confirmFirstPlayer() {
    if (selectedPlayers.length === 0) return;
    const firstPlayer = selectedPlayers[0];

    for (const p of players) {
      await updatePlayer(p.player_number, {
        is_first_player: p.player_number === firstPlayer,
      });
    }

    await updateGameState({
      step: 2,
      phase: '카드 딜링',
      first_player: firstPlayer,
    });

    setSelectedPlayers([]);
  }

  // Step 2: 카드 딜링
  async function startStep2() {
    if (!confirm('카드 딜링을 시작하시겠습니까?\n(오프라인에서 딜러가 직접 카드를 배분합니다)')) return;
    // 이미 Step 2
  }

  async function confirmDealingComplete() {
    await updateGameState({
      step: 3,
      phase: '플랍 오픈',
    });
  }

  // Step 3: 플랍 오픈
  async function startStep3() {
    if (!confirm('플랍 오픈을 시작하시겠습니까?\n(커뮤니티 카드 3장 공개)')) return;
    await openFlop();
  }

  async function openFlop() {
    await updateGameState({
      step: 4,
      phase: '전략회의 I',
      timer_seconds: 480,
      timer_active: true,
    });
  }

  // Step 4: 전략회의 I
  async function startStep4() {
    // 자동 시작됨
  }

  async function endStrategyI() {
    if (!confirm('전략회의를 종료하고 출마 선언을 시작하시겠습니까?')) return;
    
    const firstPlayer = gameState?.first_player || 1;
    await updateGameState({
      step: 5,
      phase: '출마 선언',
      timer_active: true,
      timer_seconds: 20,
      current_player: firstPlayer,
    });
  }

  // Step 5: 출마 선언 (루프)
  async function recordCandidacy(playerNum: number, choice: 'run' | 'giveup', autoNext: boolean = false) {
    await updatePlayer(playerNum, { status: choice });
    
    // 다음 플레이어 찾기
    const remainingPlayers = players.filter(p => !p.status && p.player_number !== playerNum);
    
    if (remainingPlayers.length === 0) {
      // 모두 선언 완료
      const candidates = players.filter(p => p.status === 'run' || (p.player_number === playerNum && choice === 'run'));
      const firstCandidate = candidates[0];
      
      await updateGameState({
        step: 6,
        phase: '후보자 연설',
        timer_active: firstCandidate ? true : false,
        timer_seconds: firstCandidate ? 30 : 0,
        current_player: firstCandidate?.player_number || null,
      });
    } else {
      // 다음 플레이어로
      const nextPlayer = remainingPlayers[0];
      await updateGameState({
        current_player: nextPlayer.player_number,
        timer_seconds: 20,
        timer_active: true,
      });
    }
  }

  // Step 6: 후보자 연설 (루프)
  function toggleCardSelection(card: string) {
    if (selectedCards.includes(card)) {
      setSelectedCards(selectedCards.filter(c => c !== card));
    } else if (selectedCards.length < 2) {
      setSelectedCards([...selectedCards, card]);
    }
  }

  async function confirmSpeech() {
    const currentPlayer = gameState?.current_player;
    if (!currentPlayer || selectedCards.length !== 2) return;
    
    await updatePlayer(currentPlayer, { revealed_cards: selectedCards });
    setSelectedCards([]);
    
    // 다음 후보자 찾기
    const candidates = players.filter(p => p.status === 'run');
    const currentIndex = candidates.findIndex(c => c.player_number === currentPlayer);
    const nextCandidate = candidates[currentIndex + 1];
    
    if (!nextCandidate) {
      // 모든 후보자 연설 완료
      await updateGameState({
        step: 7,
        phase: '턴 오픈',
        timer_active: false,
        timer_seconds: 0,
        current_player: null,
      });
    } else {
      // 다음 후보자로
      await updateGameState({
        current_player: nextCandidate.player_number,
        timer_seconds: 30,
        timer_active: true,
      });
    }
  }

  // Step 7: 턴 오픈
  async function startStep7() {
    if (!confirm('턴 오픈을 시작하시겠습니까?\n(커뮤니티 카드 1장 추가)')) return;
    await openTurn();
  }

  async function openTurn() {
    await updateGameState({
      step: 8,
      phase: '전략회의 II',
      timer_seconds: 480,
      timer_active: true,
    });
  }

  // Step 8: 전략회의 II
  async function endStrategyII() {
    if (!confirm('전략회의를 종료하고 유권자 투표를 시작하시겠습니까?')) return;
    
    const firstVoter = players.find(p => p.status === 'giveup');
    await updateGameState({
      step: 9,
      phase: '유권자 투표',
      timer_active: firstVoter ? true : false,
      timer_seconds: firstVoter ? 20 : 0,
      current_player: firstVoter?.player_number || null,
    });
  }

  // Step 9: 유권자 투표 (루프)
  async function recordVote(playerNum: number, voteTo: number, autoNext: boolean = false) {
    await updatePlayer(playerNum, { vote_to: voteTo });
    
    // 다음 유권자 찾기
    const voters = players.filter(p => p.status === 'giveup');
    const remainingVoters = voters.filter(v => v.vote_to === null && v.player_number !== playerNum);
    
    if (remainingVoters.length === 0) {
      // 모든 투표 완료
      await updateGameState({
        step: 10,
        phase: '리버 오픈',
        timer_active: false,
        timer_seconds: 0,
        current_player: null,
      });
    } else {
      // 다음 유권자로
      const nextVoter = remainingVoters[0];
      await updateGameState({
        current_player: nextVoter.player_number,
        timer_seconds: 20,
        timer_active: true,
      });
    }
  }

  // Step 10: 리버 오픈
  async function startStep10() {
    if (!confirm('리버 오픈을 시작하시겠습니까?\n(최종 커뮤니티 카드 1장 추가)')) return;
    await openRiver();
  }

  async function openRiver() {
    await updateGameState({
      step: 11,
      phase: '결과 계산',
    });
  }

  // Step 11: 결과 계산
  function toggleWinnerSelection(playerNum: number) {
    if (winnerPlayers.includes(playerNum)) {
      setWinnerPlayers(winnerPlayers.filter(p => p !== playerNum));
    } else {
      setWinnerPlayers([...winnerPlayers, playerNum]);
    }
  }

  async function calculateScores() {
    if (winnerPlayers.length === 0) {
      alert('승리 후보를 선택해주세요');
      return;
    }

    const { calculateRoundScores } = await import('@/lib/poker-utils');
    
    const scores = calculateRoundScores(
      players.map(p => ({
        player_number: p.player_number,
        status: p.status,
        vote_to: p.vote_to,
      })),
      winnerPlayers
    );

    for (const p of players) {
      const roundScore = scores.get(p.player_number) || 0;
      const newTotalScore = p.total_score + roundScore;
      
      await updatePlayer(p.player_number, {
        round_score: roundScore,
        total_score: newTotalScore,
      });
    }

    alert('점수 계산 완료!');
    await loadGameState(sessionId!);
  }

  async function finishRound() {
    if (!gameState) return;

    if (!confirm('라운드를 종료하시겠습니까?')) return;

    if (gameState.round < 4) {
      // 다음 라운드
      await updateGameState({
        round: gameState.round + 1,
        step: 1,
        phase: '선 정하기',
        community_cards: [],
        timer_active: false,
        timer_seconds: 0,
        current_player: null,
      });

      // 플레이어 초기화
      for (const p of players) {
        await updatePlayer(p.player_number, {
          revealed_cards: [],
          status: null,
          vote_to: null,
          round_score: 0,
        });
      }
      
      setWinnerPlayers([]);
    } else {
      // 게임 종료
      alert('게임 종료!');
      await supabase
        .from('game_sessions')
        .update({ status: 'finished' })
        .eq('id', sessionId!);
      
      exitGame();
    }
  }

  // === DASHBOARD ===
  if (!gameState || mode === 'dashboard') {
    return (
      <div className="admin-dashboard">
        <header className="admin-header">
          <div className="logo-area">DO:LAB <span>ADMIN</span></div>
        </header>

        <div className="admin-body">
          <div className="container">
            <div className="card">
              <div className="card-header">
                <div className="card-title"><i className="fa-solid fa-gamepad"></i> 새 게임 세션 생성</div>
              </div>
              <div className="form-group">
                <label className="form-label">게임 선택</label>
                <select className="form-control">
                  <option value="대선포커">대선 포커</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">진행 날짜</label>
                <input
                  type="date"
                  className="form-control"
                  value={gameDate}
                  onChange={(e) => setGameDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">참가 인원: {playerCount}명</label>
                <div className="chips-container">
                  {[8, 9, 10, 11, 12].map((n) => (
                    <div
                      key={n}
                      className={`chip ${playerCount === n ? 'active' : ''}`}
                      onClick={() => setPlayerCount(n)}
                    >
                      {n}명
                    </div>
                  ))}
                </div>
              </div>
              <button className="btn-submit" onClick={createGame}>
                <i className="fa-solid fa-play"></i> 세션 생성 및 입장
              </button>
            </div>

            <div>
              <div className="list-header">최근 생성된 세션</div>
              {sessions.length === 0 ? (
                <div className="empty-state">생성된 게임 세션이 없습니다.</div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    className="session-item"
                    onClick={() => enterGame(s.id)}
                  >
                    <div className="session-info">
                      <h3>{s.game_type}</h3>
                      <div className="session-meta">
                        <span><i className="fa-solid fa-calendar"></i> {s.session_date}</span>
                        <span><i className="fa-solid fa-users"></i> {s.player_count}명</span>
                        <span><i className="fa-solid fa-trophy"></i> {s.current_round}/4 라운드</span>
                      </div>
                    </div>
                    <div className="status-badge">{s.status === 'playing' ? '진행 중' : '완료'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === GAME INTERFACE ===
  const step = gameState.step;
  const currentPlayer = gameState.current_player;
  const currentPlayerData = players.find(p => p.player_number === currentPlayer);

  return (
    <div className="game-interface">
      <div className="game-header">
        <div className="gh-left">
          <button className="btn-icon" onClick={exitGame}><i className="fa-solid fa-house"></i></button>
        </div>
        <div className="gh-center">
          대선 포커 - {gameDate} - {players.length}명 - ROUND {gameState.round}
        </div>
        <div className="gh-right">
          <button className="btn-icon" onClick={openDisplayScreen} title="송출 화면 열기">
            <i className="fa-solid fa-tv"></i>
          </button>
        </div>
      </div>

      <div className="game-body">
        
        {/* Step 1: 선 정하기 */}
        {step === 1 && (
          <div className="step-container">
            <div className="step-title">STEP 1: 선 플레이어 정하기</div>
            <div className="step-info">이번 라운드 선 플레이어를 선택하세요</div>
            <div className="grid-container grid-4" style={{ marginTop: '30px' }}>
              {players.map((p) => (
                <button
                  key={p.player_number}
                  className={`select-btn ${selectedPlayers.includes(p.player_number) ? 'selected' : ''}`}
                  onClick={() => handleSelectFirstPlayer(p.player_number)}
                >
                  플레이어 {p.player_number}
                </button>
              ))}
            </div>
            <button
              className="btn-action-lg"
              disabled={selectedPlayers.length === 0}
              onClick={confirmFirstPlayer}
              style={{ marginTop: '30px' }}
            >
              선택 완료
            </button>
          </div>
        )}

        {/* Step 2: 카드 딜링 */}
        {step === 2 && (
          <div className="step-container">
            <div className="step-title">STEP 2: 카드 딜링</div>
            <div className="step-info">딜러가 오프라인에서 각 플레이어에게 2장씩 카드를 딜링합니다</div>
            <div className="info-text" style={{ marginTop: '30px', fontSize: '18px', color: '#FF4F00' }}>
              <i className="fa-solid fa-circle-info"></i> 선 플레이어: P{gameState.first_player}
            </div>
            <div className="info-text" style={{ marginTop: '20px', color: '#888' }}>
              💡 실제 카드는 딜러가 오프라인에서 배분합니다.<br/>
              딜링이 완료되면 버튼을 눌러 다음 단계로 진행하세요.
            </div>
            <button className="btn-action-lg" onClick={confirmDealingComplete} style={{ marginTop: '30px' }}>
              딜링 완료 확인
            </button>
          </div>
        )}

        {/* Step 3: 플랍 오픈 */}
        {step === 3 && (
          <div className="step-container">
            <div className="step-title">STEP 3: 플랍 오픈</div>
            <div className="step-info">번 카드 1장 공개 후 커뮤니티 카드 3장 오픈</div>
            <button className="btn-action-lg" onClick={startStep3} style={{ marginTop: '30px' }}>
              플랍 오픈 시작
            </button>
          </div>
        )}

        {/* Step 4: 전략회의 I */}
        {step === 4 && (
          <div className="step-container">
            <div className="step-title">STEP 4: 전략회의 I</div>
            <div className="step-info">타이머: 8분</div>
            <div className="timer-display" style={{ marginTop: '30px' }}>
              {Math.floor(gameState.timer_seconds / 60)}:{(gameState.timer_seconds % 60).toString().padStart(2, '0')}
            </div>
            <button className="btn-action-lg" onClick={endStrategyI} style={{ marginTop: '30px' }}>
              전략회의 종료
            </button>
          </div>
        )}

        {/* Step 5: 출마 선언 (한 명씩) */}
        {step === 5 && currentPlayerData && (
          <div className="step-container">
            <div className="step-title">STEP 5: 출마 선언</div>
            <div className="step-info">각 플레이어가 순서대로 출마/포기를 선택합니다 (각 20초)</div>
            
            <div style={{ marginTop: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#FF4F00', marginBottom: '20px' }}>
                플레이어 {currentPlayer}
              </div>
              <div className="timer-display">
                {gameState.timer_seconds}초
              </div>
              
              <div style={{ marginTop: '40px', display: 'flex', gap: '20px', justifyContent: 'center' }}>
                <button
                  className="btn-action-lg btn-run"
                  onClick={() => recordCandidacy(currentPlayer, 'run')}
                  style={{ flex: 1, maxWidth: '200px', fontSize: '24px', padding: '30px' }}
                >
                  출마
                </button>
                <button
                  className="btn-action-lg btn-giveup"
                  onClick={() => recordCandidacy(currentPlayer, 'giveup')}
                  style={{ flex: 1, maxWidth: '200px', fontSize: '24px', padding: '30px', backgroundColor: '#666' }}
                >
                  포기
                </button>
              </div>

              <div style={{ marginTop: '40px', color: '#888', fontSize: '14px' }}>
                완료: {players.filter(p => p.status).length} / {players.length}
              </div>
            </div>
          </div>
        )}

        {/* Step 6: 후보자 연설 (한 명씩) */}
        {step === 6 && currentPlayerData && (
          <div className="step-container">
            <div className="step-title">STEP 6: 후보자 연설</div>
            <div className="step-info">후보자가 주장하는 카드 2장을 입력하세요 (각 30초)</div>
            
            <div style={{ marginTop: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#FF4F00', marginBottom: '20px' }}>
                후보자 P{currentPlayer}
              </div>
              <div className="timer-display">
                {gameState.timer_seconds}초
              </div>
              
              <div style={{ marginTop: '20px', fontSize: '18px', color: '#888' }}>
                선택한 카드: {selectedCards.length}/2
              </div>

              <div className="card-selection-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '8px', marginTop: '30px', maxWidth: '800px', margin: '30px auto' }}>
                {['S', 'D', 'H', 'C'].map(suit => 
                  ['2', '3', '4', '5', '6', '7', '8', '9', '10'].map(rank => {
                    const card = suit + rank;
                    const isSelected = selectedCards.includes(card);
                    return (
                      <button
                        key={card}
                        className={`card-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleCardSelection(card)}
                        style={{
                          padding: '15px',
                          backgroundColor: isSelected ? '#4CAF50' : '#333',
                          color: suit === 'D' || suit === 'H' ? '#ff6b6b' : '#fff',
                          border: isSelected ? '3px solid #fff' : '1px solid #666',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          fontSize: '18px',
                          fontWeight: 'bold',
                        }}
                      >
                        {card}
                      </button>
                    );
                  })
                )}
              </div>

              <button
                className="btn-action-lg"
                onClick={confirmSpeech}
                disabled={selectedCards.length !== 2}
                style={{ marginTop: '30px' }}
              >
                확인 ({selectedCards.length}/2)
              </button>

              <div style={{ marginTop: '30px', color: '#888', fontSize: '14px' }}>
                완료: {players.filter(p => p.status === 'run' && p.revealed_cards && p.revealed_cards.length === 2).length} / {players.filter(p => p.status === 'run').length}
              </div>
            </div>
          </div>
        )}

        {/* Step 7: 턴 오픈 */}
        {step === 7 && (
          <div className="step-container">
            <div className="step-title">STEP 7: 턴 오픈</div>
            <div className="step-info">번 카드 1장 공개 후 커뮤니티 카드 1장 추가</div>
            <button className="btn-action-lg" onClick={startStep7} style={{ marginTop: '30px' }}>
              턴 오픈 시작
            </button>
          </div>
        )}

        {/* Step 8: 전략회의 II */}
        {step === 8 && (
          <div className="step-container">
            <div className="step-title">STEP 8: 전략회의 II</div>
            <div className="step-info">타이머: 8분</div>
            <div className="timer-display" style={{ marginTop: '30px' }}>
              {Math.floor(gameState.timer_seconds / 60)}:{(gameState.timer_seconds % 60).toString().padStart(2, '0')}
            </div>
            <button className="btn-action-lg" onClick={endStrategyII} style={{ marginTop: '30px' }}>
              전략회의 종료
            </button>
          </div>
        )}

        {/* Step 9: 유권자 투표 (한 명씩) */}
        {step === 9 && currentPlayerData && (
          <div className="step-container">
            <div className="step-title">STEP 9: 유권자 투표</div>
            <div className="step-info">유권자가 후보자에게 투표합니다 (각 20초)</div>
            
            <div style={{ marginTop: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#FF4F00', marginBottom: '20px' }}>
                유권자 P{currentPlayer}
              </div>
              <div className="timer-display">
                {gameState.timer_seconds}초
              </div>
              
              <div style={{ marginTop: '40px', fontSize: '18px', marginBottom: '30px' }}>
                투표할 후보자를 선택하세요
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center', maxWidth: '600px', margin: '0 auto' }}>
                {players.filter(p => p.status === 'run').map(candidate => (
                  <button
                    key={candidate.player_number}
                    className="btn-action-lg btn-run"
                    onClick={() => recordVote(currentPlayer, candidate.player_number)}
                    style={{ minWidth: '120px', fontSize: '20px', padding: '20px 30px' }}
                  >
                    P{candidate.player_number}
                  </button>
                ))}
                <button
                  className="btn-action-lg"
                  onClick={() => recordVote(currentPlayer, 0)}
                  style={{ minWidth: '120px', fontSize: '20px', padding: '20px 30px', backgroundColor: '#666' }}
                >
                  기권
                </button>
              </div>

              <div style={{ marginTop: '40px', color: '#888', fontSize: '14px' }}>
                완료: {players.filter(p => p.status === 'giveup' && p.vote_to !== null).length} / {players.filter(p => p.status === 'giveup').length}
              </div>
            </div>
          </div>
        )}

        {/* Step 10: 리버 오픈 */}
        {step === 10 && (
          <div className="step-container">
            <div className="step-title">STEP 10: 리버 오픈</div>
            <div className="step-info">번 카드 1장 공개 후 최종 커뮤니티 카드 1장 추가</div>
            <button className="btn-action-lg" onClick={startStep10} style={{ marginTop: '30px' }}>
              리버 오픈 시작
            </button>
          </div>
        )}

        {/* Step 11: 결과 계산 */}
        {step === 11 && (
          <div className="step-container">
            <div className="step-title">STEP 11: 라운드 {gameState.round} 종료</div>
            <div className="step-info">딜러가 실제 카드를 확인하고 승리 후보를 선택하세요</div>
            
            <div className="info-text" style={{ marginTop: '30px', color: '#ffa500', fontSize: '16px' }}>
              💡 모든 후보자가 실제 카드를 공개했습니다.<br/>
              딜러가 오프라인에서 족보를 확인하고 승리 후보를 선택하세요.
            </div>

            <div className="step-info" style={{ marginTop: '40px', fontSize: '18px', fontWeight: 'bold' }}>
              승리 후보 선택 ({winnerPlayers.length}명)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
              {players.filter(p => p.status === 'run').map((p) => (
                <div key={p.player_number} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', color: '#888', marginBottom: '8px' }}>
                    주장: {p.revealed_cards?.join(' ') || '없음'}
                  </div>
                  <button
                    className={`select-btn ${winnerPlayers.includes(p.player_number) ? 'selected' : ''}`}
                    onClick={() => toggleWinnerSelection(p.player_number)}
                    style={{ minWidth: '100px', fontSize: '20px', padding: '20px' }}
                  >
                    P{p.player_number}
                    {winnerPlayers.includes(p.player_number) && ' ✅'}
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '40px' }}>
              <div className="step-info" style={{ fontSize: '16px', marginBottom: '20px' }}>
                현재 점수
              </div>
              <div className="score-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px', maxWidth: '800px', margin: '0 auto' }}>
                {players.map(p => (
                  <div key={p.player_number} style={{ 
                    padding: '15px', 
                    backgroundColor: '#222', 
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: '2px solid #444'
                  }}>
                    <div style={{ fontWeight: 'bold', fontSize: '18px' }}>P{p.player_number}</div>
                    <div style={{ fontSize: '20px', color: '#FF4F00', fontWeight: 'bold', marginTop: '5px' }}>
                      {p.total_score}점
                    </div>
                    {p.round_score !== 0 && (
                      <div style={{ fontSize: '14px', color: p.round_score > 0 ? '#4CAF50' : '#ff1744', marginTop: '3px' }}>
                        ({p.round_score > 0 ? '+' : ''}{p.round_score})
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button 
              className="btn-action-lg" 
              onClick={calculateScores} 
              style={{ marginTop: '40px' }}
              disabled={winnerPlayers.length === 0}
            >
              점수 계산 {winnerPlayers.length > 0 && `(승리: P${winnerPlayers.join(', P')})`}
            </button>
            <button className="btn-action-lg" onClick={finishRound} style={{ marginTop: '15px', backgroundColor: '#666' }}>
              라운드 종료
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
