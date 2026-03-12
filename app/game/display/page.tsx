'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { QRCodeCanvas } from 'qrcode.react';
import { formatCard, getCardColor } from '@/lib/poker-utils';
import { subscribeDemoGame } from '@/lib/demo-sync';
import './styles.css';

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

type GameState = {
  game_id: string;
  session_id: string;
  game_name?: string;
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
} | null;

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
  10: '결과 계산',
};

/* 플레이어 수별 그리드 열 수: 8→4, 9→5, 10→5, 11→6, 12→6 */
const GRID_COLS: Record<number, number> = {
  8: 4,
  9: 5,
  10: 5,
  11: 6,
  12: 6,
};

function getDemoGame(playerCount: number, step: number = 8): GameState {
  const players: GamePlayer[] = Array.from({ length: playerCount }, (_, i) => ({
    player_number: i + 1,
    is_first: step >= 2 ? i === 0 : false,
    is_candidate: step >= 4 ? (i === 0 || i === playerCount - 1) : false,
    revealed_cards: step >= 6 && (i === 0 || i === playerCount - 1) ? (i === 0 ? ['S8', 'D10'] : ['HQ', 'C9']) : [],
    total_score: step === 1 ? 0 : 80 + i * 20,
    round_scores: [0, 0, 0, 0],
  }));
  const votes: Record<string, Array<{ voter: number; voted_for: number | null }>> = {
    '1': [],
  };
  for (let v = 2; v < playerCount; v++) {
    votes['1'].push({ voter: v, voted_for: v <= playerCount / 2 ? 1 : playerCount });
  }
  return {
    game_id: 'demo',
    session_id: 'demo',
    game_name: '대선 포커',
    player_count: playerCount,
    current_round: 1,
    current_step: step,
    info_text: step === 1 ? '선 정하기' : step === 8 ? '투표 진행 중' : null,
    timer_seconds: step === 1 ? 0 : 225,
    timer_active: step === 1 ? false : true,
    current_player: step === 1 ? null : 3,
    community_cards: [],
    players,
    votes,
    status: '진행중',
  };
}

const HAND_RANKINGS = [
  { name: '스트레이트 플러쉬', tier: 's' },
  { name: '포카드', tier: 's' },
  { name: '플러쉬', tier: 'a' },
  { name: '풀하우스', tier: 'a' },
  { name: '스트레이트', tier: 'b' },
  { name: '트리플', tier: 'b' },
  { name: '투페어', tier: 'c' },
  { name: '원페어', tier: 'c' },
];

function getVotersForCandidate(
  votes: Record<string, Array<{ voter: number; voted_for: number | null }>> | undefined,
  round: number,
  candidateNum: number
): number[] {
  if (!votes) return [];
  const roundVotes = votes[String(round)];
  if (!Array.isArray(roundVotes)) return [];
  return roundVotes
    .filter((v) => v.voted_for === candidateNum)
    .map((v) => v.voter);
}

