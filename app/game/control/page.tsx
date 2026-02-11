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
  hand_cards: string[];
  revealed_cards: string[];
  status: 'run' | 'giveup' | null;
  vote_to: number | null;
  total_score: number;
  round_score: number;
  is_first_player: boolean;
};

export default function GameControlPage() {
  // Dashboard vs Game Mode
  const [mode, setMode] = useState<'dashboard' | 'game'>('dashboard');
  const [sessions, setSessions] = useState<GameSession[]>([]);
  
  // Game Creation
  const [gameDate, setGameDate] = useState(new Date().toISOString().split('T')[0]);
  const [playerCount, setPlayerCount] = useState(8);
  
  // Game State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  
  // Step-specific state
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  
  // Load sessions
  useEffect(() => {
    if (mode === 'dashboard') {
      loadSessions();
    }
  }, [mode]);

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

    // Create session
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

    // Initialize game
    const { error: initError } = await supabase.rpc('initialize_game', {
      p_session_id: session.id,
      p_player_count: playerCount,
    });

    if (initError) {
      alert('게임 초기화 실패: ' + initError.message);
      return;
    }

    // Enter game
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

  // === STEP HANDLERS ===

  // Step 1: 선 정하기
  function handleSelectFirstPlayer(num: number) {
    setSelectedPlayers([num]);
  }

  async function confirmFirstPlayer() {
    if (selectedPlayers.length === 0) return;
    const firstPlayer = selectedPlayers[0];

    // Update all players
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

  // Step 2: 카드 딜링 (프리플랍)
  async function dealCards() {
    if (!gameState) return;

    let deck = [...gameState.deck_remaining];
    
    // Deal 2 cards to each player (starting from first_player)
    const fp = gameState.first_player || 1;
    for (let i = 0; i < players.length; i++) {
      const pNum = ((fp - 1 + i) % players.length) + 1;
      const hand = [deck.pop()!, deck.pop()!];
      await updatePlayer(pNum, { hand_cards: hand });
    }

    await updateGameState({
      step: 3,
      phase: '플랍 오픈',
      deck_remaining: deck,
    });
  }

  // Step 3: 플랍 오픈 (커뮤니티 3장)
  async function openFlop() {
    if (!gameState) return;

    let deck = [...gameState.deck_remaining];
    const burnCard = deck.pop(); // 번 카드
    const flop = [deck.pop()!, deck.pop()!, deck.pop()!];

    await updateGameState({
      step: 4,
      phase: '전략회의 I',
      community_cards: flop,
      deck_remaining: deck,
      timer_seconds: 480, // 8분
      timer_active: true,
    });
  }

  // Step 4: 전략회의 I
  async function endStrategyI() {
    await updateGameState({
      step: 5,
      phase: '출마 선언',
      timer_active: false,
    });
  }

  // Step 5: 출마 선언 (루프)
  async function recordCandidacy(playerNum: number, choice: 'run' | 'giveup') {
    await updatePlayer(playerNum, { status: choice });
    
    // Check if all declared
    const updated = await supabase
      .from('game_players')
      .select('status')
      .eq('session_id', sessionId!)
      .neq('status', null);

    if (updated.data && updated.data.length === players.length) {
      // All declared, move to next step
      await updateGameState({
        step: 6,
        phase: '후보자 연설',
      });
    }
  }

  // Step 6: 후보자 연설 (루프)
  async function recordSpeech(playerNum: number, cards: string[]) {
    await updatePlayer(playerNum, { revealed_cards: cards });
  }

  async function endSpeech() {
    await updateGameState({
      step: 7,
      phase: '턴 오픈',
    });
  }

  // Step 7: 턴 오픈 (커뮤니티 1장)
  async function openTurn() {
    if (!gameState) return;

    let deck = [...gameState.deck_remaining];
    const burnCard = deck.pop(); // 번 카드
    const turn = deck.pop()!;

    await updateGameState({
      step: 8,
      phase: '전략회의 II',
      community_cards: [...gameState.community_cards, turn],
      deck_remaining: deck,
      timer_seconds: 480, // 8분
      timer_active: true,
    });
  }

  // Step 8: 전략회의 II
  async function endStrategyII() {
    await updateGameState({
      step: 9,
      phase: '유권자 투표',
      timer_active: false,
    });
  }

  // Step 9: 유권자 투표 (루프)
  async function recordVote(playerNum: number, voteTo: number) {
    await updatePlayer(playerNum, { vote_to: voteTo });
  }

  async function endVoting() {
    await updateGameState({
      step: 10,
      phase: '리버 오픈',
    });
  }

  // Step 10: 리버 오픈 (커뮤니티 1장)
  async function openRiver() {
    if (!gameState) return;

    let deck = [...gameState.deck_remaining];
    const burnCard = deck.pop(); // 번 카드
    const river = deck.pop()!;

    await updateGameState({
      step: 11,
      phase: '결과 계산',
      community_cards: [...gameState.community_cards, river],
      deck_remaining: deck,
    });
  }

  // Step 11: 결과 계산 및 라운드 종료
  async function calculateScores() {
    // TODO: 점수 계산 로직 구현
    alert('점수 계산 로직을 구현해야 합니다');
  }

  async function finishRound() {
    if (!gameState) return;

    if (gameState.round < 4) {
      // Next round
      await updateGameState({
        round: gameState.round + 1,
        step: 1,
        phase: '선 정하기',
        community_cards: [],
        timer_active: false,
      });

      // Reset players
      for (const p of players) {
        await updatePlayer(p.player_number, {
          hand_cards: [],
          revealed_cards: [],
          status: null,
          vote_to: null,
          round_score: 0,
        });
      }

      // Re-shuffle deck
      const { data } = await supabase.rpc('shuffle_deck', {
        deck: await supabase.rpc('create_card_deck'),
      });
      
      await updateGameState({ deck_remaining: data });
    } else {
      // Game finished
      alert('게임 종료!');
      await supabase
        .from('game_sessions')
        .update({ status: 'finished' })
        .eq('id', sessionId!);
      
      exitGame();
    }
  }

  if (!gameState || mode === 'dashboard') {
    // === DASHBOARD ===
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
  const phase = gameState.phase;

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
          <button className="btn-icon"><i className="fa-solid fa-chart-pie"></i></button>
        </div>
      </div>

      <div className="game-body">
        
        {/* Step 1: 선 정하기 */}
        {step === 1 && (
          <div className="step-container">
            <div className="step-title">선 플레이어 정하기</div>
            <div className="step-info">이번 라운드 선 플레이어를 선택하세요</div>
            <div className="grid-container grid-4">
              {players.map((p) => (
                <button
                  key={p.player_number}
                  className={`select-btn ${selectedPlayers.includes(p.player_number) ? 'selected' : ''}`}
                  onClick={() => handleSelectFirstPlayer(p.player_number)}
                >
                  {p.player_number}
                </button>
              ))}
            </div>
            <button
              className="btn-action-lg"
              disabled={selectedPlayers.length === 0}
              onClick={confirmFirstPlayer}
            >
              선택 완료
            </button>
          </div>
        )}

        {/* Step 2: 카드 딜링 */}
        {step === 2 && (
          <div className="step-container">
            <div className="step-title">카드 딜링</div>
            <div className="step-info">각 플레이어에게 2장씩 카드를 딜링합니다 (선: {gameState.first_player})</div>
            <button className="btn-action-lg" onClick={dealCards}>
              카드 딜링 시작
            </button>
          </div>
        )}

        {/* Step 3: 플랍 오픈 */}
        {step === 3 && (
          <div className="step-container">
            <div className="step-title">플랍 오픈</div>
            <div className="step-info">번 카드 1장 공개 후 커뮤니티 카드 3장 오픈</div>
            <button className="btn-action-lg" onClick={openFlop}>
              플랍 오픈
            </button>
          </div>
        )}

        {/* Step 4: 전략회의 I */}
        {step === 4 && (
          <div className="step-container">
            <div className="step-title">전략회의 I</div>
            <div className="step-info">타이머: 8분</div>
            <div className="timer-display">{Math.floor(gameState.timer_seconds / 60)}:{(gameState.timer_seconds % 60).toString().padStart(2, '0')}</div>
            <button className="btn-action-lg" onClick={endStrategyI}>
              전략회의 종료
            </button>
          </div>
        )}

        {/* Step 5: 출마 선언 */}
        {step === 5 && (
          <div className="step-container">
            <div className="step-title">출마 선언</div>
            <div className="step-info">각 플레이어의 출마/포기 선택 (각 20초)</div>
            <div className="player-grid">
              {players.map((p) => (
                <div key={p.player_number} className="player-card">
                  <div className="player-card-num">P{p.player_number}</div>
                  {p.status ? (
                    <div className={`status-display ${p.status}`}>
                      {p.status === 'run' ? '출마 ✅' : '포기 ❌'}
                    </div>
                  ) : (
                    <div className="button-group">
                      <button
                        className="btn-small btn-run"
                        onClick={() => recordCandidacy(p.player_number, 'run')}
                      >
                        출마
                      </button>
                      <button
                        className="btn-small btn-giveup"
                        onClick={() => recordCandidacy(p.player_number, 'giveup')}
                      >
                        포기
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 6: 후보자 연설 */}
        {step === 6 && (
          <div className="step-container">
            <div className="step-title">후보자 연설</div>
            <div className="step-info">후보자들이 카드 2장을 공개합니다</div>
            <div className="info-text">
              진행용 페이지에서는 간단히 넘어가고, 실제로는 송출 화면에서 수동으로 카드를 보여줍니다.
            </div>
            <button className="btn-action-lg" onClick={endSpeech}>
              연설 완료
            </button>
          </div>
        )}

        {/* Step 7: 턴 오픈 */}
        {step === 7 && (
          <div className="step-container">
            <div className="step-title">턴 오픈</div>
            <div className="step-info">번 카드 1장 공개 후 커뮤니티 카드 1장 추가</div>
            <button className="btn-action-lg" onClick={openTurn}>
              턴 오픈
            </button>
          </div>
        )}

        {/* Step 8: 전략회의 II */}
        {step === 8 && (
          <div className="step-container">
            <div className="step-title">전략회의 II</div>
            <div className="step-info">타이머: 8분</div>
            <div className="timer-display">{Math.floor(gameState.timer_seconds / 60)}:{(gameState.timer_seconds % 60).toString().padStart(2, '0')}</div>
            <button className="btn-action-lg" onClick={endStrategyII}>
              전략회의 종료
            </button>
          </div>
        )}

        {/* Step 9: 유권자 투표 */}
        {step === 9 && (
          <div className="step-container">
            <div className="step-title">유권자 투표</div>
            <div className="step-info">포기한 유권자들이 후보자에게 투표합니다</div>
            <button className="btn-action-lg" onClick={endVoting}>
              투표 완료
            </button>
          </div>
        )}

        {/* Step 10: 리버 오픈 */}
        {step === 10 && (
          <div className="step-container">
            <div className="step-title">리버 오픈</div>
            <div className="step-info">번 카드 1장 공개 후 최종 커뮤니티 카드 1장 추가</div>
            <button className="btn-action-lg" onClick={openRiver}>
              리버 오픈
            </button>
          </div>
        )}

        {/* Step 11: 결과 계산 */}
        {step === 11 && (
          <div className="step-container">
            <div className="step-title">라운드 {gameState.round} 종료</div>
            <div className="step-info">점수를 계산하고 다음 라운드로 진행합니다</div>
            <button className="btn-action-lg" onClick={calculateScores} style={{ marginBottom: '10px' }}>
              점수 계산
            </button>
            <button className="btn-action-lg" onClick={finishRound}>
              라운드 종료
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
