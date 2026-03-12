'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { formatCard, getCardColor } from '@/lib/poker-utils';
import '../../display/styles.css';

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
  player_count: number;
  current_round: number;
  current_step: number;
  info_text: string | null;
  timer_seconds: number;
  timer_active: boolean;
  timer_end?: boolean;
  current_player: number | null;
  players: GamePlayer[];
  votes?: Record<string, Array<{ voter: number; voted_for: number | null }>>;
  round_winners?: Record<string, number[]>;
  final_winners?: number[];
  status: string;
} | null;

const GRID_COLS: Record<number, number> = {
  8: 4,
  9: 5,
  10: 5,
  11: 6,
  12: 6,
};

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

export default function GameEditPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;

  const [game, setGame] = useState<GameState>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editingScore, setEditingScore] = useState<number | null>(null);
  const [scoreDraft, setScoreDraft] = useState<number[]>([]);

  const loadGame = useCallback(async () => {
    if (!gameId) return;
    const res = await fetch(`/api/game/${encodeURIComponent(gameId)}`);
    const data = await res.json();
    if (res.ok && data) setGame(data);
    else setGame(null);
  }, [gameId]);

  useEffect(() => {
    loadGame().finally(() => setLoading(false));
  }, [loadGame]);

  useEffect(() => {
    if (!gameId || !game) return;
    const channel = supabase
      .channel('game-edit')
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
      void supabase.removeChannel(channel);
    };
  }, [gameId, game, loadGame]);

  async function applyEdit(payload: { op?: Record<string, unknown>; ops?: Record<string, unknown>[] }) {
    if (!gameId || updating) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/game/${gameId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) setGame(data);
      else alert(data.error || '편집 실패');
    } catch (e) {
      console.error(e);
      alert('편집 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
      setEditingScore(null);
    }
  }

  if (!gameId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-gray-400">gameId가 필요합니다.</p>
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

  if (!game) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8">
        <p className="text-gray-400 mb-4">게임을 찾을 수 없습니다.</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 text-[#FF4F00] border border-[#FF4F00] rounded-lg hover:bg-[#FF4F00]/10"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const players = game.players || [];
  const activeCount = Math.min(game.player_count || 8, 12);
  const gridCols = GRID_COLS[activeCount] ?? 6;
  const isGameComplete = game.status === '완료' && game.final_winners && game.final_winners.length > 0;
  const phaseText = game.info_text || `Step ${game.current_step}`;

  return (
    <div className="game-display-root">
      <div className="scanlines" aria-hidden />

      {/* Edit 모드 헤더 */}
      <div
        className="absolute top-2 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-2 bg-amber-500/95 rounded-lg shadow-lg"
        style={{ fontFamily: 'var(--main-font)' }}
      >
        <span className="font-bold text-gray-900">편집 모드</span>
        <button
          onClick={() => router.push(`/game/control/${gameId}`)}
          className="px-3 py-1 bg-gray-800 text-white text-sm rounded hover:bg-gray-700"
        >
          컨트롤로 돌아가기
        </button>
      </div>

      <header className="display-header">
        <div className="brand-box">
          <span className="brand-main">DO:LAB</span>
          <span className="brand-sub">NEON PROJECT</span>
        </div>
        <div className="title-frame">
          <h1 className="game-title">대선 포커 (편집)</h1>
        </div>
        <div className="round-box">{game.current_round} ROUND</div>
      </header>

      <main className="display-main">
        <section className="info-section">
          <div className="phase-container">
            <div className="phase-current">{phaseText}</div>
          </div>
          <div className="timer-wrapper">
            <div className="timer-container">
              <div className="timer-value">
                {game.timer_seconds > 0
                  ? `${Math.floor(game.timer_seconds / 60).toString().padStart(2, '0')}:${(game.timer_seconds % 60).toString().padStart(2, '0')}`
                  : '--:--'}
              </div>
            </div>
          </div>
          <div className="ranking-container">
            <div className="ranking-header">HAND RANKINGS</div>
          </div>
        </section>

        {!isGameComplete && (
          <section
            className="detail-section"
            style={{ '--grid-cols': gridCols } as React.CSSProperties}
          >
            {Array.from({ length: activeCount }, (_, i) => i + 1).map((num) => {
              const p =
                players.find((x) => x.player_number === num) || {
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

              const isEditingThis = editingScore === num;

              return (
                <div
                  key={num}
                  className={`player-col ${isWinner ? 'player-winner' : ''}`}
                >
                    <div className="player-box">
                    <div className="avatar-wrapper relative">
                      {isWinner && (
                        <div className="relative inline-block group/crown">
                          <div className="crown-badge">👑</div>
                          <button
                            type="button"
                            onClick={() => {
                              const cur = game.round_winners?.[String(game.current_round)] ?? [];
                              applyEdit({
                                op: {
                                  type: 'set_round_winners',
                                  round: game.current_round,
                                  winners: cur.filter((n) => n !== num),
                                },
                              });
                            }}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full hover:bg-red-600 hidden group-hover/crown:flex items-center justify-center"
                            title="라운드 승자에서 제거"
                          >
                            ×
                          </button>
                        </div>
                      )}
                      {p.is_first && (
                        <div className="relative inline-block group/first">
                          <div className="first-player-badge">先</div>
                          <div className="absolute -bottom-6 left-0 hidden group-hover/first:flex gap-1 flex-wrap">
                            {Array.from({ length: activeCount }, (_, i) => i + 1)
                              .filter((n) => n !== num)
                              .map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() =>
                                    applyEdit({
                                      op: {
                                        type: 'set_first_player',
                                        player_number: n,
                                      },
                                    })
                                  }
                                  className="w-6 h-6 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                                >
                                  {n}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                      <div className={`node-box ${isActive ? 'active-action' : ''}`}>
                        <span className="player-num">{num}</span>
                      </div>
                    </div>
                    <div className="relative">
                      {isEditingThis ? (
                        <div className="flex flex-col gap-1 bg-white p-2 rounded border">
                          {(p.round_scores || [0, 0, 0, 0]).map((s, ri) => (
                            <div key={ri} className="flex items-center gap-1">
                              <span className="text-xs text-gray-600">R{ri + 1}:</span>
                              <input
                                type="number"
                                value={scoreDraft[ri] ?? s}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  setScoreDraft((prev) => {
                                    const next = [...(prev.length ? prev : [s, s, s, s])];
                                    next[ri] = isNaN(v) ? 0 : v;
                                    return next;
                                  });
                                }}
                                className="w-12 px-1 py-0.5 text-sm border rounded"
                              />
                            </div>
                          ))}
                          <div className="flex gap-1 mt-1">
                            <button
                              type="button"
                              onClick={async () => {
                                const scores = p.round_scores || [0, 0, 0, 0];
                                const draft = scoreDraft.length ? scoreDraft : scores;
                                await applyEdit({
                                  ops: draft.map((score, ri) => ({
                                    type: 'update_score',
                                    player_number: num,
                                    round_index: ri,
                                    score: score ?? (p.round_scores || [0, 0, 0, 0])[ri],
                                  })),
                                });
                              }}
                              className="text-xs px-2 py-1 bg-amber-500 text-white rounded"
                            >
                              적용
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingScore(null);
                                setScoreDraft([]);
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="score-box cursor-pointer hover:ring-2 hover:ring-amber-400 rounded"
                          onClick={() => {
                            setEditingScore(num);
                            setScoreDraft(p.round_scores || [0, 0, 0, 0]);
                          }}
                          title="클릭하여 점수 편집"
                        >
                          {p.total_score}
                        </div>
                      )}
                    </div>
                  </div>
                  {p.is_candidate && (
                    <div className="player-info relative">
                      <div className="candidate-badge flex items-center gap-1 flex-wrap">
                        후보
                        <button
                          type="button"
                          onClick={() =>
                            applyEdit({ op: { type: 'remove_candidate', player_number: num } })
                          }
                          disabled={updating}
                          className="ml-1 w-5 h-5 bg-red-500 text-white text-xs rounded hover:bg-red-600 flex items-center justify-center"
                          title="후보 제거"
                        >
                          ×
                        </button>
                        {!isWinner && game.current_step >= 8 && (
                          <button
                            type="button"
                            onClick={() => {
                              const cur = game.round_winners?.[String(game.current_round)] ?? [];
                              applyEdit({
                                op: {
                                  type: 'set_round_winners',
                                  round: game.current_round,
                                  winners: [...cur, num],
                                },
                              });
                            }}
                            className="ml-1 px-1.5 py-0.5 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                            title="라운드 승자로 추가"
                          >
                            +승자
                          </button>
                        )}
                      </div>
                      {p.revealed_cards && p.revealed_cards.length >= 1 && (
                        <div className="card-display flex flex-wrap gap-1">
                          {p.revealed_cards.map((c, i) => (
                            <div
                              key={i}
                              className={`card-item ${getCardColor(c)} relative group`}
                            >
                              <span>{formatCard(c).slice(0, 1)}</span>
                              {formatCard(c).slice(1)}
                              <button
                                type="button"
                                onClick={() =>
                                  applyEdit({
                                    op: {
                                      type: 'remove_revealed_card',
                                      player_number: num,
                                      card: c,
                                    },
                                  })
                                }
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {voters.length > 0 && (
                        <div className="voter-grid">
                          {voters.map((voterId) => (
                            <div key={voterId} className="voter-coin relative group">
                              {voterId}
                              <button
                                type="button"
                                onClick={() =>
                                  applyEdit({
                                    op: {
                                      type: 'remove_vote',
                                      round: game.current_round,
                                      voter: voterId,
                                    },
                                  })
                                }
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full opacity-0 group-hover:opacity-100"
                              >
                                ×
                              </button>
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