function DisplayPageContent() {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get('session') || '';
  const [sessionId, setSessionId] = useState(sessionParam);
  const [game, setGame] = useState<GameState>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGame = useCallback(async (sid: string) => {
    if (!sid) {
      setGame(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    if (sid.startsWith('demo')) {
      const count = sid === 'demo' ? 12 : parseInt(sid.replace('demo', ''), 10) || 12;
      const step = sid === 'demo' ? 1 : 8;
      setGame(getDemoGame(Math.min(12, Math.max(8, count)), step));
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/game/session/${encodeURIComponent(sid)}`);
      const data = await res.json();
      if (res.ok && data) {
        setGame(data);
      } else {
        setGame(null);
      }
    } catch (e) {
      setError('게임 정보를 불러올 수 없습니다.');
      setGame(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionParam) {
      setSessionId(sessionParam);
      loadGame(sessionParam);
    }
  }, [sessionParam, loadGame]);

  // 데모: BroadcastChannel 구독
  useEffect(() => {
    if (sessionId === 'demo') {
      return subscribeDemoGame((data) => setGame(data as GameState));
    }
    if (!sessionId || sessionId.startsWith('demo')) return;
    const channel = supabase
      .channel('game-display')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_0a',
          filter: `session_id=eq.${sessionId}`,
        },
        () => loadGame(sessionId)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, loadGame]);

  // 실제 게임: Realtime 미동작 시 대비 폴링 (2초마다)
  useEffect(() => {
    if (!sessionId || sessionId.startsWith('demo')) return;
    const interval = setInterval(() => loadGame(sessionId), 2000);
    return () => clearInterval(interval);
  }, [sessionId, loadGame]);

  const handleSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = (e.target as HTMLFormElement).session?.value?.trim();
    if (input) {
      setSessionId(input);
      loadGame(input);
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-white mb-6 text-center" style={{ fontFamily: 'var(--font-orbitron)' }}>
            대선포커 송출 화면
          </h1>
          <form onSubmit={handleSessionSubmit} className="space-y-4">
            <input
              name="session"
              type="text"
              placeholder="세션 ID (예: 260306A0A1)"
              className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-lg text-white placeholder:text-gray-500 focus:border-[#FF4F00] focus:outline-none"
            />
            <button
              type="submit"
              className="w-full py-3 bg-[#FF4F00] hover:bg-[#e64800] text-white font-bold rounded-lg transition-colors"
            >
              입장
            </button>
          </form>
          <p className="mt-4 text-sm text-gray-500 text-center">
            게임 진행 페이지에서 세션 ID를 확인하세요.
          </p>
          <p className="mt-2 text-xs text-gray-600 text-center">
            디자인 확인: <code className="bg-gray-800 px-1 rounded">demo</code> (12명, 송출↔컨트롤 연동) · <code className="bg-gray-800 px-1 rounded">demo9</code> (9명)
          </p>
        </div>
      </div>
    );
  }

  if (loading && !game) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white animate-pulse">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8">
        <p className="text-gray-400 mb-4">해당 세션의 게임이 없습니다.</p>
        <button
          onClick={() => setSessionId('')}
          className="px-4 py-2 text-[#FF4F00] border border-[#FF4F00] rounded-lg hover:bg-[#FF4F00]/10"
        >
          세션 선택으로
        </button>
      </div>
    );
  }

  const players = (game.players || []) as GamePlayer[];
  const activeCount = Math.min(game.player_count || 8, 12);
  const gridCols = GRID_COLS[activeCount] ?? 6;
  const isResultSelecting = game.status === '결과선택중';
  const isGameComplete = game.status === '완료' && game.final_winners && game.final_winners.length > 0;
  const isClosing = game.status === '마무리';
  const phaseText =
    isClosing
      ? '피드백 작성'
      : isGameComplete
        ? '게임 종료'
        : game.info_text || (STEP_LABELS[game.current_step] ?? `Step ${game.current_step}`);

  /** 점수 순위 (1등부터, 동점 시 플레이어 번호 오름차순) */
  const rankedPlayers = [...players].sort((a, b) => {
    if (b.total_score !== a.total_score) return b.total_score - a.total_score;
    return a.player_number - b.player_number;
  });

  return (
    <div className="game-display-root">
      <div className="scanlines" aria-hidden />

      <header className="display-header">
        <div className="brand-box">
          <span className="brand-main">DO:LAB</span>
          <span className="brand-sub">NEON PROJECT</span>
        </div>
        <div className="title-frame">
          <h1 className="game-title">대선 포커</h1>
        </div>
        {!isClosing && <div className="round-box">{game.current_round} ROUND</div>}
      </header>

      <main className="display-main">
        <section className="info-section">
          <div className="phase-container">
            <div className="phase-current">{phaseText}</div>
          </div>
          <div className="timer-wrapper">
            <div className="timer-container">
              <div className={`timer-value ${game.timer_end || isResultSelecting || isGameComplete || isClosing ? 'timer-end' : ''}`}>
                {isClosing
                  ? '수고하셨습니다'
                  : isResultSelecting || isGameComplete
                    ? '게임 종료'
                    : game.timer_end
                      ? (game.current_step === 10 ? '라운드 종료' : '종료')
                      : game.timer_seconds > 0
                        ? `${Math.floor(game.timer_seconds / 60).toString().padStart(2, '0')}:${(game.timer_seconds % 60).toString().padStart(2, '0')}`
                        : '--:--'}
              </div>
            </div>
            {isClosing && (
              <span className="timer-credit-text">피드백 작성 시 2,000 크레딧 적립</span>
            )}
          </div>
          {!isClosing && (
          <div className="ranking-container">
            <div className="ranking-header">HAND RANKINGS</div>
            <ul className="ranking-list">
              {HAND_RANKINGS.map((r) => (
                <li key={r.name} className={`rank-item ${r.tier}-tier`}>
                  {r.name}
                </li>
              ))}
            </ul>
          </div>
          )}
        </section>

        {/* 최종 결과 집계중 오버레이 (마무리 화면에서는 숨김) */}
        {isResultSelecting && !isClosing && (
          <div className="final-result-overlay">
            <div className="final-result-loading">
              <span className="final-result-loading-text">최종 결과 집계중</span>
              <span className="final-result-dots">
                <span className="dot">.</span>
                <span className="dot">.</span>
                <span className="dot">.</span>
              </span>
            </div>
          </div>
        )}

        {/* 최종 결과 화면 (우승자 + 순위) - QR 없음 */}
        {isGameComplete && game.final_winners && (() => {
          const nonWinnerCount = rankedPlayers.filter((p) => !game.final_winners!.includes(p.player_number)).length;
          const bottomWidth = nonWinnerCount * 76 + Math.max(0, nonWinnerCount - 1) * 16;
          return (
          <section
            className="final-result-section"
            style={{ '--bottom-content-width': `${bottomWidth}px` } as React.CSSProperties}
          >
            <div className="final-result-podium">
              <div className="final-result-podium-inner">
                {game.final_winners.map((num) => {
                  const p = players.find((x) => x.player_number === num);
                  const score = p?.total_score ?? 0;
                  return (
                    <div key={num} className="final-result-player final-result-winner">
                      <div className="final-winner-crown">👑</div>
                      <div className="avatar-wrapper">
                        <div className="node-box">
                          <span className="player-num">{num}</span>
                        </div>
                      </div>
                      <div className="score-box">{score}</div>
                      <div className="final-badge final-badge-winner">WINNER</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="final-result-bottom">
              {rankedPlayers
                .filter((p) => !game.final_winners!.includes(p.player_number))
                .map((p, idx) => {
                  const rank = game.final_winners!.length + 1 + idx;
                  const rankLabel = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
                  return (
                    <div key={p.player_number} className="final-result-player">
                      <div className="avatar-wrapper">
                        <div className="node-box">
                          <span className="player-num">{p.player_number}</span>
                        </div>
                      </div>
                      <div className="score-box">{p.total_score}</div>
                      <div className="final-badge final-badge-rank">{rankLabel}</div>
                    </div>
                  );
                })}
            </div>
          </section>
          );
        })()}

        {/* 마무리 화면 (피드백 QR만) */}
        {game.status === '마무리' && (
          <section className="closing-section">
            <div className="closing-qr-wrap">
              <QRCodeCanvas
                value={
                  typeof window !== 'undefined'
                    ? `${(process.env.NEXT_PUBLIC_APP_URL || window.location.origin)}/feedback/deep?sessionId=${encodeURIComponent(game.session_id)}&gameName=${encodeURIComponent((game as { game_name?: string }).game_name ?? game.session_id)}`
                    : ''
                }
                size={320}
                level="L"
                includeMargin
              />
            </div>
          </section>
        )}

        {/* 일반 플레이어 그리드 (게임 진행 중일 때만) */}
        {!isGameComplete && !isClosing && (
        <section className="detail-section" id="player-board" style={{ '--grid-cols': gridCols } as React.CSSProperties}>
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
            const voters = p.is_candidate
              ? getVotersForCandidate(game.votes, game.current_round, num)
              : [];

            return (
              <div key={num} className={`player-col ${isWinner ? 'player-winner' : ''}`}>
                <div className="player-box">
                  <div className="avatar-wrapper">
                    {isWinner && <div className="crown-badge">👑</div>}
                    {p.is_first && <div className="first-player-badge">先</div>}
                    <div className={`node-box ${isActive ? 'active-action' : ''}`}>
                      <span className="player-num">{num}</span>
                    </div>
                  </div>
                  <div className="score-box">{p.total_score}</div>
                </div>
                {p.is_candidate && (
                  <div className="player-info">
                    <div className="candidate-badge">후보</div>
                    {p.revealed_cards && p.revealed_cards.length >= 1 && (
                      <div className="card-display">
                        {p.revealed_cards.map((c, i) => (
                          <div key={i} className={`card-item ${getCardColor(c)}`}>
                            <span>{formatCard(c).slice(0, 1)}</span>
                            {formatCard(c).slice(1)}
                          </div>
                        ))}
                      </div>
                    )}
                    {voters.length > 0 && (
                      <div className="voter-grid">
                        {voters.map((voterId) => (
                          <div key={voterId} className="voter-coin">
                            {voterId}
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
        )}
      </main>
    </div>
  );
}

export default function DisplayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white animate-pulse">로딩 중...</div>
      </div>
    }>
      <DisplayPageContent />
    </Suspense>
  );
}
